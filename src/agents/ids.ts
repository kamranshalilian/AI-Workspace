import path from "node:path";
import { AGENT_ID_MAX_LENGTH, AGENT_ID_PATTERN } from "../config/constants.js";
import { AiwError } from "../core/errors.js";

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/**
 * Validate a logical Agent ID before any path is constructed.
 * Does not rely on path.resolve() to catch traversal or absolute paths.
 */
export function assertValidAgentId(id: string): string {
  if (id.trim() === "") {
    throw new AiwError("USAGE", "Agent id is required.", {
      suggestion: "Usage: aiw agent create <id>.",
    });
  }
  if (id !== id.trim()) {
    throw new AiwError("USAGE", `Invalid agent id '${id}'.`, {
      suggestion: "IDs cannot have leading or trailing whitespace.",
    });
  }
  if (id.includes("\0")) {
    throw new AiwError("USAGE", "Invalid agent id: null bytes are not allowed.");
  }
  if (id.includes("/") || id.includes("\\")) {
    throw new AiwError("USAGE", `Invalid agent id '${id}': path separators are not allowed.`, {
      suggestion: "Use a portable id matching [a-z0-9][a-z0-9._-]*.",
    });
  }
  if (id.includes(":")) {
    throw new AiwError("USAGE", `Invalid agent id '${id}': absolute or drive-qualified paths are not allowed.`, {
      suggestion: "Use a portable id matching [a-z0-9][a-z0-9._-]*.",
    });
  }
  if (id === "." || id === "..") {
    throw new AiwError("USAGE", `Invalid agent id '${id}': '.' and '..' are not allowed.`);
  }
  if (id.startsWith(".") || id.startsWith("..") || id.includes("..")) {
    throw new AiwError("USAGE", `Invalid agent id '${id}': path traversal is not allowed.`);
  }
  if (id.length > AGENT_ID_MAX_LENGTH) {
    throw new AiwError(
      "USAGE",
      `Invalid agent id '${id}': must be at most ${AGENT_ID_MAX_LENGTH} characters.`,
    );
  }
  if (!AGENT_ID_PATTERN.test(id)) {
    throw new AiwError("USAGE", `Invalid agent id '${id}'.`, {
      suggestion: "Use a portable id matching [a-z0-9][a-z0-9._-]*.",
    });
  }
  if (WINDOWS_RESERVED.test(id)) {
    throw new AiwError("USAGE", `Invalid agent id '${id}': reserved Windows device names are not allowed.`);
  }
  return id;
}

export function isValidAgentId(id: string): boolean {
  try {
    assertValidAgentId(id);
    return true;
  } catch {
    return false;
  }
}

export function displayNameFromId(id: string): string {
  return id
    .split(/[-._]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Join a validated id onto an agents directory and prove the result cannot escape. */
export function agentDefinitionFile(agentsDir: string, id: string): string {
  const safeId = assertValidAgentId(id);
  const dest = path.join(agentsDir, `${safeId}.yaml`);
  if (path.basename(dest) !== `${safeId}.yaml`) {
    throw new AiwError("USAGE", `Invalid agent id '${id}': would not produce a safe filename.`);
  }
  const rel = path.relative(path.resolve(agentsDir), path.resolve(dest));
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel) || rel.split(path.sep).length !== 1) {
    throw new AiwError("USAGE", `Invalid agent id '${id}': path traversal is not allowed.`);
  }
  return dest;
}
