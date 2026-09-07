import path from "node:path";

/** Convert mixed slashes to POSIX for manifests, identities, and globs. */
export function toPosixPath(input: string): string {
  return input.replaceAll("\\", "/");
}

/** Convert a POSIX or mixed path to a platform-native path. */
export function toNativePath(input: string): string {
  const posix = toPosixPath(input);
  if (path.sep === "/") {
    return posix;
  }
  if (/^[a-zA-Z]:\//.test(posix)) {
    return posix.replaceAll("/", path.sep);
  }
  if (posix.startsWith("//")) {
    return posix.replaceAll("/", path.sep);
  }
  return posix.replaceAll("/", path.sep);
}

/** Join a base directory with a POSIX (or mixed) relative/absolute path. */
export function resolveFromBase(baseDir: string, declaredPath: string): string {
  const posix = toPosixPath(declaredPath);
  const nativeDeclared = toNativePath(posix);
  if (path.isAbsolute(nativeDeclared)) {
    return path.resolve(nativeDeclared);
  }
  return path.resolve(baseDir, nativeDeclared);
}

export function posixBasename(posixPath: string): string {
  const normalized = toPosixPath(posixPath).replace(/\/+$/, "");
  const parts = normalized.split("/");
  return parts[parts.length - 1] ?? normalized;
}

export function posixDirname(posixPath: string): string {
  const normalized = toPosixPath(posixPath).replace(/\/+$/, "");
  const index = normalized.lastIndexOf("/");
  if (index <= 0) {
    return index === 0 ? "/" : ".";
  }
  return normalized.slice(0, index);
}

export function posixJoin(...parts: string[]): string {
  return parts
    .map((part) => toPosixPath(part).replace(/^\/+|\/+$/g, ""))
    .filter((part) => part.length > 0)
    .join("/");
}

export function comparePosix(a: string, b: string): number {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

export function relativePosix(fromDir: string, toPath: string): string {
  return toPosixPath(path.relative(fromDir, toPath));
}

/**
 * True when `target` is the same as `root` or a descendant of `root`.
 * Uses resolved native paths. Does not require the target to exist.
 */
export function isInsideOrEqual(root: string, target: string): boolean {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  const rel = path.relative(resolvedRoot, resolvedTarget);
  if (rel === "") {
    return true;
  }
  return !rel.startsWith("..") && !path.isAbsolute(rel);
}

/** True when `target` is a descendant of `root` (not the root itself). */
export function isStrictDescendant(root: string, target: string): boolean {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  const rel = path.relative(resolvedRoot, resolvedTarget);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

export function firstPosixSegment(posixPath: string): string {
  const trimmed = toPosixPath(posixPath).replace(/^\/+/, "");
  const slash = trimmed.indexOf("/");
  return slash === -1 ? trimmed : trimmed.slice(0, slash);
}
