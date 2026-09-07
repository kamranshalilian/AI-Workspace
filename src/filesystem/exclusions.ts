import { minimatch } from "minimatch";
import { posixBasename, toPosixPath } from "./paths.js";

const MATCH_OPTIONS = {
  dot: true,
  nocase: true,
  nocomment: true,
  nonegate: true,
} as const;

export function matchesGlob(posixPath: string, pattern: string): boolean {
  const value = toPosixPath(posixPath);
  const glob = toPosixPath(pattern);
  if (minimatch(value, glob, MATCH_OPTIONS)) {
    return true;
  }
  return minimatch(posixBasename(value), glob, MATCH_OPTIONS);
}

export function matchesAnyGlob(posixPath: string, patterns: readonly string[]): boolean {
  for (const pattern of patterns) {
    if (matchesGlob(posixPath, pattern)) {
      return true;
    }
  }
  return false;
}

export function isExcluded(
  posixPath: string,
  patterns: readonly string[],
): boolean {
  return matchesAnyGlob(posixPath, patterns);
}
