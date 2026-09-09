import { parseYamlDocument } from "../manifest/parse.js";
import { AiwError } from "../core/errors.js";
import type { SkillArtifact } from "./types.js";

/**
 * Parse a standard Agent Skills SKILL.md.
 * Requires `name` and `description`. Unknown frontmatter keys are kept as extras.
 * Does not execute scripts or interpret vendor-specific fields.
 */
export function parseSkillMarkdown(text: string): SkillArtifact {
  const normalized = text.replace(/^\uFEFF/, "").replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (match === null) {
    throw new AiwError("VALIDATION", "SKILL.md must start with Agent Skills YAML frontmatter (name, description).");
  }
  const raw = parseYamlDocument(match[1] ?? "");
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new AiwError("VALIDATION", "SKILL.md frontmatter must be a YAML mapping.");
  }
  const record = raw as Record<string, unknown>;
  const name = record["name"];
  const description = record["description"];
  if (typeof name !== "string" || name.trim() === "") {
    throw new AiwError("VALIDATION", "SKILL.md frontmatter requires a non-empty string 'name'.");
  }
  if (typeof description !== "string" || description.trim() === "") {
    throw new AiwError("VALIDATION", "SKILL.md frontmatter requires a non-empty string 'description'.");
  }
  const extras: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    if (key === "name" || key === "description") {
      continue;
    }
    extras[key] = record[key];
  }
  const version = optionalVersion(extras);
  return {
    name: name.trim(),
    description: description.trim(),
    version,
    extras,
    body: match[2] ?? "",
  };
}

function optionalVersion(extras: Record<string, unknown>): string | undefined {
  const metadata = extras["metadata"];
  if (metadata !== null && typeof metadata === "object" && !Array.isArray(metadata)) {
    const version = (metadata as Record<string, unknown>)["version"];
    if (typeof version === "string" && version.trim() !== "") {
      return version.trim();
    }
  }
  const top = extras["version"];
  if (typeof top === "string" && top.trim() !== "") {
    return top.trim();
  }
  return undefined;
}
