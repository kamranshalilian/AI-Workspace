import type {
  ADAPTER_STRATEGIES,
  INHERITANCE_MODES,
  SCOPE_KINDS,
  SOURCE_CAPABILITIES,
  SOURCE_TYPES,
} from "../config/constants.js";

export type ScopeKind = (typeof SCOPE_KINDS)[number];
export type InheritanceMode = (typeof INHERITANCE_MODES)[number];
export type AdapterStrategy = (typeof ADAPTER_STRATEGIES)[number];
export type SourceType = (typeof SOURCE_TYPES)[number];
export type SourceCapability = (typeof SOURCE_CAPABILITIES)[number];

export interface ExtendsEntry {
  path: string;
  mode: InheritanceMode;
  exclude: string[];
}

export interface ContextConfig {
  include: string[];
  exclude: string[];
}

export interface SourceConfig {
  type: SourceType;
  path: string;
  capabilities: SourceCapability[];
  include: string[];
  exclude: string[];
}

export interface AgentAdapterConfig {
  strategy: AdapterStrategy;
}

export interface AgentInstance {
  enabled: boolean;
  definition: string;
  adapter: AgentAdapterConfig;
}

/**
 * Manifest Skill registry entry. Metadata/reference only.
 * Does not store SKILL.md body, name, or description.
 */
export interface SkillRegistration {
  enabled: boolean;
  /** Federated source id. Undefined means canonical `.ai/skills/<id>/`. */
  source: string | undefined;
}

export interface ProjectRegistration {
  path: string;
}

export interface TrustPolicy {
  executableAdapters: false;
  executableSources: false;
}

export interface Policies {
  exclusions: string[];
  maxFileBytes: number;
  trust: TrustPolicy;
}

export interface Manifest {
  specVersion: 1;
  kind: ScopeKind;
  name: string;
  description: string | undefined;
  extends: ExtendsEntry | undefined;
  context: ContextConfig;
  sources: Record<string, SourceConfig>;
  agents: Record<string, AgentInstance>;
  skills: Record<string, SkillRegistration>;
  projects: Record<string, ProjectRegistration>;
  policies: Policies;
}

export interface ManifestIssue {
  path: string;
  message: string;
}

export interface SchemaValidationSuccess {
  ok: true;
  manifest: Manifest;
}

export interface SchemaValidationFailure {
  ok: false;
  issues: ManifestIssue[];
}

export type SchemaValidationResult = SchemaValidationSuccess | SchemaValidationFailure;
