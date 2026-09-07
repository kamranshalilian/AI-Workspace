import fs from "node:fs";
import path from "node:path";
import { AI_DIR_NAME, SPEC_VERSION } from "../config/constants.js";
import { AiwError } from "../core/errors.js";
import { discoverScope, realPathIfExists } from "../filesystem/discovery.js";
import { isDirectory, isFile, pathExists } from "../filesystem/io.js";
import { isStrictDescendant, resolveFromBase } from "../filesystem/paths.js";
import { loadManifestFromFile } from "../manifest/index.js";
import type { InheritanceMode, Manifest } from "../manifest/types.js";
import { collectResources, mergeExclusions, mergeMaxFileBytes } from "./collect.js";
import {
  duplicateProjectPaths,
  mergeAgents,
  mergeResourceChain,
  mergeSources,
  projectEscapesWorkspace,
  resolveProjects,
} from "./merge.js";
import type {
  ChainEntry,
  EffectiveSnapshot,
  LoadedScope,
  SnapshotIssue,
} from "./types.js";

export function resolveParentAiDir(scopeRoot: string, declaredPath: string): string {
  const resolved = resolveFromBase(scopeRoot, declaredPath);
  if (path.basename(resolved) === AI_DIR_NAME) {
    return resolved;
  }
  return path.join(resolved, AI_DIR_NAME);
}

export function loadScope(root: string): LoadedScope {
  const resolvedRoot = path.resolve(root);
  const aiDir = path.join(resolvedRoot, AI_DIR_NAME);
  const manifestPath = path.join(aiDir, "manifest.yaml");
  const manifest = loadManifestFromFile(manifestPath);
  return {
    root: resolvedRoot,
    aiDir,
    manifestPath,
    realRoot: realPathIfExists(resolvedRoot),
    manifest,
  };
}

export function loadChain(active: LoadedScope): LoadedScope[] {
  const visited = new Set<string>([active.realRoot]);
  const chain: LoadedScope[] = [active];
  let current = active;

  while (true) {
    const entry = current.manifest.extends;
    if (entry === undefined || entry.mode === "disable") {
      break;
    }
    if (entry.mode === "replace") {
      const parentAi = assertParentExists(current, entry.path, entry.mode);
      loadScope(path.dirname(parentAi));
      break;
    }

    const parent = loadParent(current, entry.path, entry.mode, visited);
    chain.unshift(parent);
    current = parent;
  }

  return chain;
}

function assertParentExists(
  child: LoadedScope,
  declaredPath: string,
  mode: InheritanceMode,
): string {
  const parentAi = resolveParentAiDir(child.root, declaredPath);
  const manifestPath = path.join(parentAi, "manifest.yaml");
  if (!isFile(manifestPath)) {
    throw new AiwError(
      "MISSING_PARENT",
      `Parent .ai not found at ${parentAi} (extends.path: '${declaredPath}').`,
      {
        details: { declaredPath, parentAi, mode, child: child.root },
        suggestion:
          "Clone or create the parent workspace, or set extends.mode to disable / remove extends.",
      },
    );
  }
  return parentAi;
}

function loadParent(
  child: LoadedScope,
  declaredPath: string,
  mode: InheritanceMode,
  visited: Set<string>,
): LoadedScope {
  const parentAi = assertParentExists(child, declaredPath, mode);
  const parentRoot = path.dirname(parentAi);
  const realRoot = realPathIfExists(parentRoot);
  if (visited.has(realRoot)) {
    throw new AiwError(
      "CYCLE",
      `Inheritance cycle detected involving ${parentRoot}.`,
      {
        details: { parentRoot, child: child.root },
        suggestion: "Remove the cycle from extends.path declarations.",
      },
    );
  }
  visited.add(realRoot);
  return loadScope(parentRoot);
}

export function resolveFrom(startDir: string): EffectiveSnapshot {
  const discovered = discoverScope(startDir);
  if (discovered === undefined) {
    throw new AiwError(
      "NOT_FOUND",
      `No .ai/manifest.yaml found from ${path.resolve(startDir)}.`,
      {
        suggestion: "Run `aiw init` in the project directory.",
      },
    );
  }
  return resolveScope(loadScope(discovered.root));
}

export function resolveScope(active: LoadedScope): EffectiveSnapshot {
  const issues: SnapshotIssue[] = [];
  const inheritanceMode = active.manifest.extends?.mode ?? "none";
  const declaredPath = active.manifest.extends?.path;

  if (active.manifest.kind === "workspace") {
    validateWorkspaceProjects(active, issues);
  }

  const mergeChain = loadChain(active);
  const policyManifests = policyChain(active, mergeChain);
  const exclusions = mergeExclusions(policyManifests);
  const maxFileBytes = mergeMaxFileBytes(policyManifests);

  const skipped: SnapshotIssue[] = [];
  const resourceLayers: { resources: ReturnType<typeof collectResources>["resources"]; exclude: string[] }[] =
    [];
  for (const scope of mergeChain) {
    const collected = collectResources(scope, exclusions, maxFileBytes);
    skipped.push(...collected.skipped);
    resourceLayers.push({
      resources: collected.resources,
      exclude: scope.manifest.extends?.mode === "extend" ? scope.manifest.extends.exclude : [],
    });
  }
  const resources = mergeResourceChain(resourceLayers);

  const sourceLayers =
    inheritanceMode === "extend" || inheritanceMode === "none"
      ? mergeChain.map((scope) => ({ scope, sources: scope.manifest.sources }))
      : [{ scope: active, sources: active.manifest.sources }];
  const agentLayers =
    inheritanceMode === "extend" || inheritanceMode === "none"
      ? mergeChain.map((scope) => ({ scope, agents: scope.manifest.agents }))
      : [{ scope: active, agents: active.manifest.agents }];

  const sources = mergeSources(sourceLayers);
  const agents = mergeAgents(agentLayers);
  const projects = resolveProjects(active);

  for (const source of sources) {
    if (source.status === "unresolved") {
      issues.push({
        severity: "error",
        code: "SOURCE_UNRESOLVED",
        message: `Source '${source.id}' path does not exist: ${source.resolvedPath}.`,
        path: source.declaredPath,
        suggestion: "Create the referenced path or remove the source from the manifest.",
      });
    }
  }

  const parentScope =
    mergeChain.length > 1 ? mergeChain[mergeChain.length - 2] : undefined;
  let parent:
    | { kind: LoadedScope["manifest"]["kind"]; name: string; root: string }
    | undefined;
  if (inheritanceMode === "replace" && declaredPath !== undefined) {
    const parentAi = resolveParentAiDir(active.root, declaredPath);
    const parentRoot = path.dirname(parentAi);
    const parentManifest = loadManifestFromFile(path.join(parentAi, "manifest.yaml"));
    parent = { kind: parentManifest.kind, name: parentManifest.name, root: parentRoot };
  } else if (parentScope !== undefined) {
    parent = {
      kind: parentScope.manifest.kind,
      name: parentScope.manifest.name,
      root: parentScope.root,
    };
  }

  const chain: ChainEntry[] = mergeChain.map((scope, index) => ({
    kind: scope.manifest.kind,
    name: scope.manifest.name,
    root: scope.root,
    mode: index === mergeChain.length - 1 ? inheritanceMode === "none" ? "root" : inheritanceMode : "extend",
  }));

  if (
    parent !== undefined &&
    active.manifest.kind === "project" &&
    parent.kind !== "workspace" &&
    inheritanceMode === "extend"
  ) {
    issues.push({
      severity: "warning",
      code: "PROJECT_EXTENDS_PROJECT",
      message: `Project '${active.manifest.name}' extends project '${parent.name}' rather than a workspace.`,
      suggestion: "Prefer extending a kind: workspace parent.",
    });
  }

  return {
    specVersion: SPEC_VERSION,
    active: {
      kind: active.manifest.kind,
      name: active.manifest.name,
      root: active.root,
      manifestPath: active.manifestPath,
    },
    chain,
    inheritance: {
      mode: inheritanceMode,
      parent,
      declaredPath,
    },
    resources,
    sources,
    agents,
    projects,
    policies: {
      exclusions,
      maxFileBytes,
      trust: { executableAdapters: false, executableSources: false },
    },
    issues,
    skipped,
  };
}

function policyChain(active: LoadedScope, mergeChain: LoadedScope[]): Manifest[] {
  const mode = active.manifest.extends?.mode ?? "none";
  if (mode === "replace" || mode === "disable" || mode === "none") {
    return [active.manifest];
  }
  return mergeChain.map((scope) => scope.manifest);
}

function validateWorkspaceProjects(active: LoadedScope, issues: SnapshotIssue[]): void {
  const projects = resolveProjects(active);
  const duplicates = duplicateProjectPaths(projects);
  if (duplicates.length > 0) {
    throw new AiwError("VALIDATION", `Duplicate project paths: ${duplicates.join("; ")}.`);
  }
  for (const project of projects) {
    if (projectEscapesWorkspace(active, project.resolvedPath)) {
      throw new AiwError(
        "VALIDATION",
        `Project '${project.id}' path '${project.path}' must stay inside the workspace.`,
      );
    }
    if (project.status === "missing") {
      issues.push({
        severity: "warning",
        code: "PROJECT_MISSING",
        message: `Registered project '${project.id}' directory does not exist: ${project.resolvedPath}.`,
        path: project.path,
        suggestion: "Create the directory or remove it from projects.",
      });
    }
  }
}

export function parentExists(scopeRoot: string, declaredPath: string): boolean {
  const parentAi = resolveParentAiDir(scopeRoot, declaredPath);
  return isFile(path.join(parentAi, "manifest.yaml"));
}

export function isAiDirectory(target: string): boolean {
  return path.basename(target) === AI_DIR_NAME && isDirectory(target);
}

export function pathAccessible(target: string): boolean {
  try {
    fs.accessSync(target);
    return true;
  } catch {
    return pathExists(target);
  }
}
