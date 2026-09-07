import { hasManifest, manifestPathFor } from "../filesystem/discovery.js";
import { isDirectory, pathExists } from "../filesystem/io.js";
import { resolveFromBase, toPosixPath } from "../filesystem/paths.js";
import { loadManifestFromFile } from "../manifest/index.js";
import { isAiwError } from "../core/errors.js";

export type ProjectResolutionStatus = "resolved" | "unresolved" | "invalid";

export interface FederatedProject {
  id: string;
  path: string;
  resolvedPath: string;
  status: ProjectResolutionStatus;
  invalidReason?: string;
}

export function classifyProject(workspaceRoot: string, id: string, declaredPath: string): FederatedProject {
  const path = toPosixPath(declaredPath);
  const resolvedPath = resolveFromBase(workspaceRoot, path);
  if (!pathExists(resolvedPath)) {
    return { id, path, resolvedPath, status: "unresolved" };
  }
  if (!isDirectory(resolvedPath)) {
    return {
      id,
      path,
      resolvedPath,
      status: "invalid",
      invalidReason: "Project path is not a directory.",
    };
  }
  if (!hasManifest(resolvedPath)) {
    return { id, path, resolvedPath, status: "unresolved" };
  }
  try {
    const manifest = loadManifestFromFile(manifestPathFor(resolvedPath));
    if (manifest.kind !== "project") {
      return {
        id,
        path,
        resolvedPath,
        status: "invalid",
        invalidReason: `Registered path has kind '${manifest.kind}', not project.`,
      };
    }
    return { id, path, resolvedPath, status: "resolved" };
  } catch (error) {
    const message = isAiwError(error) ? error.message : error instanceof Error ? error.message : String(error);
    return {
      id,
      path,
      resolvedPath,
      status: "invalid",
      invalidReason: message,
    };
  }
}
