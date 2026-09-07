export const RELATION_STATES = [
  "clean",
  "canonical-changed",
  "external-changed",
  "conflict",
] as const;

export type RelationKind = "source" | "agent";
export type RelationState = (typeof RELATION_STATES)[number];

export interface ContentEntry {
  path: string;
  hash: string;
}

export interface SyncEntry {
  path: string;
  identity: string;
  lastCanonical?: string;
  lastExternal?: string;
}

export interface SyncRelation {
  kind: RelationKind;
  id: string;
  entries: SyncEntry[];
}

export interface SyncStateFile {
  specVersion: 1;
  kind: "sync-state";
  relations: SyncRelation[];
}

export interface ClassifyInput {
  lastCanonical?: string;
  lastExternal?: string;
  currentCanonical?: string;
  currentExternal?: string;
}
