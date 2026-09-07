import path from "node:path";
import { AI_DIR_NAME, SPEC_VERSION } from "../config/constants.js";
import { definitionSearchDirs, listDefinitions, resolveDefinition } from "../agents/index.js";
import { agentDefinitionFile, assertValidAgentId } from "../agents/ids.js";
import { parseAgentDefinition } from "../agents/parse.js";
import { renderAgentDefinitionStub } from "../agents/stub.js";
import type { AgentDefinition } from "../agents/types.js";
import { leftoverGenerated, planArtifacts } from "../adapters/engine.js";
import { discoverScope } from "../filesystem/discovery.js";
import { isFile, writeFileAtomic } from "../filesystem/io.js";
import { isInsideOrEqual, relativePosix } from "../filesystem/paths.js";
import { removeManifestAgent, upsertManifestAgent } from "../manifest/write.js";
import { loadScope, resolveFrom, resolveScope } from "../resolution/index.js";
import { AiwError } from "./errors.js";

export interface AgentCreateResult {
  specVersion: 1;
  command: "agent-create";
  ok: true;
  id: string;
  path: string;
}

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

export function createAgent(startDir: string, id: string): AgentCreateResult {
  const discovered = discoverScope(startDir);
  if (discovered === undefined) {
    throw new AiwError("NOT_FOUND", `No .ai/manifest.yaml found from ${startDir}.`, {
      suggestion: "Run `aiw init` in the project directory.",
    });
  }
  const scope = loadScope(discovered.root);
  const safeId = assertValidAgentId(id);
  const agentsDir = path.join(scope.root, AI_DIR_NAME, "agents");
  const dest = agentDefinitionFile(agentsDir, safeId);
  if (isFile(dest)) {
    throw new AiwError("CONFLICT", `Agent definition already exists: ${relativePosix(scope.root, dest)}`, {
      suggestion: "Choose a different id. Existing definitions are not overwritten.",
    });
  }
  const yaml = renderAgentDefinitionStub(safeId);
  const parsed = parseAgentDefinition(yaml, dest);
  if (!parsed.ok) {
    throw new AiwError(
      "VALIDATION",
      `Invalid generated definition: ${parsed.issues.map((issue) => issue.message).join("; ")}`,
    );
  }
  writeFileAtomic(dest, yaml);
  if (!isInsideOrEqual(agentsDir, dest)) {
    throw new AiwError("IO", "Refusing to write an Agent Definition outside .ai/agents/.");
  }
  return {
    specVersion: SPEC_VERSION,
    command: "agent-create",
    ok: true,
    id: parsed.definition.id,
    path: relativePosix(scope.root, dest),
  };
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
  const available = listDefinitions(definitionSearchDirs(snapshot)).map((definition) => ({
    id: definition.id,
    name: definition.name,
    capabilities: [...definition.capabilities],
    source: definitionOrigin(definition, snapshot),
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

function definitionOrigin(definition: AgentDefinition, snapshot: ReturnType<typeof resolveFrom>): "bundled" | "local" {
  for (const entry of snapshot.chain) {
    const agentsDir = path.join(entry.root, AI_DIR_NAME, "agents");
    if (isInsideOrEqual(agentsDir, definition.sourcePath)) {
      return "local";
    }
  }
  return "bundled";
}
