import fs from "node:fs";
import { AiwError } from "../core/errors.js";
import { parseYamlDocument } from "./parse.js";
import type { Manifest, SchemaValidationResult } from "./types.js";
import { validateManifestSchema } from "./validate.js";

export function parseAndValidateManifest(text: string): SchemaValidationResult {
  let raw: unknown;
  try {
    raw = parseYamlDocument(text);
  } catch (error) {
    if (error instanceof AiwError) {
      return {
        ok: false,
        issues: [{ path: "", message: error.message }],
      };
    }
    throw error;
  }
  return validateManifestSchema(raw);
}

export function loadManifestFromFile(manifestPath: string): Manifest {
  let text: string;
  try {
    text = fs.readFileSync(manifestPath, "utf8");
  } catch (error) {
    throw new AiwError("IO", `Unable to read manifest at ${manifestPath}.`, {
      cause: error,
      details: { manifestPath },
    });
  }
  const result = parseAndValidateManifest(text);
  if (!result.ok) {
    throw new AiwError("VALIDATION", formatIssues(result.issues), {
      details: { manifestPath, issues: result.issues },
      suggestion: "Fix .ai/manifest.yaml so it matches specVersion 1.",
    });
  }
  return result.manifest;
}

export function formatIssues(
  issues: readonly { path: string; message: string }[],
): string {
  return issues
    .map((issue) => (issue.path ? `${issue.path}: ${issue.message}` : issue.message))
    .join("\n");
}

export type { Manifest, ManifestIssue, SchemaValidationResult } from "./types.js";
export { parseYamlDocument } from "./parse.js";
export { validateManifestSchema } from "./validate.js";
export { removeManifestAgent, removeManifestSource, upsertManifestAgent, upsertManifestSource, upsertManifestProject, removeManifestProject } from "./write.js";
