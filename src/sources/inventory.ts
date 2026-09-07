import { isExcluded, matchesAnyGlob } from "../filesystem/exclusions.js";
import { isDirectory, isFile, walkFiles } from "../filesystem/io.js";
import { posixBasename, toPosixPath } from "../filesystem/paths.js";
import type { SourceConfig } from "../manifest/types.js";
import type { SourceInventoryEntry } from "../resolution/types.js";
import { requireCapability } from "./capabilities.js";
import { sourceIdentity } from "./paths.js";

export function collectSourceInventory(
  source: {
    id: string;
    type: string;
    resolvedPath: string;
    capabilities: readonly string[];
    include: readonly string[];
    exclude: readonly string[];
  },
  exclusions: readonly string[],
): SourceInventoryEntry[] {
  requireCapability(source, "index", "inventory");
  if (source.type === "file" || isFile(source.resolvedPath)) {
    return inventoryFile(source.id, source.resolvedPath, exclusions);
  }
  if (!isDirectory(source.resolvedPath)) {
    return [];
  }
  const include = source.include.length > 0 ? source.include : ["**/*"];
  const entries: SourceInventoryEntry[] = [];
  for (const file of walkFiles(source.resolvedPath)) {
    if (!matchesAnyGlob(file.relativePosix, include)) {
      continue;
    }
    if (matchesAnyGlob(file.relativePosix, source.exclude)) {
      continue;
    }
    if (isSensitive(file.relativePosix, file.absolutePath, exclusions)) {
      continue;
    }
    entries.push({
      relativePath: file.relativePosix,
      identity: sourceIdentity(source.id, file.relativePosix),
    });
  }
  entries.sort((a, b) => (a.identity < b.identity ? -1 : a.identity > b.identity ? 1 : 0));
  return entries;
}

function inventoryFile(
  id: string,
  resolvedPath: string,
  exclusions: readonly string[],
): SourceInventoryEntry[] {
  const name = posixBasename(resolvedPath);
  if (isSensitive(name, resolvedPath, exclusions)) {
    return [];
  }
  const posixName = toPosixPath(name);
  return [
    {
      relativePath: posixName,
      identity: sourceIdentity(id, posixName),
    },
  ];
}

function isSensitive(relativePosixPath: string, absolutePath: string, exclusions: readonly string[]): boolean {
  if (isExcluded(relativePosixPath, exclusions)) {
    return true;
  }
  return isExcluded(posixBasename(absolutePath), exclusions);
}

export function defaultIncludeFor(config: Pick<SourceConfig, "type">): string[] {
  return config.type === "file" ? [] : ["**/*"];
}
