import fs from "node:fs";
import { SPEC_VERSION } from "../config/constants.js";
import { definitionSearchDirs, resolveDefinition } from "../agents/index.js";
import { applyExport, planArtifacts, type PlannedArtifact } from "../adapters/engine.js";
import { isManagedContents } from "../adapters/provenance.js";
import { isExcluded } from "../filesystem/exclusions.js";
import { isDirectory, pathExists, walkFiles, writeFileAtomic } from "../filesystem/io.js";
import { posixBasename, posixJoin, resolveFromBase, toPosixPath } from "../filesystem/paths.js";
import { ensureTrailingNewline } from "../adapters/formats.js";
import type { EffectiveSnapshot, ResolvedSource } from "../resolution/types.js";
import { collectSourceInventory } from "../sources/inventory.js";
import { requireCapability } from "../sources/capabilities.js";
import { sourceIdentity } from "../sources/paths.js";
import { classifyRelation } from "../state/compare.js";
import { fileContentHash } from "../state/identity.js";
import { getEntry, loadSyncState, saveSyncState, upsertEntry, type SyncStateFile } from "../state/index.js";
import type { RelationKind, RelationState } from "../state/types.js";
import { AiwError } from "./errors.js";
import {
  IMPORT_META_NAME,
  assertSourceReady,
  loadWorkspace,
  readImportableText,
  snapshotDestRoot,
  sourceFileAbsolute,
} from "./import.js";

export interface SyncRelationReport {
  kind: RelationKind;
  id: string;
  path: string;
  identity: string;
  state: RelationState;
  applied: boolean;
}

export interface SyncResult {
  specVersion: 1;
  command: "sync";
  ok: boolean;
  dryRun: boolean;
  apply: boolean;
  relations: SyncRelationReport[];
  written: string[];
  skippedUnmanaged: string[];
  conflicts: string[];
}

export function syncWorkspace(
  startDir: string,
  options?: { sourceId?: string; agentId?: string; dryRun?: boolean; apply?: boolean },
): SyncResult {
  const dryRun = options?.dryRun === true;
  const apply = options?.apply === true && !dryRun;
  const previewApply = options?.apply === true || options?.dryRun === true;
  const snapshot = loadWorkspace(startDir);
  let state = loadSyncState(snapshot.active.root);
  const relations: SyncRelationReport[] = [];
  const written: string[] = [];
  const skippedUnmanaged: string[] = [];
  const conflicts: string[] = [];

  const sources = selectedSources(snapshot, options?.sourceId);
  for (const source of sources) {
    const result = syncSource(snapshot, source, state, { apply, dryRun, previewApply });
    state = result.state;
    relations.push(...result.relations);
    written.push(...result.written);
    skippedUnmanaged.push(...result.skippedUnmanaged);
    conflicts.push(...result.conflicts);
  }

  const agents = selectedAgents(snapshot, options?.agentId);
  for (const agent of agents) {
    const result = syncAgent(snapshot, agent.id, agent.definitionId, state, { apply, dryRun, previewApply });
    state = result.state;
    relations.push(...result.relations);
    written.push(...result.written);
    skippedUnmanaged.push(...result.skippedUnmanaged);
    conflicts.push(...result.conflicts);
  }

  relations.sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind < b.kind ? -1 : 1;
    }
    if (a.id !== b.id) {
      return a.id < b.id ? -1 : 1;
    }
    return a.path < b.path ? -1 : 1;
  });
  written.sort();
  skippedUnmanaged.sort();
  conflicts.sort();

  if (!dryRun) {
    saveSyncState(snapshot.active.root, state);
  }

  const ok = conflicts.length === 0 && skippedUnmanaged.length === 0;
  return {
    specVersion: SPEC_VERSION,
    command: "sync",
    ok,
    dryRun,
    apply: options?.apply === true,
    relations,
    written,
    skippedUnmanaged,
    conflicts,
  };
}

export function recordExportedAgent(
  scopeRoot: string,
  agentId: string,
  planned: readonly PlannedArtifact[],
): void {
  let state = loadSyncState(scopeRoot);
  for (const artifact of planned) {
    if (artifact.state === "unmanaged") {
      continue;
    }
    if (!pathExists(artifact.absolutePath)) {
      continue;
    }
    state = upsertEntry(state, "agent", agentId, {
      path: artifact.posixPath,
      identity: artifact.identities[0] ?? artifact.posixPath,
      lastCanonical: artifact.hash,
      lastExternal: fileContentHash(artifact.absolutePath),
    });
  }
  saveSyncState(scopeRoot, state);
}

function selectedSources(snapshot: EffectiveSnapshot, sourceId: string | undefined): ResolvedSource[] {
  if (sourceId !== undefined) {
    const source = snapshot.sources.find((item) => item.id === sourceId);
    if (source === undefined) {
      throw new AiwError("VALIDATION", `Source '${sourceId}' is not registered.`, {
        suggestion: "Run `aiw source list`.",
      });
    }
    return [source];
  }
  return snapshot.sources.filter((item) => item.status === "resolved");
}

function selectedAgents(
  snapshot: EffectiveSnapshot,
  agentId: string | undefined,
): { id: string; definitionId: string }[] {
  if (agentId !== undefined) {
    const agent = snapshot.agents.find((item) => item.id === agentId);
    if (agent === undefined) {
      throw new AiwError("VALIDATION", `Agent '${agentId}' is not registered.`, {
        suggestion: "Run `aiw agent add` before syncing.",
      });
    }
    return [{ id: agent.id, definitionId: agent.definitionId }];
  }
  return snapshot.agents.filter((item) => item.enabled).map((item) => ({ id: item.id, definitionId: item.definitionId }));
}

function syncSource(
  snapshot: EffectiveSnapshot,
  source: ResolvedSource,
  state: SyncStateFile,
  options: { apply: boolean; dryRun: boolean; previewApply: boolean },
): {
  state: SyncStateFile;
  relations: SyncRelationReport[];
  written: string[];
  skippedUnmanaged: string[];
  conflicts: string[];
} {
  assertSourceReady(source);
  requireCapability(source, "read", "sync");
  requireCapability(source, "index", "sync");
  if (options.apply) {
    requireCapability(source, "import", "sync --apply");
  }
  const inventory = collectSourceInventory(source, snapshot.policies.exclusions);
  const destRoot = snapshotDestRoot(snapshot.active.root, source.id);
  const paths = new Set<string>(inventory.map((item) => toPosixPath(item.relativePath)));
  if (isDirectory(destRoot)) {
    for (const file of walkFiles(destRoot)) {
      if (file.relativePosix === IMPORT_META_NAME) {
        continue;
      }
      paths.add(file.relativePosix);
    }
  }

  const relations: SyncRelationReport[] = [];
  const written: string[] = [];
  const skippedUnmanaged: string[] = [];
  const conflicts: string[] = [];
  const sorted = [...paths].sort();
  for (const relativePath of sorted) {
    if (relativePath === IMPORT_META_NAME) {
      continue;
    }
    const sourceAbs = sourceFileAbsolute(source, relativePath);
    const destAbs = resolveFromBase(destRoot, relativePath);
    const destPosix = posixJoin(".ai", "sources", source.id, relativePath);
    if (isSensitive(relativePath, sourceAbs, snapshot.policies.exclusions)) {
      continue;
    }
    const currentExternal = fileContentHash(sourceAbs);
    const currentCanonical = fileContentHash(destAbs);
    const last = getEntry(state, "source", source.id, relativePath);
    const relationState = classifyRelation({
      lastCanonical: last?.lastCanonical,
      lastExternal: last?.lastExternal,
      currentCanonical,
      currentExternal,
    });
    const identity = sourceIdentity(source.id, relativePath);
    let applied = false;
    if (relationState === "conflict") {
      conflicts.push(destPosix);
    } else if (options.previewApply && relationState === "external-changed" && currentExternal !== undefined) {
      const readable = readImportableText(sourceAbs, snapshot.policies.maxFileBytes);
      if (readable.skipped === undefined) {
        if (options.apply) {
          writeFileAtomic(destAbs, ensureTrailingNewline(readable.text));
          applied = true;
          written.push(destPosix);
          state = upsertEntry(state, "source", source.id, {
            path: relativePath,
            identity,
            lastCanonical: fileContentHash(destAbs),
            lastExternal: currentExternal,
          });
        } else if (options.dryRun) {
          written.push(destPosix);
        }
      }
    } else if (last === undefined && !options.dryRun) {
      state = upsertEntry(state, "source", source.id, {
        path: relativePath,
        identity,
        lastCanonical: currentCanonical,
        lastExternal: currentExternal,
      });
    }
    relations.push({
      kind: "source",
      id: source.id,
      path: destPosix,
      identity,
      state: relationState,
      applied,
    });
  }
  return { state, relations, written, skippedUnmanaged, conflicts };
}

function syncAgent(
  snapshot: EffectiveSnapshot,
  agentId: string,
  definitionId: string,
  state: SyncStateFile,
  options: { apply: boolean; dryRun: boolean; previewApply: boolean },
): {
  state: SyncStateFile;
  relations: SyncRelationReport[];
  written: string[];
  skippedUnmanaged: string[];
  conflicts: string[];
} {
  const definition = resolveDefinition(definitionId, definitionSearchDirs(snapshot));
  const planned = planArtifacts(definition, snapshot);
  const relations: SyncRelationReport[] = [];
  const written: string[] = [];
  const skippedUnmanaged: string[] = [];
  const conflicts: string[] = [];

  for (const artifact of planned) {
    const nativeExists = pathExists(artifact.absolutePath);
    const nativeText = nativeExists ? fs.readFileSync(artifact.absolutePath, "utf8") : undefined;
    const unmanaged = nativeText !== undefined && !isManagedContents(nativeText);
    if (unmanaged) {
      skippedUnmanaged.push(artifact.posixPath);
      relations.push({
        kind: "agent",
        id: agentId,
        path: artifact.posixPath,
        identity: artifact.identities[0] ?? artifact.posixPath,
        state: "clean",
        applied: false,
      });
      continue;
    }
    const last = getEntry(state, "agent", agentId, artifact.posixPath);
    const currentCanonical = artifact.hash;
    const currentExternal = nativeExists ? fileContentHash(artifact.absolutePath) : undefined;
    const relationState = classifyRelation({
      lastCanonical: last?.lastCanonical,
      lastExternal: last?.lastExternal,
      currentCanonical,
      currentExternal,
    });
    let applied = false;
    if (relationState === "conflict") {
      conflicts.push(artifact.posixPath);
    } else if (options.previewApply && relationState === "canonical-changed") {
      if (options.apply) {
        const appliedFiles = applyExport([artifact]);
        if (appliedFiles.skippedUnmanaged.length > 0) {
          skippedUnmanaged.push(...appliedFiles.skippedUnmanaged);
        } else if (appliedFiles.written.length > 0 || appliedFiles.unchanged.length > 0) {
          applied = appliedFiles.written.length > 0;
          written.push(...appliedFiles.written);
          state = upsertEntry(state, "agent", agentId, {
            path: artifact.posixPath,
            identity: artifact.identities[0] ?? artifact.posixPath,
            lastCanonical: artifact.hash,
            lastExternal: fileContentHash(artifact.absolutePath),
          });
        }
      } else if (options.dryRun) {
        written.push(artifact.posixPath);
      }
    } else if (last === undefined && !options.dryRun) {
      state = upsertEntry(state, "agent", agentId, {
        path: artifact.posixPath,
        identity: artifact.identities[0] ?? artifact.posixPath,
        lastCanonical: currentCanonical,
        lastExternal: currentExternal,
      });
    }
    relations.push({
      kind: "agent",
      id: agentId,
      path: artifact.posixPath,
      identity: artifact.identities[0] ?? artifact.posixPath,
      state: relationState,
      applied,
    });
  }
  return { state, relations, written, skippedUnmanaged, conflicts };
}

function isSensitive(relativePosixPath: string, absolutePath: string, exclusions: readonly string[]): boolean {
  if (isExcluded(relativePosixPath, exclusions)) {
    return true;
  }
  return isExcluded(posixBasename(absolutePath), exclusions);
}
