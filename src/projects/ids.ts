import { PROJECT_ID_MAX_LENGTH, PROJECT_ID_PATTERN } from "../config/constants.js";
import { AiwError } from "../core/errors.js";

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/**
 * Validate a logical project ID. IDs are registry keys, not filesystem paths.
 */
export function assertValidProjectId(id: string): string {
  if (id.trim() === "") {
    throw new AiwError("USAGE", "Project id is required.", {
      suggestion: "Usage: aiw project add <id> <path>.",
    });
  }
  if (id !== id.trim()) {
    throw new AiwError("USAGE", `Invalid project id '${id}'.`, {
      suggestion: "IDs cannot have leading or trailing whitespace.",
    });
  }
  if (id.includes("\0")) {
    throw new AiwError("USAGE", "Invalid project id: null bytes are not allowed.");
  }
  if (id.includes("/") || id.includes("\\")) {
    throw new AiwError("USAGE", `Invalid project id '${id}': path separators are not allowed.`, {
      suggestion: "Use a portable id matching [a-z0-9][a-z0-9._-]*.",
    });
  }
  if (id.includes(":")) {
    throw new AiwError("USAGE", `Invalid project id '${id}': absolute or drive-qualified paths are not allowed.`, {
      suggestion: "Use a portable id matching [a-z0-9][a-z0-9._-]*.",
    });
  }
  if (id === "." || id === "..") {
    throw new AiwError("USAGE", `Invalid project id '${id}': '.' and '..' are not allowed.`);
  }
  if (id.startsWith(".") || id.includes("..")) {
    throw new AiwError("USAGE", `Invalid project id '${id}': path traversal is not allowed.`);
  }
  if (id.length > PROJECT_ID_MAX_LENGTH) {
    throw new AiwError(
      "USAGE",
      `Invalid project id '${id}': must be at most ${PROJECT_ID_MAX_LENGTH} characters.`,
    );
  }
  if (!PROJECT_ID_PATTERN.test(id)) {
    throw new AiwError("USAGE", `Invalid project id '${id}'.`, {
      suggestion: "Use a portable id matching [a-z0-9][a-z0-9._-]*.",
    });
  }
  if (WINDOWS_RESERVED.test(id)) {
    throw new AiwError("USAGE", `Invalid project id '${id}': reserved Windows device names are not allowed.`);
  }
  return id;
}

export function isValidProjectId(id: string): boolean {
  try {
    assertValidProjectId(id);
    return true;
  } catch {
    return false;
  }
}
