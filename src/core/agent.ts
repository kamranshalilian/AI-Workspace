import { SPEC_VERSION } from "../config/constants.js";
import { definitionSearchDirs, listBundledDefinitions, listDefinitions, resolveDefinition } from "../agents/index.js";
import type { AgentDefinition } from "../agents/types.js";
import { leftoverGenerated, planArtifacts } from "../adapters/engine.js";
import { discoverScope } from "../filesystem/discovery.js";
import { removeManifestAgent, upsertManifestAgent } from "../manifest/write.js";
import { loadScope, resolveFrom, resolveScope } from "../resolution/index.js";
import { AiwError } from "./errors.js";

export interface AgentAddResult {
  specVersion: 1;
  command: "agent-add";
  ok: true;
  id: string;
  definitionId: string;
  created: boolean;
  sourcePath: string;
}

export interface AgentRemoveResult {
  specVersion: 1;
  command: "agent-remove";
  ok: true;
  id: string;
  leftoverGenerated: string[];
}

export interface AgentListResult {
  specVersion: 1;
  command: "agent-list";
  available: { id: string; name: string; capabilities: string[]; source: "bundled" | "local"; valid: true }[];
  enabled: { id: string; definition: string; enabled: boolean; valid: boolean }[];
}

export interface AgentStatusResult {
  specVersion: 1;
  command: "agent-status";
  agents: {
    id: string;
    enabled: boolean;
    definitionId: string;
    valid: boolean;
    strategy: string;
    outputs: { path: string; state: string }[];
  }[];
}

export function addAgent(startDir: string, id: string): AgentAddResult {
  const snapshot = resolveFrom(startDir);
  const definition = resolveDefinition(id, definitionSearchDirs(snapshot));
  const created = upsertManifestAgent(snapshot.active.manifestPath, id, definition.id).created;
  return {
    specVersion: SPEC_VERSION,
    command: "agent-add",
    ok: true,
    id,
    definitionId: definition.id,
    created,
    sourcePath: definition.sourcePath,
  };
}

export function removeAgent(startDir: string, id: string): AgentRemoveResult {
  const snapshot = resolveFrom(startDir);
  const instance = snapshot.agents.find((agent) => agent.id === id);
  if (instance === undefined) {
    throw new AiwError("VALIDATION", `Agent '${id}' is not registered.`, {
      suggestion: "Run `aiw agent list` to see registered agents.",
    });
  }
  let leftover: string[] = [];
  try {
    const definition = resolveDefinition(instance.definitionId, definitionSearchDirs(snapshot));
    leftover = leftoverGenerated(definition, snapshot);
  } catch {
    leftover = [];
  }
  removeManifestAgent(snapshot.active.manifestPath, id);
  return {
    specVersion: SPEC_VERSION,
    command: "agent-remove",
    ok: true,
    id,
    leftoverGenerated: leftover,
  };
}

export function listAgents(startDir: string): AgentListResult {
  const discovered = discoverScope(startDir);
  if (discovered === undefined) {
    throw new AiwError("NOT_FOUND", `No .ai/manifest.yaml found from ${startDir}.`, {
      suggestion: "Run `aiw init` in the project directory.",
    });
  }
  const snapshot = resolveScope(loadScope(discovered.root));
  const bundledIds = new Set(listBundledDefinitions().map((item) => item.id));
  const available = listDefinitions(definitionSearchDirs(snapshot)).map((definition) => ({
    id: definition.id,
    name: definition.name,
    capabilities: [...definition.capabilities],
    source: bundledIds.has(definition.id) ? ("bundled" as const) : ("local" as const),
    valid: true as const,
  }));
  const enabled = snapshot.agents.map((agent) => {
    let valid = true;
    try {
      resolveDefinition(agent.definitionId, definitionSearchDirs(snapshot));
    } catch {
      valid = false;
    }
    return {
      id: agent.id,
      definition: agent.definitionId,
      enabled: agent.enabled,
      valid,
    };
  });
  return {
    specVersion: SPEC_VERSION,
    command: "agent-list",
    available,
    enabled,
  };
}

export function agentStatus(startDir: string): AgentStatusResult {
  const snapshot = resolveFrom(startDir);
  const dirs = definitionSearchDirs(snapshot);
  const agents = snapshot.agents.map((agent) => {
    let definition: AgentDefinition | undefined;
    let valid = true;
    try {
      definition = resolveDefinition(agent.definitionId, dirs);
    } catch {
      valid = false;
    }
    const outputs =
      definition === undefined
        ? []
        : planArtifacts(definition, snapshot).map((artifact) => ({
            path: artifact.posixPath,
            state: artifact.state,
          }));
    return {
      id: agent.id,
      enabled: agent.enabled,
      definitionId: agent.definitionId,
      valid,
      strategy: agent.strategy,
      outputs,
    };
  });
  return {
    specVersion: SPEC_VERSION,
    command: "agent-status",
    agents,
  };
}
