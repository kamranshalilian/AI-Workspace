import { SPEC_VERSION } from "../config/constants.js";
import { upsertManifestProject, removeManifestProject } from "../manifest/write.js";
import { assertValidProjectId } from "../projects/ids.js";
import { normalizeDeclaredProjectPath } from "../projects/paths.js";
import { requireWorkspace } from "../projects/registry.js";
import type { ProjectResolutionStatus } from "../projects/classify.js";

export interface ProjectAddResult {
  specVersion: 1;
  command: "project-add";
  ok: true;
  id: string;
  path: string;
  status: ProjectResolutionStatus;
}

export interface ProjectRemoveResult {
  specVersion: 1;
  command: "project-remove";
  ok: true;
  id: string;
}

export interface ProjectListItem {
  id: string;
  path: string;
  status: ProjectResolutionStatus;
  invalidReason?: string;
}

export interface ProjectListResult {
  specVersion: 1;
  command: "project-list";
  workspace: string;
  projects: ProjectListItem[];
}

export function addProject(startDir: string, id: string, pathRaw: string | undefined): ProjectAddResult {
  const workspace = requireWorkspace(startDir);
  const safeId = assertValidProjectId(id);
  const declaredPath = normalizeDeclaredProjectPath(pathRaw ?? "");
  upsertManifestProject(workspace.manifestPath, safeId, declaredPath);
  const updated = requireWorkspace(workspace.root);
  const resolved = updated.projects.find((item) => item.id === safeId);
  return {
    specVersion: SPEC_VERSION,
    command: "project-add",
    ok: true,
    id: safeId,
    path: declaredPath,
    status: resolved?.status ?? "unresolved",
  };
}

export function removeProject(startDir: string, id: string): ProjectRemoveResult {
  const workspace = requireWorkspace(startDir);
  const safeId = assertValidProjectId(id);
  removeManifestProject(workspace.manifestPath, safeId);
  return {
    specVersion: SPEC_VERSION,
    command: "project-remove",
    ok: true,
    id: safeId,
  };
}

export function listProjects(startDir: string): ProjectListResult {
  const workspace = requireWorkspace(startDir);
  return {
    specVersion: SPEC_VERSION,
    command: "project-list",
    workspace: workspace.name,
    projects: workspace.projects.map((project) => ({
      id: project.id,
      path: project.path,
      status: project.status,
      invalidReason: project.invalidReason,
    })),
  };
}
