import { SKILL_ARTIFACT_BASENAME, SKILL_ID_PATTERN, SKILL_KIND } from "../config/constants.js";

export function skillArtifactIdentity(id: string): string {
  return `${SKILL_KIND}/${id}/${SKILL_ARTIFACT_BASENAME}`;
}

/**
 * Directory-layout Agent Skills artifact: skills/<id>/SKILL.md
 * Flat files such as skills/notes.md remain generic resources.
 */
export function parseStandardSkillIdentity(identity: string): { id: string } | undefined {
  const prefix = `${SKILL_KIND}/`;
  const suffix = `/${SKILL_ARTIFACT_BASENAME}`;
  if (!identity.startsWith(prefix) || !identity.endsWith(suffix)) {
    return undefined;
  }
  const id = identity.slice(prefix.length, identity.length - suffix.length);
  if (id.includes("/") || !SKILL_ID_PATTERN.test(id)) {
    return undefined;
  }
  return { id };
}

export function isStandardSkillArtifact(identity: string): boolean {
  return parseStandardSkillIdentity(identity) !== undefined;
}

/** Optional deterministic identity when a version is known. Uses the Skill id, not a new format. */
export function skillVersionIdentity(id: string, version?: string): string {
  if (version === undefined || version.trim() === "") {
    return id;
  }
  return `${id}@${version.trim()}`;
}
