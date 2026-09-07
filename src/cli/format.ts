import type { DoctorReport } from "../core/doctor.js";
import type { InitResult } from "../core/init.js";
import type { StatusSummary } from "../core/status.js";
import type { ValidateReport } from "../core/validate.js";
import type { SnapshotIssue } from "../resolution/types.js";

export function formatInit(result: InitResult): string {
  const action = result.created ? "Created" : "Wrote";
  return `${action} ${result.manifestPath}\nkind: ${result.kind}\nname: ${result.name}\n`;
}

export function formatStatus(summary: StatusSummary): string {
  const lines: string[] = [];
  lines.push("AI Workspace");
  lines.push(`  kind: ${summary.active.kind}`);
  lines.push(`  name: ${summary.active.name}`);
  lines.push(`  root: ${summary.active.root}`);
  lines.push(`  spec: ${summary.specVersion}`);
  lines.push("");
  lines.push("Inheritance");
  lines.push(`  mode: ${summary.inheritance.mode}`);
  if (summary.inheritance.parent) {
    lines.push(
      `  parent: ${summary.inheritance.parent.name} (${summary.inheritance.parent.kind})`,
    );
  } else {
    lines.push("  parent: none");
  }
  lines.push("");
  lines.push("Resources");
  const kinds = Object.keys(summary.resources.byKind).sort();
  if (kinds.length === 0) {
    lines.push("  (none)");
  } else {
    for (const kind of kinds) {
      const counts = summary.resources.byKind[kind];
      if (counts === undefined) {
        continue;
      }
      lines.push(
        `  ${kind}: ${counts.total} (${counts.inherited} inherited, ${counts.local} local)`,
      );
    }
  }
  lines.push("");
  lines.push("Agents");
  if (summary.agents.length === 0) {
    lines.push("  (none)");
  } else {
    for (const agent of summary.agents) {
      const state = agent.enabled ? "enabled" : "disabled";
      lines.push(`  ${agent.id}: ${state} (definition: ${agent.definition})`);
    }
  }
  lines.push("");
  lines.push("Sources");
  if (summary.sources.length === 0) {
    lines.push("  (none)");
  } else {
    for (const source of summary.sources) {
      lines.push(`  ${source.id}: ${source.type} (${source.status})`);
    }
  }
  lines.push("");
  lines.push("Issues");
  if (summary.issues.length === 0) {
    lines.push("  none");
  } else {
    for (const issue of summary.issues) {
      lines.push(`  ${issue.severity}: ${issue.message}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

export function formatValidate(report: ValidateReport): string {
  if (report.ok) {
    return `Valid: ${report.manifestPath}\n`;
  }
  return `Invalid: ${report.manifestPath}\n${formatIssueList(report.issues)}`;
}

export function formatDoctor(report: DoctorReport): string {
  const header = report.ok ? `Doctor: ok (${report.root})\n` : `Doctor: problems found (${report.root})\n`;
  if (report.issues.length === 0) {
    return `${header}No issues.\n`;
  }
  return `${header}${formatIssueList(report.issues)}`;
}

function formatIssueList(issues: readonly SnapshotIssue[]): string {
  const lines: string[] = [];
  for (const issue of issues) {
    lines.push(`- [${issue.severity}] ${issue.code}: ${issue.message}`);
    if (issue.suggestion) {
      lines.push(`  suggestion: ${issue.suggestion}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

export function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, jsonReplacer, 2)}\n`);
}

function jsonReplacer(_key: string, value: unknown): unknown {
  return value === undefined ? undefined : value;
}
