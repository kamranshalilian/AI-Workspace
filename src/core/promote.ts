import fs from "node:fs";
import path from "node:path";
import { RESERVED_AI_NAMES, SPEC_VERSION } from "../config/constants.js";
import { definitionSearchDirs, resolveDefinition } from "../agents/index.js";
import type { AgentDefinition, AgentMapping } from "../agents/types.js";
import {
  canonicalPosixPath,
  canonicalRelativeFromMapping,
  isReversibleFormat,
  reverseConvert,
} from "../adapters/reverse.js";
import { globFromTemplate, invertTemplate } from "../adapters/templates.js";
import { matchesGlob } from "../filesystem/exclusions.js";
import { isDirectory, isFile, pathExists, walkFiles, writeFileAtomic } from "../filesystem/io.js";
import { isInsideOrEqual, posixJoin, resolveFromBase, toPosixPath } from "../filesystem/paths.js";
import type { EffectiveSnapshot } from "../resolution/types.js";
import { classifyRelation } from "../state/compare.js";
import { contentHash, fileContentHash } from "../state/identity.js";
import { getEntry, loadSyncState, saveSyncState, upsertEntry } from "../state/store.js";
import { AiwError } from "./errors.js";
import { loadWorkspace } from "./import.js";

export interface PromoteFileReport {
  nativePath: string;
  canonicalPath: string;
  identity: string;
  hash: string;
  action: "written" | "unchanged" | "skipped" | "conflict";
  reason?: string;
}

export interface PromoteResult {
  specVersion: 1;
  command: "promote";
  ok: boolean;
  dryRun: boolean;
  agent: {
    kind: "agent";
    id: string;
    definitionId: string;
  };
  written: string[];
  unchanged: string[];
  skipped: PromoteFileReport[];
  conflicts: string[];
  files: PromoteFileReport[];
}

export function promoteAgent(
  startDir: string,
  agentId: string | undefined,
  options?: { dryRun?: boolean },
): PromoteResult {
  if (agentId === undefined || agentId.trim() === "") {
    throw new AiwError("USAGE", "Usage: aiw promote --agent <id>.");
  }
  const dryRun = options?.dryRun === true;
  const snapshot = loadWorkspace(startDir);
  const agent = snapshot.agents.find((item) => item.id === agentId);
  if (agent === undefined) {
    throw new AiwError("VALIDATION", `Agent '${agentId}' is not registered.`, {
      suggestion: "Run `aiw agent add` before promoting.",
    });
  }
  const definition = resolveDefinition(agent.definitionId, definitionSearchDirs(snapshot));
  const reversible = definition.adapter.mappings.filter((mapping) => isReversibleFormat(mapping.format));
  if (reversible.length === 0) {
    throw new AiwError(
      "VALIDATION",
      `Agent '${agent.id}' has no mapping that can be reversed into canonical content.`,
      {
        suggestion:
          "Promotion requires identity or markdown-frontmatter mappings. Concatenated and reference-index formats cannot be promoted.",
      },
    );
  }

  const natives = listNativeFiles(definition, snapshot.active.root);
  let state = loadSyncState(snapshot.active.root);
  const reports: PromoteFileReport[] = [];

  for (const mapping of reversible) {
    const glob = globFromTemplate(mapping.to);
    for (const nativePosix of natives) {
      if (!matchesGlob(nativePosix, glob) && nativePosix !== toPosixPath(mapping.to)) {
        continue;
      }
      const vars = invertTemplate(mapping.to, nativePosix);
      if (vars === undefined) {
        continue;
      }
      let canonical;
      try {
        canonical = canonicalRelativeFromMapping(mapping, vars);
      } catch {
        reports.push({
          nativePath: nativePosix,
          canonicalPath: "",
          identity: "",
          hash: "",
          action: "skipped",
          reason: "unsupported-conversion",
        });
        continue;
      }
      const report = promoteOne(snapshot, agent.id, mapping, nativePosix, canonical, state, dryRun);
      reports.push(report.file);
      state = report.state;
    }
  }

  reports.sort((a, b) => {
    if (a.canonicalPath !== b.canonicalPath) {
      return a.canonicalPath < b.canonicalPath ? -1 : 1;
    }
    return a.nativePath < b.nativePath ? -1 : 1;
  });
  const written = reports.filter((item) => item.action === "written").map((item) => item.canonicalPath);
  const unchanged = reports.filter((item) => item.action === "unchanged").map((item) => item.canonicalPath);
  const conflicts = reports.filter((item) => item.action === "conflict").map((item) => item.canonicalPath);
  const skipped = reports.filter((item) => item.action === "skipped" || item.action === "conflict");
  const ok = conflicts.length === 0 && !skipped.some((item) => item.reason === "unmanaged");

  if (!dryRun) {
    saveSyncState(snapshot.active.root, state);
  }

  return {
    specVersion: SPEC_VERSION,
    command: "promote",
    ok,
    dryRun,
    agent: {
      kind: "agent",
      id: agent.id,
      definitionId: agent.definitionId,
    },
    written,
    unchanged,
    skipped,
    conflicts,
    files: reports,
  };
}

function promoteOne(
  snapshot: EffectiveSnapshot,
  agentId: string,
  mapping: AgentMapping,
  nativePosix: string,
  canonical: { identity: string; relativePath: string },
  state: ReturnType<typeof loadSyncState>,
  dryRun: boolean,
): { file: PromoteFileReport; state: ReturnType<typeof loadSyncState> } {
  const nativeAbs = resolveFromBase(snapshot.active.root, nativePosix);
  if (!isFile(nativeAbs)) {
    return {
      file: {
        nativePath: nativePosix,
        canonicalPath: canonicalPosixPath(mapping.fromKind, canonical.relativePath),
        identity: canonical.identity,
        hash: "",
        action: "skipped",
        reason: "missing",
      },
      state,
    };
  }
  const nativeText = fs.readFileSync(nativeAbs, "utf8");
  let converted: string;
  try {
    converted = reverseConvert(mapping.format, nativeText);
  } catch (error) {
    if (error instanceof AiwError) {
      return {
        file: {
          nativePath: nativePosix,
          canonicalPath: canonicalPosixPath(mapping.fromKind, canonical.relativePath),
          identity: canonical.identity,
          hash: "",
          action: "skipped",
          reason: "unsupported-conversion",
        },
        state,
      };
    }
    throw error;
  }
  const destPosix = canonicalPosixPath(mapping.fromKind, canonical.relativePath);
  const destAbs = resolveFromBase(snapshot.active.root, destPosix);
  assertSafeCanonicalDest(snapshot.active.root, destAbs, mapping.fromKind);
  const hash = contentHash(converted);
  const last = getEntry(state, "agent", agentId, nativePosix);
  const currentCanonical = pathExists(destAbs) ? fileContentHash(destAbs) : undefined;
  const currentExternal = fileContentHash(nativeAbs);
  const relation = classifyRelation({
    lastCanonical: last?.lastCanonical,
    lastExternal: last?.lastExternal,
    currentCanonical,
    currentExternal,
  });

  if (currentCanonical !== undefined && last === undefined && currentCanonical !== hash) {
    return {
      file: {
        nativePath: nativePosix,
        canonicalPath: destPosix,
        identity: canonical.identity,
        hash,
        action: "skipped",
        reason: "unmanaged",
      },
      state,
    };
  }
  if (relation === "conflict") {
    return {
      file: {
        nativePath: nativePosix,
        canonicalPath: destPosix,
        identity: canonical.identity,
        hash,
        action: "conflict",
        reason: "conflict",
      },
      state,
    };
  }
  if (relation === "canonical-changed") {
    return {
      file: {
        nativePath: nativePosix,
        canonicalPath: destPosix,
        identity: canonical.identity,
        hash,
        action: "skipped",
        reason: "canonical-changed",
      },
      state,
    };
  }
  if (currentCanonical === hash) {
    const next = dryRun
      ? state
      : upsertEntry(state, "agent", agentId, {
          path: nativePosix,
          identity: canonical.identity,
          lastCanonical: hash,
          lastExternal: currentExternal,
        });
    return {
      file: {
        nativePath: nativePosix,
        canonicalPath: destPosix,
        identity: canonical.identity,
        hash,
        action: "unchanged",
      },
      state: next,
    };
  }
  if (!dryRun) {
    writeFileAtomic(destAbs, converted);
  }
  const next = dryRun
    ? state
    : upsertEntry(state, "agent", agentId, {
        path: nativePosix,
        identity: canonical.identity,
        lastCanonical: hash,
        lastExternal: currentExternal,
      });
  return {
    file: {
      nativePath: nativePosix,
      canonicalPath: destPosix,
      identity: canonical.identity,
      hash,
      action: "written",
    },
    state: next,
  };
}

function assertSafeCanonicalDest(scopeRoot: string, destAbs: string, fromKind: string): void {
  const aiDir = path.join(scopeRoot, ".ai");
  if (!isInsideOrEqual(aiDir, destAbs)) {
    throw new AiwError("VALIDATION", "Promotion must write into canonical .ai/.");
  }
  if ((RESERVED_AI_NAMES as readonly string[]).includes(fromKind)) {
    throw new AiwError("VALIDATION", `Cannot promote into reserved canonical path '${fromKind}'.`);
  }
  if (isInsideOrEqual(path.join(aiDir, "manifest.yaml"), destAbs) && destAbs === path.join(aiDir, "manifest.yaml")) {
    throw new AiwError("VALIDATION", "Promotion must not rewrite manifest.yaml.");
  }
}

export function listNativeFiles(definition: AgentDefinition, scopeRoot: string): string[] {
  const files = new Set<string>();
  for (const root of definition.native.roots) {
    const abs = resolveFromBase(scopeRoot, root);
    if (!isDirectory(abs)) {
      continue;
    }
    for (const file of walkFiles(abs)) {
      files.add(posixJoin(toPosixPath(root), file.relativePosix));
    }
  }
  for (const file of definition.native.files) {
    const posix = toPosixPath(file);
    if (isFile(resolveFromBase(scopeRoot, posix))) {
      files.add(posix);
    }
  }
  return [...files].sort();
}
