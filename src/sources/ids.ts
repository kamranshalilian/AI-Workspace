import { NAME_PATTERN } from "../config/constants.js";
import { AiwError } from "../core/errors.js";

/**
 * Validate a logical Source ID. Source IDs are YAML keys, not filesystem paths.
 */
export function assertValidSourceId(id: string): string {
  if (id.trim() === "") {
    throw new AiwError("USAGE", "Source id is required.", {
      suggestion: "Usage: aiw source add <id> --type <type> --path <path>.",
    });
  }
  if (id !== id.trim()) {
    throw new AiwError("USAGE", `Invalid source id '${id}'.`, {
      suggestion: "IDs cannot have leading or trailing whitespace.",
    });
  }
  if (id.includes("\0") || id.includes("/") || id.includes("\\") || id.includes(":")) {
    throw new AiwError("USAGE", `Invalid source id '${id}': path separators are not allowed.`, {
      suggestion: "Use a portable id matching [a-z0-9][a-z0-9-]*.",
    });
  }
  if (id === "." || id === ".." || id.startsWith(".") || id.includes("..")) {
    throw new AiwError("USAGE", `Invalid source id '${id}': path traversal is not allowed.`);
  }
  if (!NAME_PATTERN.test(id)) {
    throw new AiwError("USAGE", `Invalid source id '${id}'.`, {
      suggestion: "Use a portable id matching [a-z0-9][a-z0-9-]*.",
    });
  }
  return id;
}

export function isValidSourceId(id: string): boolean {
  try {
    assertValidSourceId(id);
    return true;
  } catch {
    return false;
  }
}
