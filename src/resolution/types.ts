import type { AdapterStrategy, InheritanceMode, Manifest, ScopeKind } from "../manifest/types.js";

export type IssueSeverity = "error" | "warning" | "info";

export interface SnapshotIssue {
  severity: IssueSeverity;
  code: string;
  message: string;
  path?: string;
  suggestion?: string;
}

export interface ChainEntry {
  kind: ScopeKind;
  name: string;
  root: string;
  mode: InheritanceMode | "root";
}

export interface ResolvedResource {
  identity: string;
  kind: string;
  relativePath: string;
  absolutePath: string;
  originRoot: string;
  originName: string;
  hash: string;
}

export interface ResolvedSource {
  id: string;
  type: string;
  declaredPath: string;
  resolvedPath: string;
  originRoot: string;
  originName: string;
  capabilities: string[];
  status: "ok" | "unresolved";
}

export interface ResolvedAgent {
  id: string;
  definitionId: string;
  enabled: boolean;
  strategy: AdapterStrategy;
  originRoot: string;
  originName: string;
}

export interface ResolvedProject {
  id: string;
  path: string;
  resolvedPath: string;
  status: "ok" | "missing";
}

export interface EffectivePolicies {
  exclusions: string[];
  maxFileBytes: number;
  trust: {
    executableAdapters: false;
    executableSources: false;
  };
}

export interface EffectiveSnapshot {
  specVersion: 1;
  active: {
    kind: ScopeKind;
    name: string;
    root: string;
    manifestPath: string;
  };
  chain: ChainEntry[];
  inheritance: {
    mode: InheritanceMode | "none";
    parent: { kind: ScopeKind; name: string; root: string } | undefined;
    declaredPath: string | undefined;
  };
  resources: ResolvedResource[];
  sources: ResolvedSource[];
  agents: ResolvedAgent[];
  projects: ResolvedProject[];
  policies: EffectivePolicies;
  issues: SnapshotIssue[];
  skipped: SnapshotIssue[];
}

export interface LoadedScope {
  root: string;
  aiDir: string;
  manifestPath: string;
  realRoot: string;
  manifest: Manifest;
}
