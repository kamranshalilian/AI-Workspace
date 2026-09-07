import fs from "node:fs";
import path from "node:path";
import { SPEC_VERSION } from "../config/constants.js";
import { discoverScope } from "../filesystem/discovery.js";
import { loadScope, resolveScope } from "../resolution/index.js";
import type { SnapshotIssue } from "../resolution/types.js";
import { AiwError } from "./errors.js";
import { validateFrom } from "./validate.js";

export interface DoctorReport {
  specVersion: 1;
  command: "doctor";
  ok: boolean;
  root: string;
  issues: SnapshotIssue[];
}

export function doctorFrom(startDir: string): DoctorReport {
  const discovered = discoverScope(startDir);
  if (discovered === undefined) {
    throw new AiwError("NOT_FOUND", `No .ai/manifest.yaml found from ${startDir}.`, {
      suggestion: "Run `aiw init` in the project directory.",
    });
  }

  const issues: SnapshotIssue[] = [];
  const validation = validateFrom(startDir);
  issues.push(...validation.issues);

  let snapshotIssues: SnapshotIssue[] = [];
  let skipped: SnapshotIssue[] = [];
  try {
    const snapshot = resolveScope(loadScope(discovered.root));
    snapshotIssues = snapshot.issues;
    skipped = snapshot.skipped;
    for (const issue of snapshot.issues) {
      if (!issues.some((existing) => existing.code === issue.code && existing.message === issue.message)) {
        issues.push(issue);
      }
    }
    issues.push(...skipped);

    addGitIgnoreSuggestions(discovered.root, issues);
    addGitAttributesSuggestion(discovered.root, issues);
  } catch (error) {
    if (error instanceof AiwError) {
      if (!issues.some((issue) => issue.message === error.message)) {
        issues.push({
          severity: "error",
          code: error.code,
          message: error.message,
          suggestion: error.suggestion,
        });
      }
    } else {
      throw error;
    }
  }

  const inaccessible = checkInaccessibleManifest(discovered.manifestPath);
  if (inaccessible !== undefined) {
    issues.push(inaccessible);
  }

  const unique = dedupeIssues(issues);
  unique.sort((a, b) => {
    const severity = severityRank(a.severity) - severityRank(b.severity);
    if (severity !== 0) {
      return severity;
    }
    if (a.code < b.code) {
      return -1;
    }
    if (a.code > b.code) {
      return 1;
    }
    return a.message < b.message ? -1 : a.message > b.message ? 1 : 0;
  });

  const ok = !unique.some((issue) => issue.severity === "error");
  return {
    specVersion: SPEC_VERSION,
    command: "doctor",
    ok,
    root: discovered.root,
    issues: unique,
  };
}

function checkInaccessibleManifest(manifestPath: string): SnapshotIssue | undefined {
  try {
    fs.accessSync(manifestPath, fs.constants.R_OK);
    return undefined;
  } catch {
    return {
      severity: "error",
      code: "INACCESSIBLE",
      message: `Manifest is not readable: ${manifestPath}.`,
    };
  }
}

function addGitIgnoreSuggestions(root: string, issues: SnapshotIssue[]): void {
  const gitignorePath = path.join(root, ".gitignore");
  const text = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, "utf8") : "";
  const hasCache = /(?:^|\/)\.ai\/cache\/?/m.test(text);
  const hasState = /(?:^|\/)\.ai\/state\/?/m.test(text);
  const cacheExists = fs.existsSync(path.join(root, ".ai", "cache"));
  const stateExists = fs.existsSync(path.join(root, ".ai", "state"));

  if (!hasCache || !hasState) {
    issues.push({
      severity: cacheExists || stateExists ? "warning" : "info",
      code: "GITIGNORE",
      message: "Recommend ignoring .ai/cache/ and .ai/state/ in .gitignore.",
      suggestion: "Add:\n.ai/cache/\n.ai/state/",
    });
  }
}

function addGitAttributesSuggestion(root: string, issues: SnapshotIssue[]): void {
  const file = path.join(root, ".gitattributes");
  const text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  if (!text.includes(".ai/") || !text.includes("eol=lf")) {
    issues.push({
      severity: "info",
      code: "GITATTRIBUTES",
      message: "Recommend locking .ai text files to LF for deterministic hashes.",
      suggestion: "Add to .gitattributes:\n.ai/** text eol=lf",
    });
  }
}

function dedupeIssues(issues: SnapshotIssue[]): SnapshotIssue[] {
  const seen = new Set<string>();
  const result: SnapshotIssue[] = [];
  for (const issue of issues) {
    const key = `${issue.severity}|${issue.code}|${issue.path ?? ""}|${issue.message}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(issue);
  }
  return result;
}

function severityRank(severity: SnapshotIssue["severity"]): number {
  switch (severity) {
    case "error":
      return 0;
    case "warning":
      return 1;
    case "info":
      return 2;
  }
}
