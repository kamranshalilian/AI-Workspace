import { AiwError } from "../core/errors.js";
import { toPosixPath } from "../filesystem/paths.js";

/**
 * Normalize a registry path for storage. Relative paths resolve from the
 * workspace root at runtime, not from process.cwd().
 */
export function normalizeDeclaredProjectPath(input: string): string {
  if (input.trim() === "") {
    throw new AiwError("USAGE", "Project path is required.", {
      suggestion: "Usage: aiw project add <id> <path>.",
    });
  }
  if (input.includes("\0")) {
    throw new AiwError("USAGE", "Invalid project path: null bytes are not allowed.");
  }
  const posix = toPosixPath(input.trim());
  if (posix === "") {
    throw new AiwError("USAGE", "Project path is required.");
  }
  return posix;
}
