export { classifyRelation } from "./compare.js";
export { contentHash, contentHashFromBytes, fileContentHash, formatHash, logicalPath, normalizeNewlines, treeIdentity } from "./identity.js";
export { emptySyncState, getEntry, loadSyncState, saveSyncState, syncStatePath, upsertEntry } from "./store.js";
export type {
  ClassifyInput,
  ContentEntry,
  RelationKind,
  RelationState,
  SyncEntry,
  SyncRelation,
  SyncStateFile,
} from "./types.js";
export { RELATION_STATES } from "./types.js";
