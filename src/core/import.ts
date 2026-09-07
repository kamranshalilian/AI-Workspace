import path from "node:path";
import { stringify } from "yaml";
import { AI_DIR_NAME, BINARY_SNIFF_BYTES, SPEC_VERSION } from "../config/constants.js";
import { ensureTrailingNewline, normalizeNewlines } from "../adapters/formats.js";
import { discoverScope } from "../filesystem/discovery.js";
import { isExcluded } from "../filesystem/exclusions.js";
import {
  fileSize,
  isBinaryBuffer,
  isFile,
  pathExists,
  readFileBytes,
  readFilePrefix,
  writeFileAtomic,
} from "../filesystem/io.js";
import { isInsideOrEqual, posixBasename, posixJoin, resolveFromBase, toPosixPath } from "../filesystem/paths.js";
import { resolveFrom } from "../resolution/index.js";
import type { EffectiveSnapshot, ResolvedSource } from "../resolution/types.js";
import { requireCapability } from "../sources/capabilities.js";
import { collectSourceInventory } from "../sources/inventory.js";
import { classifyRelation } from "../state/compare.js";
import { contentHash, fileContentHash } from "../state/identity.js";
import { getEntry, loadSyncState, saveSyncState, upsertEntry } from "../state/store.js";
import { AiwError } from "./errors.js";

export const IMPORT_META_NAME = ".aiw-import.yaml";

export interface ImportFileReport {
  path: string;
  identity: string;
  hash: string;
  action: "written" | "unchanged" | "skipped" | "conflict";
  reason?: string;
}

export interface ImportResult {
  specVersion: 1;
  command: "import";
  ok: boolean;
  dryRun: boolean;
  source: {
    kind: "source";
    id: string;
    type: string;
    path: string;
  };
  written: string[];
  unchanged: string[];
  skipped: ImportFileReport[];
  conflicts: string[];
  files: ImportFileReport[];
}

export function importSource(
  startDir: string,
  sourceId: string | undefined,
  options?: { dryRun?: boolean },
): ImportResult {
  const id = requireSourceId(sourceId, "import");
  const dryRun = options?.dryRun === true;
  const snapshot = loadWorkspace(startDir);
  const source = requireRegisteredSource(snapshot, id);
  assertSourceReady(source);
  requireCapability(source, "read", "import");
  requireCapability(source, "index", "import");
  requireCapability(source, "import", "import");

  const inventory = collectSourceInventory(source, snapshot.policies.exclusions);
  const destRoot = snapshotDestRoot(snapshot.active.root, id);
  let state = loadSyncState(snapshot.active.root);
  const reports: ImportFileReport[] = [];
  const liveFingerprint: { path: string; hash: string }[] = [];

  for (const entry of inventory) {
    const relativePath = toPosixPath(entry.relativePath);
    if (relativePath === IMPORT_META_NAME) {
      continue;
    }
    const sourceAbs = sourceFileAbsolute(source, relativePath);
    if (isSensitivePath(relativePath, sourceAbs, snapshot.policies.exclusions)) {
      reports.push(skipReport(relativePath, entry.identity, "security-exclusion"));
      continue;
    }
    const readable = readImportableText(sourceAbs, snapshot.policies.maxFileBytes);
    if (readable.skipped !== undefined) {
      reports.push(skipReport(relativePath, entry.identity, readable.skipped));
      continue;
    }
    const text = ensureTrailingNewline(readable.text);
    const hash = contentHash(text);
    const currentExternal = fileContentHash(sourceAbs);
    if (currentExternal !== undefined) {
      liveFingerprint.push({ path: relativePath, hash: currentExternal });
    }
    const destAbs = resolveFromBase(destRoot, relativePath);
    if (!isInsideOrEqual(destRoot, destAbs)) {
      throw new AiwError("VALIDATION", `Import destination '${relativePath}' escapes .ai/sources/${id}/.`);
    }
    const destPosix = posixJoin(".ai", "sources", id, relativePath);
    const last = getEntry(state, "source", id, relativePath);
    const currentSnapshot = pathExists(destAbs) ? fileContentHash(destAbs) : undefined;
    const relation = classifyRelation({
      lastCanonical: last?.lastCanonical,
      lastExternal: last?.lastExternal,
      currentCanonical: currentSnapshot,
      currentExternal,
    });

    if (currentSnapshot !== undefined && last === undefined && currentSnapshot !== hash) {
      reports.push({
        path: destPosix,
        identity: entry.identity,
        hash,
        action: "skipped",
        reason: "unmanaged",
      });
      continue;
    }
    if (relation === "conflict") {
      reports.push({
        path: destPosix,
        identity: entry.identity,
        hash,
        action: "conflict",
        reason: "conflict",
      });
      continue;
    }
    if (relation === "canonical-changed") {
      reports.push({
        path: destPosix,
        identity: entry.identity,
        hash,
        action: "skipped",
        reason: "canonical-changed",
      });
      continue;
    }
    if (currentSnapshot === hash) {
      reports.push({ path: destPosix, identity: entry.identity, hash, action: "unchanged" });
      state = upsertEntry(state, "source", id, {
        path: relativePath,
        identity: entry.identity,
        lastCanonical: hash,
        lastExternal: currentExternal,
      });
      continue;
    }
    if (!dryRun) {
      writeFileAtomic(destAbs, text);
    }
    reports.push({ path: destPosix, identity: entry.identity, hash, action: "written" });
    if (!dryRun) {
      state = upsertEntry(state, "source", id, {
        path: relativePath,
        identity: entry.identity,
        lastCanonical: hash,
        lastExternal: currentExternal,
      });
    }
  }

  reports.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const written = reports.filter((item) => item.action === "written").map((item) => item.path);
  const unchanged = reports.filter((item) => item.action === "unchanged").map((item) => item.path);
  const conflicts = reports.filter((item) => item.action === "conflict").map((item) => item.path);
  const skipped = reports.filter((item) => item.action === "skipped" || item.action === "conflict");
  const ok = conflicts.length === 0 && !skipped.some((item) => item.reason === "unmanaged");

  if (!dryRun) {
    writeImportIndex(
      destRoot,
      source,
      reports.filter((item) => item.action === "written" || item.action === "unchanged"),
    );
    saveSyncState(snapshot.active.root, state);
    assertSourceUntouched(source, liveFingerprint);
  }

  return {
    specVersion: SPEC_VERSION,
    command: "import",
    ok,
    dryRun,
    source: {
      kind: "source",
      id: source.id,
      type: source.type,
      path: source.declaredPath,
    },
    written,
    unchanged,
    skipped,
    conflicts,
    files: reports,
  };
}

export function loadWorkspace(startDir: string): EffectiveSnapshot {
  const discovered = discoverScope(startDir);
  if (discovered === undefined) {
    throw new AiwError("NOT_FOUND", `No .ai/manifest.yaml found from ${startDir}.`, {
      suggestion: "Run `aiw init` in the project directory.",
    });
  }
  return resolveFrom(discovered.root);
}

export function requireRegisteredSource(snapshot: EffectiveSnapshot, id: string): ResolvedSource {
  const source = snapshot.sources.find((item) => item.id === id);
  if (source === undefined) {
    throw new AiwError("VALIDATION", `Source '${id}' is not registered.`, {
      suggestion: "Run `aiw source add` before importing.",
    });
  }
  return source;
}

export function assertSourceReady(source: ResolvedSource): void {
  if (source.status === "unresolved") {
    throw new AiwError("VALIDATION", `Source '${source.id}' is unresolved.`, {
      suggestion: `Source path '${source.declaredPath}' does not exist.`,
    });
  }
  if (source.status === "invalid") {
    throw new AiwError(
      "VALIDATION",
      `Source '${source.id}' is invalid${source.invalidReason ? `: ${source.invalidReason}` : "."}`,
    );
  }
  if (!pathExists(source.resolvedPath)) {
    throw new AiwError("NOT_FOUND", `Source '${source.id}' path is missing.`, {
      suggestion: `Expected ${source.declaredPath}.`,
    });
  }
}

export function snapshotDestRoot(scopeRoot: string, sourceId: string): string {
  return path.join(scopeRoot, AI_DIR_NAME, "sources", sourceId);
}

export function sourceFileAbsolute(source: ResolvedSource, relativePath: string): string {
  if (source.type === "file" || isFile(source.resolvedPath)) {
    return source.resolvedPath;
  }
  return resolveFromBase(source.resolvedPath, relativePath);
}

export function requireSourceId(id: string | undefined, operation: string): string {
  if (id === undefined || id.trim() === "") {
    throw new AiwError("USAGE", `Usage: aiw ${operation} --source <id>.`);
  }
  return id;
}

function skipReport(pathValue: string, identity: string, reason: string): ImportFileReport {
  return { path: pathValue, identity, hash: "", action: "skipped", reason };
}

function isSensitivePath(relativePosixPath: string, absolutePath: string, exclusions: readonly string[]): boolean {
  if (isExcluded(relativePosixPath, exclusions)) {
    return true;
  }
  return isExcluded(posixBasename(absolutePath), exclusions);
}

export function readImportableText(
  absolutePath: string,
  maxFileBytes: number,
): { text: string; skipped?: string } {
  if (!isFile(absolutePath)) {
    return { text: "", skipped: "missing" };
  }
  let size: number;
  try {
    size = fileSize(absolutePath);
  } catch {
    return { text: "", skipped: "inaccessible" };
  }
  if (size > maxFileBytes) {
    return { text: "", skipped: "too-large" };
  }
  let prefix: Buffer;
  try {
    prefix = readFilePrefix(absolutePath, BINARY_SNIFF_BYTES);
  } catch {
    return { text: "", skipped: "inaccessible" };
  }
  if (isBinaryBuffer(prefix)) {
    return { text: "", skipped: "binary" };
  }
  const bytes = readFileBytes(absolutePath);
  return { text: normalizeNewlines(bytes.toString("utf8")) };
}

function writeImportIndex(destRoot: string, source: ResolvedSource, files: ImportFileReport[]): void {
  const payload = {
    specVersion: 1,
    kind: "import-snapshot",
    source: {
      kind: "source",
      id: source.id,
      type: source.type,
      path: source.declaredPath,
    },
    files: files
      .map((file) => ({
        path: snapshotRelative(file.path, source.id),
        identity: file.identity,
        hash: file.hash,
      }))
      .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)),
  };
  const text = stringify(payload, { sortMapEntries: true, lineWidth: 0, indent: 2 });
  writeFileAtomic(path.join(destRoot, IMPORT_META_NAME), text.endsWith("\n") ? text : `${text}\n`);
}

function snapshotRelative(posixPath: string, sourceId: string): string {
  const prefix = `.ai/sources/${sourceId}/`;
  return posixPath.startsWith(prefix) ? posixPath.slice(prefix.length) : posixPath;
}

function assertSourceUntouched(
  source: ResolvedSource,
  fingerprint: readonly { path: string; hash: string }[],
): void {
  for (const entry of fingerprint) {
    const abs = sourceFileAbsolute(source, entry.path);
    const current = fileContentHash(abs);
    if (current !== undefined && current !== entry.hash) {
      throw new AiwError("IO", `Import mutated live source file '${entry.path}'.`);
    }
  }
}
