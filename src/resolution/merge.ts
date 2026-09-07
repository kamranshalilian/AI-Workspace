import { isDirectory, isFile, pathExists } from "../filesystem/io.js";
import {
  comparePosix,
  isStrictDescendant,
  resolveFromBase,
  toPosixPath,
} from "../filesystem/paths.js";
import type { Manifest } from "../manifest/types.js";
import type { LoadedScope, ResolvedAgent, ResolvedProject, ResolvedSource } from "./types.js";

export function mergeResourceChain<T extends { identity: string }>(
  layers: readonly { resources: readonly T[]; exclude: readonly string[] }[],
): T[] {
  const map = new Map<string, T>();
  for (const layer of layers) {
    for (const identity of layer.exclude) {
      map.delete(identity);
    }
    for (const item of layer.resources) {
      map.set(item.identity, item);
    }
  }
  return [...map.values()].sort((a, b) => comparePosix(a.identity, b.identity));
}

export function mergeSources(
  layers: readonly { scope: LoadedScope; sources: Record<string, Manifest["sources"][string]> }[],
): ResolvedSource[] {
  const map = new Map<string, ResolvedSource>();
  for (const layer of layers) {
    const ids = Object.keys(layer.sources).sort();
    for (const id of ids) {
      const source = layer.sources[id];
      if (source === undefined) {
        continue;
      }
      const resolvedPath = resolveFromBase(layer.scope.root, source.path);
      const exists =
        source.type === "file" ? isFile(resolvedPath) : pathExists(resolvedPath);
      map.set(id, {
        id,
        type: source.type,
        declaredPath: source.path,
        resolvedPath,
        originRoot: layer.scope.root,
        originName: layer.scope.manifest.name,
        capabilities: [...source.capabilities].sort(),
        status: exists ? "ok" : "unresolved",
      });
    }
  }
  return [...map.values()].sort((a, b) => comparePosix(a.id, b.id));
}

export function mergeAgents(
  layers: readonly { scope: LoadedScope; agents: Record<string, Manifest["agents"][string]> }[],
): ResolvedAgent[] {
  const map = new Map<string, ResolvedAgent>();
  for (const layer of layers) {
    const ids = Object.keys(layer.agents).sort();
    for (const id of ids) {
      const agent = layer.agents[id];
      if (agent === undefined) {
        continue;
      }
      map.set(id, {
        id,
        definitionId: agent.definition,
        enabled: agent.enabled,
        strategy: agent.adapter.strategy,
        originRoot: layer.scope.root,
        originName: layer.scope.manifest.name,
      });
    }
  }
  return [...map.values()].sort((a, b) => comparePosix(a.id, b.id));
}

export function resolveProjects(scope: LoadedScope): ResolvedProject[] {
  if (scope.manifest.kind !== "workspace") {
    return [];
  }
  const seen = new Map<string, string>();
  const projects: ResolvedProject[] = [];
  const ids = Object.keys(scope.manifest.projects).sort();
  for (const id of ids) {
    const registration = scope.manifest.projects[id];
    if (registration === undefined) {
      continue;
    }
    const resolvedPath = resolveFromBase(scope.root, registration.path);
    projects.push({
      id,
      path: toPosixPath(registration.path),
      resolvedPath,
      status: isDirectory(resolvedPath) ? "ok" : "missing",
    });
    const key = resolvedPath;
    const previous = seen.get(key);
    if (previous !== undefined) {
      continue;
    }
    seen.set(key, id);
  }
  return projects.sort((a, b) => comparePosix(a.id, b.id));
}

export function duplicateProjectPaths(projects: readonly ResolvedProject[]): string[] {
  const counts = new Map<string, string[]>();
  for (const project of projects) {
    const list = counts.get(project.resolvedPath) ?? [];
    list.push(project.id);
    counts.set(project.resolvedPath, list);
  }
  const duplicates: string[] = [];
  for (const ids of counts.values()) {
    if (ids.length > 1) {
      duplicates.push(ids.join(", "));
    }
  }
  return duplicates.sort();
}

export function projectEscapesWorkspace(scope: LoadedScope, resolvedPath: string): boolean {
  return !isStrictDescendant(scope.root, resolvedPath);
}
