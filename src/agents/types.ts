import type {
  ADAPTER_ENGINE_IDS,
  ADAPTER_STRATEGIES,
  AGENT_CAPABILITIES,
  CONCAT_ORDERS,
  FORMAT_ENGINE_IDS,
  PROVENANCE_MODES,
} from "../config/constants.js";

export type AgentCapability = (typeof AGENT_CAPABILITIES)[number];
export type FormatEngineId = (typeof FORMAT_ENGINE_IDS)[number];
export type AdapterEngineId = (typeof ADAPTER_ENGINE_IDS)[number];
export type ProvenanceMode = (typeof PROVENANCE_MODES)[number];
export type ConcatOrder = (typeof CONCAT_ORDERS)[number];
export type AdapterStrategy = (typeof ADAPTER_STRATEGIES)[number];

export interface AgentMapping {
  fromKind: string;
  from: string;
  to: string;
  format: FormatEngineId;
  frontmatter: Record<string, string>;
  order: ConcatOrder;
  wrap: {
    heading: string;
    separator: string;
  };
  provenance: ProvenanceMode;
}

export interface AgentDefinition {
  specVersion: 1;
  kind: "agent-definition";
  id: string;
  name: string;
  capabilities: AgentCapability[];
  native: {
    roots: string[];
    files: string[];
  };
  adapter: {
    engine: AdapterEngineId;
    strategy: AdapterStrategy;
    mappings: AgentMapping[];
  };
  sourcePath: string;
}

export interface DefinitionIssue {
  path: string;
  message: string;
}
