import { SKILL_ID_MAX_LENGTH, SKILL_ID_PATTERN } from "../config/constants.js";
import { AiwError } from "../core/errors.js";

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/**
 * Validate a Skill registry id. Reuses the portable agent/project id contract.
 * The id is a registry key, not a filesystem path.
 */
export function assertValidSkillId(id: string): string {
  if (id.trim() === "") {
    throw new AiwError("USAGE", "Skill id is required.");
  }
  if (id !== id.trim()) {
    throw new AiwError("USAGE", `Invalid skill id '${id}'.`, {
      suggestion: "IDs cannot have leading or trailing whitespace.",
    });
  }
  if (id.includes("\0")) {
    throw new AiwError("USAGE", "Invalid skill id: null bytes are not allowed.");
  }
  if (id.includes("/") || id.includes("\\")) {
    throw new AiwError("USAGE", `Invalid skill id '${id}': path separators are not allowed.`, {
      suggestion: "Use a portable id matching [a-z0-9][a-z0-9._-]*.",
    });
  }
  if (id.includes(":")) {
    throw new AiwError("USAGE", `Invalid skill id '${id}': absolute or drive-qualified paths are not allowed.`, {
      suggestion: "Use a portable id matching [a-z0-9][a-z0-9._-]*.",
    });
  }
  if (id === "." || id === "..") {
    throw new AiwError("USAGE", `Invalid skill id '${id}': '.' and '..' are not allowed.`);
  }
  if (id.startsWith(".") || id.includes("..")) {
    throw new AiwError("USAGE", `Invalid skill id '${id}': path traversal is not allowed.`);
  }
  if (id.length > SKILL_ID_MAX_LENGTH) {
    throw new AiwError(
      "USAGE",
      `Invalid skill id '${id}': must be at most ${SKILL_ID_MAX_LENGTH} characters.`,
    );
  }
  if (!SKILL_ID_PATTERN.test(id)) {
    throw new AiwError("USAGE", `Invalid skill id '${id}'.`, {
      suggestion: "Use a portable id matching [a-z0-9][a-z0-9._-]*.",
    });
  }
  if (WINDOWS_RESERVED.test(id)) {
    throw new AiwError("USAGE", `Invalid skill id '${id}': reserved Windows device names are not allowed.`);
  }
  return id;
}

export function isValidSkillId(id: string): boolean {
  try {
    assertValidSkillId(id);
    return true;
  } catch {
    return false;
  }
}
