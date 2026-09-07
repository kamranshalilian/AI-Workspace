import { SPEC_VERSION } from "../config/constants.js";
import { isAiwError } from "./errors.js";
import { doctorFrom, type DoctorReport } from "./doctor.js";
import { exportAgents, type ExportResult } from "./export.js";
import { statusFrom, type StatusSummary } from "./status.js";
import { syncWorkspace, type SyncResult } from "./sync.js";
import { validateFrom, type ValidateReport } from "./validate.js";
import type { FederatedProject, ProjectResolutionStatus } from "../projects/classify.js";
import { requireWorkspace, type WorkspaceRegistry } from "../projects/registry.js";

export interface FederatedItem<T> {
  id: string;
  path: string;
  status: ProjectResolutionStatus;
  ok: boolean;
  result?: T;
  error?: {
    code: string;
    message: string;
    suggestion?: string;
  };
}

export interface FederatedReport<T> {
  specVersion: 1;
  command: string;
  ok: boolean;
  workspace: {
    name: string;
    root: string;
    ok?: boolean;
    issues?: DoctorReport["issues"];
  };
  projects: FederatedItem<T>[];
}

export function statusAll(startDir: string): FederatedReport<StatusSummary> {
  return runAll(startDir, "status", (project) => statusFrom(project.resolvedPath).summary);
}

export function validateAll(startDir: string): FederatedReport<ValidateReport> {
  const workspace = requireWorkspace(startDir);
  const workspaceReport = validateFrom(workspace.root);
  const projects = workspace.projects.map((project) => operate(workspace, project, (item) => validateFrom(item.resolvedPath)));
  return {
    specVersion: SPEC_VERSION,
    command: "validate",
    ok: workspaceReport.ok && projects.every((item) => item.ok),
    workspace: {
      name: workspace.name,
      root: workspace.root,
      ok: workspaceReport.ok,
      issues: workspaceReport.issues,
    },
    projects,
  };
}

export function doctorAll(startDir: string): FederatedReport<DoctorReport> {
  const workspace = requireWorkspace(startDir);
  const workspaceReport = doctorFrom(workspace.root);
  const projects = workspace.projects.map((project) => operate(workspace, project, (item) => doctorFrom(item.resolvedPath)));
  return {
    specVersion: SPEC_VERSION,
    command: "doctor",
    ok: workspaceReport.ok && projects.every((item) => item.ok),
    workspace: {
      name: workspace.name,
      root: workspace.root,
      ok: workspaceReport.ok,
      issues: workspaceReport.issues,
    },
    projects,
  };
}

export function exportAll(startDir: string, agentId?: string): FederatedReport<ExportResult> {
  return runAll(startDir, "export", (project) => exportAgents(project.resolvedPath, agentId));
}

export function syncAll(
  startDir: string,
  options?: { sourceId?: string; agentId?: string; dryRun?: boolean; apply?: boolean },
): FederatedReport<SyncResult> {
  return runAll(startDir, "sync", (project) => syncWorkspace(project.resolvedPath, options));
}

function runAll<T extends { ok?: boolean }>(
  startDir: string,
  command: string,
  fn: (project: FederatedProject) => T,
): FederatedReport<T> {
  const workspace = requireWorkspace(startDir);
  const projects = workspace.projects.map((project) => operate(workspace, project, fn));
  return {
    specVersion: SPEC_VERSION,
    command,
    ok: projects.every((item) => item.ok),
    workspace: {
      name: workspace.name,
      root: workspace.root,
    },
    projects,
  };
}

function operate<T extends { ok?: boolean }>(
  _workspace: WorkspaceRegistry,
  project: FederatedProject,
  fn: (project: FederatedProject) => T,
): FederatedItem<T> {
  if (project.status !== "resolved") {
    return {
      id: project.id,
      path: project.path,
      status: project.status,
      ok: false,
      error: {
        code: project.status === "invalid" ? "PROJECT_INVALID" : "PROJECT_UNRESOLVED",
        message:
          project.invalidReason ??
          `Registered project '${project.id}' is ${project.status}.`,
      },
    };
  }
  try {
    const result = fn(project);
    const ok = result.ok !== false;
    return {
      id: project.id,
      path: project.path,
      status: project.status,
      ok,
      result,
    };
  } catch (error) {
    if (isAiwError(error)) {
      return {
        id: project.id,
        path: project.path,
        status: project.status,
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          suggestion: error.suggestion,
        },
      };
    }
    return {
      id: project.id,
      path: project.path,
      status: project.status,
      ok: false,
      error: {
        code: "IO",
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
