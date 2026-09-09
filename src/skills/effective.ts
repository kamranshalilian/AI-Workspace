import fs from "node:fs";
import { comparePosix } from "../filesystem/paths.js";
import type { EffectiveSnapshot, ResolvedResource } from "../resolution/types.js";
import { parseStandardSkillIdentity, skillArtifactIdentity } from "./identity.js";
import { tryParseSkillMarkdown } from "./parse.js";
import { resourceOriginKind, skillRegistry } from "./registry.js";
import type { EffectiveSkillSet, SkillRecord } from "./types.js";

/**
 * Derive the Effective Skill Set from an already-resolved snapshot.
 * Inheritance, exclude, replace, and disable (resources + registry) are applied
 * by resolution. This function does not scan the filesystem or execute Skills.
 *
 * Canonical `SKILL.md` files remain effective when unregistered (additive registry).
 * Registry `enabled: false` removes a Skill from the set. Invalid artifacts are omitted.
 * Federated Skills are never copied into the set.
 */
export function effectiveSkillSet(snapshot: EffectiveSnapshot): EffectiveSkillSet {
  const disabled = new Set(
    skillRegistry(snapshot)
      .entries.filter((entry) => entry.status === "disabled" || !entry.enabled)
      .map((entry) => entry.id),
  );
  const skills: SkillRecord[] = [];
  for (const resource of snapshot.resources) {
    const parsedId = parseStandardSkillIdentity(resource.identity);
    if (parsedId === undefined || disabled.has(parsedId.id)) {
      continue;
    }
    const record = skillRecordFromResource(snapshot, resource, parsedId.id);
    if (record !== undefined) {
      skills.push(record);
    }
  }
  skills.sort((a, b) => comparePosix(a.id, b.id));
  return { skills };
}

function skillRecordFromResource(
  snapshot: EffectiveSnapshot,
  resource: ResolvedResource,
  id: string,
): SkillRecord | undefined {
  let text: string;
  try {
    text = fs.readFileSync(resource.absolutePath, "utf8");
  } catch {
    return undefined;
  }
  const parsed = tryParseSkillMarkdown(text);
  if (!parsed.ok) {
    return undefined;
  }
  const kind = resourceOriginKind(snapshot, resource);
  return {
    id,
    name: parsed.artifact.name,
    description: parsed.artifact.description,
    version: parsed.artifact.version,
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
      kind,
    },
    trust: "untrusted",
    dependencies: [],
  };
}
