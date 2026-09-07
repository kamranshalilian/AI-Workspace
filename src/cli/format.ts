import type { DoctorReport } from "../core/doctor.js";
import type { AgentAddResult, AgentCreateResult, AgentListResult, AgentRemoveResult, AgentStatusResult } from "../core/agent.js";
import type { SourceAddResult, SourceListResult, SourceRemoveResult } from "../core/source.js";
import type { ExportResult } from "../core/export.js";
import type { ImportResult } from "../core/import.js";
import type { PromoteResult } from "../core/promote.js";
import type { SyncResult } from "../core/sync.js";
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

export function formatAgentCreate(result: AgentCreateResult): string {
  return `Created ${result.path}\nThis definition is not enabled. Run \`aiw agent add ${result.id}\` to register it.\n`;
}

export function formatAgentAdd(result: AgentAddResult): string {
  const verb = result.created ? "Registered" : "Already registered";
  return `${verb} agent '${result.id}' (definition: ${result.definitionId})\n`;
}

export function formatAgentRemove(result: AgentRemoveResult): string {
  const lines = [`Removed agent '${result.id}' from the manifest.`];
  if (result.leftoverGenerated.length > 0) {
    lines.push("Generated native files were not deleted:");
    for (const file of result.leftoverGenerated) {
      lines.push(`  ${file}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

export function formatAgentList(result: AgentListResult): string {
  const lines = ["Available definitions"];
  if (result.available.length === 0) {
    lines.push("  (none)");
  } else {
    for (const item of result.available) {
      const caps = item.capabilities.length === 0 ? "none" : item.capabilities.join(", ");
      lines.push(`  ${item.id}: ${item.name} [${item.source}] capabilities: ${caps}`);
    }
  }
  lines.push("Registered agents");
  if (result.enabled.length === 0) {
    lines.push("  (none)");
  } else {
    for (const item of result.enabled) {
      const state = item.enabled ? "enabled" : "disabled";
      const valid = item.valid ? "valid" : "invalid";
      lines.push(`  ${item.id}: ${state}, ${valid} (definition: ${item.definition})`);
    }
  }
  return `${lines.join("\n")}\n`;
}

export function formatAgentStatus(result: AgentStatusResult): string {
  const lines = ["Agent status"];
  if (result.agents.length === 0) {
    lines.push("  (none)");
    return `${lines.join("\n")}\n`;
  }
  for (const agent of result.agents) {
    const state = agent.enabled ? "enabled" : "disabled";
    const valid = agent.valid ? "valid" : "invalid";
    lines.push(`  ${agent.id}: ${state}, ${valid}, strategy=${agent.strategy}`);
    if (agent.outputs.length === 0) {
      lines.push("    outputs: (none)");
    } else {
      for (const output of agent.outputs) {
        lines.push(`    ${output.path}: ${output.state}`);
      }
    }
  }
  return `${lines.join("\n")}\n`;
}

export function formatExport(result: ExportResult): string {
  const lines = [result.ok ? "Export: ok" : "Export: completed with conflicts"];
  if (result.agents.length === 0) {
    lines.push("  (no agents)");
    return `${lines.join("\n")}\n`;
  }
  for (const agent of result.agents) {
    lines.push(`  ${agent.id}`);
    const noWork =
      agent.written.length === 0 &&
      agent.unchanged.length === 0 &&
      agent.skippedUnmanaged.length === 0;
    if (noWork) {
      lines.push("    No mappings matched; nothing to export.");
      continue;
    }
    lines.push(`    written: ${agent.written.join(", ") || "(none)"}`);
    lines.push(`    unchanged: ${agent.unchanged.join(", ") || "(none)"}`);
    if (agent.skippedUnmanaged.length > 0) {
      lines.push(`    skipped unmanaged: ${agent.skippedUnmanaged.join(", ")}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

export function formatSourceAdd(result: SourceAddResult): string {
  return `Registered source '${result.id}' (${result.type}, ${result.path}, ${result.status})\nSource registration does not copy files, import snapshots, or execute tools.\n`;
}

export function formatSourceRemove(result: SourceRemoveResult): string {
  return `Removed source '${result.id}' from the manifest.\nSource files were not deleted.\n`;
}

export function formatSourceList(result: SourceListResult): string {
  if (result.sources.length === 0) {
    return "Sources\n  (none)\n";
  }
  const lines = ["Sources"];
  for (const source of result.sources) {
    lines.push(source.id);
    lines.push(`  type: ${source.type}`);
    lines.push(`  path: ${source.path}`);
    lines.push(`  capabilities: ${source.capabilities.join(",") || "none"}`);
    lines.push(`  status: ${source.status}`);
  }
  return `${lines.join("\n")}\n`;
}

export function formatImport(result: ImportResult): string {
  const header = result.dryRun ? "Import (dry-run)" : result.ok ? "Import: ok" : "Import: completed with conflicts";
  const lines = [header, `  source: ${result.source.id} (${result.source.kind})`];
  lines.push(`    written: ${result.written.join(", ") || "(none)"}`);
  lines.push(`    unchanged: ${result.unchanged.join(", ") || "(none)"}`);
  if (result.conflicts.length > 0) {
    lines.push(`    conflicts: ${result.conflicts.join(", ")}`);
  }
  const skipped = result.skipped.filter((item) => item.action === "skipped");
  if (skipped.length > 0) {
    lines.push(`    skipped: ${skipped.map((item) => `${item.path} (${item.reason ?? "skipped"})`).join(", ")}`);
  }
  return `${lines.join("\n")}\n`;
}

export function formatPromote(result: PromoteResult): string {
  const header = result.dryRun ? "Promote (dry-run)" : result.ok ? "Promote: ok" : "Promote: completed with conflicts";
  const lines = [header, `  agent: ${result.agent.id} (${result.agent.kind})`];
  lines.push(`    written: ${result.written.join(", ") || "(none)"}`);
  lines.push(`    unchanged: ${result.unchanged.join(", ") || "(none)"}`);
  if (result.conflicts.length > 0) {
    lines.push(`    conflicts: ${result.conflicts.join(", ")}`);
  }
  const skipped = result.skipped.filter((item) => item.action === "skipped");
  if (skipped.length > 0) {
    lines.push(`    skipped: ${skipped.map((item) => `${item.canonicalPath || item.nativePath} (${item.reason ?? "skipped"})`).join(", ")}`);
  }
  return `${lines.join("\n")}\n`;
}

export function formatSync(result: SyncResult): string {
  const mode = result.dryRun ? "dry-run" : result.apply ? "apply" : "report";
  const header = result.ok ? `Sync: ok (${mode})` : `Sync: completed with conflicts (${mode})`;
  const lines = [header];
  if (result.relations.length === 0) {
    lines.push("  (no related representations)");
    return `${lines.join("\n")}\n`;
  }
  for (const relation of result.relations) {
    lines.push(`  ${relation.kind}:${relation.id} ${relation.path}: ${relation.state}`);
  }
  if (result.written.length > 0) {
    lines.push(`  written: ${result.written.join(", ")}`);
  }
  if (result.skippedUnmanaged.length > 0) {
    lines.push(`  skipped unmanaged: ${result.skippedUnmanaged.join(", ")}`);
  }
  if (result.conflicts.length > 0) {
    lines.push(`  conflicts: ${result.conflicts.join(", ")}`);
  }
  return `${lines.join("\n")}\n`;
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
