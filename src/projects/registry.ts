import { AiwError } from "../core/errors.js";
import { discoverScope } from "../filesystem/discovery.js";
import { comparePosix } from "../filesystem/paths.js";
import { loadManifestFromFile } from "../manifest/index.js";
import type { Manifest } from "../manifest/types.js";
import { classifyProject, type FederatedProject } from "./classify.js";

export interface WorkspaceRegistry {
  name: string;
  root: string;
  manifestPath: string;
  manifest: Manifest;
  projects: FederatedProject[];
}

export function requireWorkspace(startDir: string): WorkspaceRegistry {
  const discovered = discoverScope(startDir);
  if (discovered === undefined) {
    throw new AiwError("NOT_FOUND", `No .ai/manifest.yaml found from ${startDir}.`, {
      suggestion: "Run `aiw init --kind workspace` in the workspace directory.",
    });
  }
  const manifest = loadManifestFromFile(discovered.manifestPath);
  if (manifest.kind !== "workspace") {
    throw new AiwError(
      "VALIDATION",
      `Active scope '${manifest.name}' is kind '${manifest.kind}', not workspace.`,
      { suggestion: "Run this command from a workspace root, or pass --path to the workspace." },
    );
  }
  const projects = listRegisteredProjects(discovered.root, manifest);
  return {
    name: manifest.name,
    root: discovered.root,
    manifestPath: discovered.manifestPath,
    manifest,
    projects,
  };
}

export function listRegisteredProjects(workspaceRoot: string, manifest: Manifest): FederatedProject[] {
  const ids = Object.keys(manifest.projects).sort(comparePosix);
  const projects = ids.map((id) => {
    const registration = manifest.projects[id];
    return classifyProject(workspaceRoot, id, registration?.path ?? "");
  });
  const byResolved = new Map<string, string[]>();
  for (const project of projects) {
    const list = byResolved.get(project.resolvedPath) ?? [];
    list.push(project.id);
    byResolved.set(project.resolvedPath, list);
  }
  for (const project of projects) {
    const idsAtPath = byResolved.get(project.resolvedPath) ?? [];
    if (idsAtPath.length > 1) {
      const others = idsAtPath.filter((id) => id !== project.id);
      project.status = "invalid";
      project.invalidReason = `Duplicate project path (also registered as ${others.join(", ")}).`;
    }
  }
  return projects;
}
