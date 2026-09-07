import { SPEC_VERSION } from "../config/constants.js";
import { discoverScope } from "../filesystem/discovery.js";
import { parseAndValidateManifest } from "../manifest/index.js";
import fs from "node:fs";
import { AiwError } from "./errors.js";
import { loadScope, resolveScope } from "../resolution/index.js";
import type { EffectiveSnapshot, SnapshotIssue } from "../resolution/types.js";
import { definitionSearchDirs, resolveDefinition } from "../agents/index.js";

export interface ValidateReport {
  specVersion: 1;
  ok: boolean;
  root: string;
  manifestPath: string;
  issues: SnapshotIssue[];
}

export function validateFrom(startDir: string): ValidateReport {
  const discovered = discoverScope(startDir);
  if (discovered === undefined) {
    throw new AiwError("NOT_FOUND", `No .ai/manifest.yaml found from ${startDir}.`, {
      suggestion: "Run `aiw init` in the project directory.",
    });
  }

  const text = fs.readFileSync(discovered.manifestPath, "utf8");
  const schema = parseAndValidateManifest(text);
  if (!schema.ok) {
    return {
      specVersion: SPEC_VERSION,
      ok: false,
      root: discovered.root,
      manifestPath: discovered.manifestPath,
      issues: schema.issues.map((issue) => ({
        severity: "error" as const,
        code: "SCHEMA",
        message: issue.path ? `${issue.path}: ${issue.message}` : issue.message,
        path: issue.path || undefined,
      })),
    };
  }

  try {
    const snapshot = resolveScope(loadScope(discovered.root));
    const issues = snapshot.issues.filter((issue) => issue.severity === "error" && issue.code !== "SOURCE_UNRESOLVED");
    issues.push(...definitionIssues(snapshot));
    return {
      specVersion: SPEC_VERSION,
      ok: issues.length === 0,
      root: discovered.root,
      manifestPath: discovered.manifestPath,
      issues,
    };
  } catch (error) {
    if (error instanceof AiwError) {
      return {
        specVersion: SPEC_VERSION,
        ok: false,
        root: discovered.root,
        manifestPath: discovered.manifestPath,
        issues: [
          {
            severity: "error",
            code: error.code,
            message: error.message,
            suggestion: error.suggestion,
          },
        ],
      };
    }
    throw error;
  }
}

export function snapshotIssuesAsErrors(snapshot: EffectiveSnapshot): SnapshotIssue[] {
  return snapshot.issues.filter((issue) => issue.severity === "error");
}

function definitionIssues(snapshot: EffectiveSnapshot): SnapshotIssue[] {
  const issues: SnapshotIssue[] = [];
  const dirs = definitionSearchDirs(snapshot);
  for (const agent of snapshot.agents) {
    try {
      resolveDefinition(agent.definitionId, dirs);
    } catch (error) {
      issues.push({
        severity: "error",
        code: "DEFINITION",
        message: error instanceof Error ? error.message : String(error),
        path: agent.id,
      });
    }
  }
  return issues;
}
