import {
  comparePosix,
  isStrictDescendant,
  resolveFromBase,
} from "../filesystem/paths.js";
import type { Manifest } from "../manifest/types.js";
import { classifyProject } from "../projects/classify.js";
import { collectSourceInventory } from "../sources/inventory.js";
import { classifySourceStatus } from "../sources/status.js";
import type { LoadedScope, ResolvedAgent, ResolvedProject, ResolvedSkill, ResolvedSource } from "./types.js";

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
  exclusions: readonly string[] = [],
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
      const classified = classifySourceStatus(source.type, resolvedPath);
      const resolved: ResolvedSource = {
        id,
        type: source.type,
        declaredPath: source.path,
        resolvedPath,
        originRoot: layer.scope.root,
        originName: layer.scope.manifest.name,
        capabilities: [...source.capabilities].sort(),
        include: [...source.include],
        exclude: [...source.exclude],
        status: classified.status,
        invalidReason: classified.invalidReason,
        inventory: [],
      };
      if (classified.status === "resolved" && resolved.capabilities.includes("index")) {
        resolved.inventory = collectSourceInventory(resolved, exclusions);
      }
      map.set(id, resolved);
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

export function mergeSkills(
  layers: readonly { scope: LoadedScope; skills: Record<string, Manifest["skills"][string]> }[],
): ResolvedSkill[] {
  const map = new Map<string, ResolvedSkill>();
  for (const layer of layers) {
    const ids = Object.keys(layer.skills).sort();
    for (const id of ids) {
      const skill = layer.skills[id];
      if (skill === undefined) {
        continue;
      }
      map.set(id, {
        id,
        enabled: skill.enabled,
        sourceId: skill.source,
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
  const projects: ResolvedProject[] = [];
  const ids = Object.keys(scope.manifest.projects).sort();
  for (const id of ids) {
    const registration = scope.manifest.projects[id];
    if (registration === undefined) {
      continue;
    }
    projects.push(classifyProject(scope.root, id, registration.path));
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
