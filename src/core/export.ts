import { SPEC_VERSION } from "../config/constants.js";
import { definitionSearchDirs, resolveDefinition } from "../agents/index.js";
import { applyExport, planArtifacts, type ExportAgentReport } from "../adapters/engine.js";
import { resolveFrom } from "../resolution/index.js";
import { AiwError } from "./errors.js";

export interface ExportResult {
  specVersion: 1;
  command: "export";
  ok: boolean;
  agents: ExportAgentReport[];
}

export function exportAgents(startDir: string, agentId?: string): ExportResult {
  const snapshot = resolveFrom(startDir);
  const dirs = definitionSearchDirs(snapshot);
  const selected = snapshot.agents.filter((agent) => {
    if (agentId !== undefined) {
      return agent.id === agentId;
    }
    return agent.enabled;
  });
  if (agentId !== undefined && selected.length === 0) {
    throw new AiwError("VALIDATION", `Agent '${agentId}' is not registered.`, {
      suggestion: "Run `aiw agent add` before exporting.",
    });
  }

  const reports: ExportAgentReport[] = [];
  let ok = true;
  for (const agent of selected) {
    if (!agent.enabled && agentId === undefined) {
      continue;
    }
    const definition = resolveDefinition(agent.definitionId, dirs);
    const planned = planArtifacts(definition, snapshot);
    const applied = applyExport(planned);
    if (applied.skippedUnmanaged.length > 0) {
      ok = false;
    }
    reports.push({
      id: agent.id,
      definitionId: agent.definitionId,
      written: applied.written,
      unchanged: applied.unchanged,
      skippedUnmanaged: applied.skippedUnmanaged,
      leftoverGenerated: [],
    });
  }
  reports.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return {
    specVersion: SPEC_VERSION,
    command: "export",
    ok,
    agents: reports,
  };
}
