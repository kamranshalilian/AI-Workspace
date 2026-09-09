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
 * Phase 7A does not add Skill CLI. These operations already exist as generic
 * workspace mechanisms. Dedicated Skill lifecycle commands remain planned.
 */
export const SKILL_OPERATIONS_VIA_EXISTING_MECHANISMS = [
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
  "register",
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
}

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
