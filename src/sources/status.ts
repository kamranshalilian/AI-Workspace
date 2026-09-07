import { isDirectory, isFile, pathExists } from "../filesystem/io.js";
import type { SourceType } from "../manifest/types.js";
import type { SourceResolutionStatus } from "../resolution/types.js";

export function classifySourceStatus(
  type: SourceType | string,
  resolvedPath: string,
): { status: SourceResolutionStatus; invalidReason?: string } {
  if (!pathExists(resolvedPath)) {
    return { status: "unresolved" };
  }
  if (type === "file") {
    if (isFile(resolvedPath)) {
      return { status: "resolved" };
    }
    return {
      status: "invalid",
      invalidReason: "type 'file' requires a file path",
    };
  }
  if (type === "directory" || type === "repository") {
    if (isDirectory(resolvedPath)) {
      return { status: "resolved" };
    }
    return {
      status: "invalid",
      invalidReason: `type '${type}' requires a directory path`,
    };
  }
  if (type === "generated") {
    if (isFile(resolvedPath) || isDirectory(resolvedPath)) {
      return { status: "resolved" };
    }
    return {
      status: "invalid",
      invalidReason: "type 'generated' requires a file or directory path",
    };
  }
  return {
    status: "invalid",
    invalidReason: `unsupported source type '${type}'`,
  };
}
