/**
 * Governance and interoperability types for Agent Skills.
 * This is not a proprietary Skill format. SKILL.md remains the artifact.
 */

export const SKILL_TRUST_LEVELS = ["untrusted", "reviewed", "trusted"] as const;
export type SkillTrust = (typeof SKILL_TRUST_LEVELS)[number];

export const SKILL_LIFECYCLE_OPERATIONS = [
  "discover",
  "register",
  "validate",
  "trust",
  "enable",
  "disable",
  "import",
  "export",
  "update",
  "remove",
] as const;
export type SkillLifecycleOperation = (typeof SKILL_LIFECYCLE_OPERATIONS)[number];

/**
 * Phase 7A does not add Skill CLI. Register is a manifest `skills:` entry.
 * Dedicated Skill lifecycle commands remain planned.
 */
export const SKILL_OPERATIONS_VIA_EXISTING_MECHANISMS = [
  "register",
  "validate",
  "enable",
  "disable",
  "import",
  "export",
  "update",
  "remove",
] as const satisfies readonly SkillLifecycleOperation[];

export const SKILL_OPERATIONS_PLANNED = [
  "discover",
  "trust",
] as const satisfies readonly SkillLifecycleOperation[];

export interface SkillSourceRef {
  type: "canonical" | "federated";
  /** Federated source id when type is federated. */
  id?: string;
  path: string;
}

export interface SkillProvenance {
  identity: string;
  originName: string;
  originRoot: string;
  hash: string;
  canonical: boolean;
  /** Derived from existing origin/source data. Not a second provenance system. */
  kind: SkillOriginKind;
}

export type SkillOriginKind = "canonical" | "inherited" | "external";

export const SKILL_REGISTRY_STATUSES = ["resolved", "missing", "invalid", "disabled"] as const;
export type SkillRegistryStatus = (typeof SKILL_REGISTRY_STATUSES)[number];

export interface SkillDependency {
  id: string;
  version?: string;
}

export interface SkillRecord {
  id: string;
  name: string;
  description: string;
  version?: string;
  source: SkillSourceRef;
  provenance: SkillProvenance;
  trust: SkillTrust;
  dependencies: SkillDependency[];
}

export interface SkillRegistryEntry {
  id: string;
  enabled: boolean;
  status: SkillRegistryStatus;
  source: SkillSourceRef;
  originKind: SkillOriginKind;
  originName: string;
  originRoot: string;
  /** Agent Skills frontmatter name when the artifact parsed. May differ from id. */
  artifactName?: string;
  version?: string;
  versionIdentity: string;
  invalidReason?: string;
  provenance?: SkillProvenance;
}

export interface SkillRegistry {
  entries: SkillRegistryEntry[];
}

export interface SkillArtifact {
  name: string;
  description: string;
  version?: string;
  /** Additive Agent Skills frontmatter not interpreted by Core. */
  extras: Record<string, unknown>;
  body: string;
}

export interface EffectiveSkillSet {
  skills: SkillRecord[];
}
