import fs from "node:fs";
import path from "node:path";
import { stringify } from "yaml";
import { AI_DIR_NAME } from "../config/constants.js";
import { isFile, writeFileAtomic } from "../filesystem/io.js";
import { parseYamlDocument } from "../manifest/parse.js";
import type { RelationKind, SyncEntry, SyncRelation, SyncStateFile } from "./types.js";

const STATE_DIR = "state";
const STATE_FILE = "sync.yaml";

export function syncStatePath(scopeRoot: string): string {
  return path.join(scopeRoot, AI_DIR_NAME, STATE_DIR, STATE_FILE);
}

export function emptySyncState(): SyncStateFile {
  return {
    specVersion: 1,
    kind: "sync-state",
    relations: [],
  };
}

export function loadSyncState(scopeRoot: string): SyncStateFile {
  const filePath = syncStatePath(scopeRoot);
  if (!isFile(filePath)) {
    return emptySyncState();
  }
  const parsed = parseYamlDocument(fs.readFileSync(filePath, "utf8"));
  return normalizeState(parsed);
}

export function saveSyncState(scopeRoot: string, state: SyncStateFile, dryRun = false): void {
  if (dryRun) {
    return;
  }
  const sorted = sortState(state);
  const text = stringify(sorted, {
    sortMapEntries: true,
    lineWidth: 0,
    indent: 2,
  });
  const withNewline = text.endsWith("\n") ? text : `${text}\n`;
  writeFileAtomic(syncStatePath(scopeRoot), withNewline);
}

export function getEntry(
  state: SyncStateFile,
  kind: RelationKind,
  id: string,
  posixPath: string,
): SyncEntry | undefined {
  const relation = state.relations.find((item) => item.kind === kind && item.id === id);
  return relation?.entries.find((entry) => entry.path === posixPath);
}

export function upsertEntry(
  state: SyncStateFile,
  kind: RelationKind,
  id: string,
  entry: SyncEntry,
): SyncStateFile {
  const relations = [...state.relations];
  const index = relations.findIndex((item) => item.kind === kind && item.id === id);
  if (index === -1) {
    relations.push({ kind, id, entries: [entry] });
    return { ...state, relations };
  }
  const current = relations[index];
  if (current === undefined) {
    relations.push({ kind, id, entries: [entry] });
    return { ...state, relations };
  }
  const entries = current.entries.filter((item) => item.path !== entry.path);
  entries.push(entry);
  relations[index] = { ...current, entries };
  return { ...state, relations };
}

function sortState(state: SyncStateFile): SyncStateFile {
  const relations = state.relations
    .map((relation) => ({
      ...relation,
      entries: [...relation.entries].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)),
    }))
    .sort((a, b) => {
      if (a.kind !== b.kind) {
        return a.kind < b.kind ? -1 : 1;
      }
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
  return {
    specVersion: 1,
    kind: "sync-state",
    relations,
  };
}

function normalizeState(value: unknown): SyncStateFile {
  if (!isPlainObject(value) || value["specVersion"] !== 1 || value["kind"] !== "sync-state") {
    return emptySyncState();
  }
  const relationsRaw = value["relations"];
  if (!Array.isArray(relationsRaw)) {
    return emptySyncState();
  }
  const relations: SyncRelation[] = [];
  for (const item of relationsRaw) {
    if (!isPlainObject(item)) {
      continue;
    }
    const kind = item["kind"];
    const id = item["id"];
    if ((kind !== "source" && kind !== "agent") || typeof id !== "string") {
      continue;
    }
    const entriesRaw = item["entries"];
    const entries: SyncEntry[] = [];
    if (Array.isArray(entriesRaw)) {
      for (const entry of entriesRaw) {
        if (!isPlainObject(entry) || typeof entry["path"] !== "string" || typeof entry["identity"] !== "string") {
          continue;
        }
        const lastCanonical = typeof entry["lastCanonical"] === "string" ? entry["lastCanonical"] : undefined;
        const lastExternal = typeof entry["lastExternal"] === "string" ? entry["lastExternal"] : undefined;
        entries.push({
          path: entry["path"],
          identity: entry["identity"],
          lastCanonical,
          lastExternal,
        });
      }
    }
    relations.push({ kind, id, entries });
  }
  return sortState({ specVersion: 1, kind: "sync-state", relations });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
