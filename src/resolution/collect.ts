import { BINARY_SNIFF_BYTES, RESERVED_AI_NAMES } from "../config/constants.js";
import { isExcluded, matchesAnyGlob } from "../filesystem/exclusions.js";
import {
  fileSize,
  isBinaryBuffer,
  readFileBytes,
  readFilePrefix,
  sha256,
  walkFiles,
} from "../filesystem/io.js";
import { firstPosixSegment, posixDirname } from "../filesystem/paths.js";
import type { Manifest } from "../manifest/types.js";
import type { LoadedScope, ResolvedResource, SnapshotIssue } from "./types.js";

export function collectResources(
  scope: LoadedScope,
  exclusions: readonly string[],
  maxFileBytes: number,
): { resources: ResolvedResource[]; skipped: SnapshotIssue[] } {
  const files = walkFiles(scope.aiDir);
  const resources: ResolvedResource[] = [];
  const skipped: SnapshotIssue[] = [];

  for (const file of files) {
    const relativePosix = file.relativePosix;
    if (isReservedRelative(relativePosix)) {
      continue;
    }
    if (!matchesAnyGlob(relativePosix, scope.manifest.context.include)) {
      continue;
    }
    if (matchesAnyGlob(relativePosix, scope.manifest.context.exclude)) {
      continue;
    }
    if (isExcluded(relativePosix, exclusions)) {
      skipped.push({
        severity: "warning",
        code: "EXCLUDED",
        message: `Skipped '${relativePosix}' because it matches a security exclusion.`,
        path: relativePosix,
        suggestion: "Move secrets out of .ai/. Canonical files are intended to be committed.",
      });
      continue;
    }

    let size: number;
    try {
      size = fileSize(file.absolutePath);
    } catch {
      skipped.push({
        severity: "warning",
        code: "INACCESSIBLE",
        message: `Unable to read '${relativePosix}'.`,
        path: relativePosix,
      });
      continue;
    }
    if (size > maxFileBytes) {
      skipped.push({
        severity: "warning",
        code: "TOO_LARGE",
        message: `Skipped '${relativePosix}' (${size} bytes) because it exceeds maxFileBytes (${maxFileBytes}).`,
        path: relativePosix,
      });
      continue;
    }

    let prefix: Buffer;
    try {
      prefix = readFilePrefix(file.absolutePath, BINARY_SNIFF_BYTES);
    } catch {
      skipped.push({
        severity: "warning",
        code: "INACCESSIBLE",
        message: `Unable to read '${relativePosix}'.`,
        path: relativePosix,
      });
      continue;
    }
    if (isBinaryBuffer(prefix)) {
      skipped.push({
        severity: "warning",
        code: "BINARY",
        message: `Skipped binary file '${relativePosix}'.`,
        path: relativePosix,
      });
      continue;
    }

    const bytes = readFileBytes(file.absolutePath);
    const kind = firstPosixSegment(relativePosix);
    const relativePath =
      posixDirname(relativePosix) === "." ? relativePosix : relativePosix.slice(kind.length + 1);
    resources.push({
      identity: relativePosix,
      kind,
      relativePath,
      absolutePath: file.absolutePath,
      originRoot: scope.root,
      originName: scope.manifest.name,
      hash: sha256(bytes),
    });
  }

  resources.sort((a, b) => (a.identity < b.identity ? -1 : a.identity > b.identity ? 1 : 0));
  return { resources, skipped };
}

function isReservedRelative(relativePosix: string): boolean {
  if (relativePosix === "manifest.yaml") {
    return true;
  }
  const first = firstPosixSegment(relativePosix);
  return (RESERVED_AI_NAMES as readonly string[]).includes(first);
}

export function mergeExclusions(manifests: readonly Manifest[]): string[] {
  const set = new Set<string>();
  for (const manifest of manifests) {
    for (const pattern of manifest.policies.exclusions) {
      set.add(pattern);
    }
  }
  return [...set].sort();
}

export function mergeMaxFileBytes(manifests: readonly Manifest[]): number {
  let min = Number.POSITIVE_INFINITY;
  for (const manifest of manifests) {
    min = Math.min(min, manifest.policies.maxFileBytes);
  }
  return Number.isFinite(min) ? min : 0;
}
