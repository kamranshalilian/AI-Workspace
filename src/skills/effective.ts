import fs from "node:fs";
import { comparePosix } from "../filesystem/paths.js";
import type { EffectiveSnapshot, ResolvedResource } from "../resolution/types.js";
import { parseStandardSkillIdentity, skillArtifactIdentity } from "./identity.js";
import { parseSkillMarkdown } from "./parse.js";
import type { EffectiveSkillSet, SkillRecord } from "./types.js";

/**
 * Derive the Effective Skill Set from an already-resolved snapshot.
 * Inheritance, exclude, replace, and disable are applied by resolution.
 * This function does not scan the filesystem or execute Skills.
 */
export function effectiveSkillSet(snapshot: EffectiveSnapshot): EffectiveSkillSet {
  const skills: SkillRecord[] = [];
  for (const resource of snapshot.resources) {
    const parsed = parseStandardSkillIdentity(resource.identity);
    if (parsed === undefined) {
      continue;
    }
    skills.push(skillRecordFromResource(resource, parsed.id));
  }
  skills.sort((a, b) => comparePosix(a.id, b.id));
  return { skills };
}

function skillRecordFromResource(resource: ResolvedResource, id: string): SkillRecord {
  const text = fs.readFileSync(resource.absolutePath, "utf8");
  const artifact = parseSkillMarkdown(text);
  return {
    id,
    name: artifact.name,
    description: artifact.description,
    version: artifact.version,
    source: {
      type: "canonical",
      path: skillArtifactIdentity(id),
    },
    provenance: {
      identity: resource.identity,
      originName: resource.originName,
      originRoot: resource.originRoot,
      hash: resource.hash,
      canonical: true,
    },
    trust: "untrusted",
    dependencies: [],
  };
}
