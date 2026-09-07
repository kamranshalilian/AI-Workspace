import { posixBasename, toPosixPath } from "../filesystem/paths.js";
import { AiwError } from "../core/errors.js";

export function normalizeDeclaredSourcePath(input: string): string {
  if (input.trim() === "") {
    throw new AiwError("USAGE", "Source path is required.", {
      suggestion: "Usage: aiw source add <id> --type <type> --path <path>.",
    });
  }
  if (input.includes("\0")) {
    throw new AiwError("USAGE", "Invalid source path: null bytes are not allowed.");
  }
  const posix = toPosixPath(input.trim());
  if (posix === "") {
    throw new AiwError("USAGE", "Source path is required.");
  }
  return posix;
}

export function sourceIdentity(id: string, relativePath: string): string {
  return `source:${id}:${toPosixPath(relativePath)}`;
}

export function sourceFileLabel(absolutePath: string): string {
  return posixBasename(absolutePath);
}
