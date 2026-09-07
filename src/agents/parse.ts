import {
  ADAPTER_ENGINE_IDS,
  ADAPTER_STRATEGIES,
  AGENT_CAPABILITIES,
  AGENT_ID_PATTERN,
  CONCAT_ORDERS,
  FORMAT_ENGINE_IDS,
  PROVENANCE_MODES,
  SPEC_VERSION,
} from "../config/constants.js";
import { isValidAgentId } from "./ids.js";
import { toPosixPath } from "../filesystem/paths.js";
import { parseYamlDocument } from "../manifest/parse.js";
import type {
  AdapterEngineId,
  AdapterStrategy,
  AgentCapability,
  AgentDefinition,
  AgentMapping,
  ConcatOrder,
  DefinitionIssue,
  FormatEngineId,
  ProvenanceMode,
} from "./types.js";

export function parseAgentDefinition(text: string, sourcePath: string): { ok: true; definition: AgentDefinition } | { ok: false; issues: DefinitionIssue[] } {
  let raw: unknown;
  try {
    raw = parseYamlDocument(text);
  } catch (error) {
    return {
      ok: false,
      issues: [{ path: "", message: error instanceof Error ? error.message : String(error) }],
    };
  }
  return validateAgentDefinition(raw, sourcePath);
}

export function validateAgentDefinition(
  raw: unknown,
  sourcePath: string,
): { ok: true; definition: AgentDefinition } | { ok: false; issues: DefinitionIssue[] } {
  const issues: DefinitionIssue[] = [];
  if (!isPlainObject(raw)) {
    return { ok: false, issues: [{ path: "", message: "Agent definition must be a mapping." }] };
  }

  for (const key of Object.keys(raw)) {
    if (!["specVersion", "kind", "id", "name", "capabilities", "native", "adapter"].includes(key)) {
      issues.push({ path: key, message: `Unknown definition key '${key}'.` });
    }
  }

  if (raw["specVersion"] !== SPEC_VERSION) {
    issues.push({
      path: "specVersion",
      message: `Unsupported specVersion '${String(raw["specVersion"])}'.`,
    });
  }
  if (raw["kind"] !== "agent-definition") {
    issues.push({ path: "kind", message: "kind must be 'agent-definition'." });
  }
  const id = raw["id"];
  if (typeof id !== "string" || !AGENT_ID_PATTERN.test(id) || !isValidAgentId(id)) {
    issues.push({ path: "id", message: "id must be a portable Agent ID ([a-z0-9][a-z0-9._-]*)." });
  }
  const name = raw["name"];
  if (typeof name !== "string" || name.trim() === "") {
    issues.push({ path: "name", message: "name is required." });
  }

  const capabilities = parseCapabilities(raw["capabilities"], issues);
  const native = parseNative(raw["native"], issues);
  const adapter = parseAdapter(raw["adapter"], issues);

  if (issues.length > 0 || typeof id !== "string" || typeof name !== "string" || adapter === undefined) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    definition: {
      specVersion: SPEC_VERSION,
      kind: "agent-definition",
      id,
      name,
      capabilities,
      native,
      adapter,
      sourcePath,
    },
  };
}

function parseCapabilities(raw: unknown, issues: DefinitionIssue[]): AgentCapability[] {
  if (raw === undefined) {
    return [];
  }
  if (!Array.isArray(raw) || raw.some((item) => typeof item !== "string")) {
    issues.push({ path: "capabilities", message: "capabilities must be an array of strings." });
    return [];
  }
  const result: AgentCapability[] = [];
  for (const item of raw) {
    if (!(AGENT_CAPABILITIES as readonly string[]).includes(item)) {
      issues.push({ path: "capabilities", message: `Unknown capability '${item}'.` });
    } else {
      result.push(item as AgentCapability);
    }
  }
  return [...new Set(result)].sort();
}

function parseNative(
  raw: unknown,
  issues: DefinitionIssue[],
): { roots: string[]; files: string[] } {
  if (raw === undefined) {
    return { roots: [], files: [] };
  }
  if (!isPlainObject(raw)) {
    issues.push({ path: "native", message: "native must be a mapping." });
    return { roots: [], files: [] };
  }
  for (const key of Object.keys(raw)) {
    if (key !== "roots" && key !== "files") {
      issues.push({ path: `native.${key}`, message: `Unknown native key '${key}'.` });
    }
  }
  return {
    roots: parsePosixList(raw["roots"], "native.roots", issues),
    files: parsePosixList(raw["files"], "native.files", issues),
  };
}

function parseAdapter(
  raw: unknown,
  issues: DefinitionIssue[],
): AgentDefinition["adapter"] | undefined {
  if (!isPlainObject(raw)) {
    issues.push({ path: "adapter", message: "adapter is required and must be a mapping." });
    return undefined;
  }
  for (const key of Object.keys(raw)) {
    if (!["engine", "strategy", "mappings"].includes(key)) {
      issues.push({ path: `adapter.${key}`, message: `Unknown adapter key '${key}'.` });
    }
  }
  const engine = raw["engine"];
  if (engine === "executable") {
    issues.push({
      path: "adapter.engine",
      message: "executable adapters are forbidden in spec v1.",
    });
  } else if (typeof engine !== "string" || !(ADAPTER_ENGINE_IDS as readonly string[]).includes(engine)) {
    issues.push({
      path: "adapter.engine",
      message: "adapter.engine must be 'declarative'.",
    });
  }
  let strategy: AdapterStrategy = "generated";
  if (raw["strategy"] !== undefined) {
    if (typeof raw["strategy"] !== "string" || !(ADAPTER_STRATEGIES as readonly string[]).includes(raw["strategy"])) {
      issues.push({ path: "adapter.strategy", message: "Invalid adapter strategy." });
    } else {
      strategy = raw["strategy"] as AdapterStrategy;
    }
  }
  const mappings = parseMappings(raw["mappings"], issues);
  if (issues.length > 0) {
    return undefined;
  }
  return {
    engine: engine as AdapterEngineId,
    strategy,
    mappings,
  };
}

function parseMappings(raw: unknown, issues: DefinitionIssue[]): AgentMapping[] {
  if (raw === undefined) {
    return [];
  }
  if (!Array.isArray(raw)) {
    issues.push({ path: "adapter.mappings", message: "adapter.mappings must be an array." });
    return [];
  }
  const mappings: AgentMapping[] = [];
  raw.forEach((entry, index) => {
    const pathPrefix = `adapter.mappings.${index}`;
    if (!isPlainObject(entry)) {
      issues.push({ path: pathPrefix, message: "Mapping must be a mapping." });
      return;
    }
    for (const key of Object.keys(entry)) {
      if (!["fromKind", "from", "to", "format", "frontmatter", "order", "wrap", "provenance"].includes(key)) {
        issues.push({ path: `${pathPrefix}.${key}`, message: `Unknown mapping key '${key}'.` });
      }
    }
    if (typeof entry["fromKind"] !== "string" || entry["fromKind"].trim() === "") {
      issues.push({ path: `${pathPrefix}.fromKind`, message: "fromKind is required." });
    }
    if (typeof entry["from"] !== "string" || entry["from"].trim() === "") {
      issues.push({ path: `${pathPrefix}.from`, message: "from is required." });
    }
    if (typeof entry["to"] !== "string" || entry["to"].trim() === "") {
      issues.push({ path: `${pathPrefix}.to`, message: "to is required." });
    }
    const format = entry["format"];
    if (typeof format !== "string" || !(FORMAT_ENGINE_IDS as readonly string[]).includes(format)) {
      issues.push({ path: `${pathPrefix}.format`, message: "Unknown format engine." });
    }
    let order: ConcatOrder = "identity";
    if (entry["order"] !== undefined) {
      if (typeof entry["order"] !== "string" || !(CONCAT_ORDERS as readonly string[]).includes(entry["order"])) {
        issues.push({ path: `${pathPrefix}.order`, message: "Invalid concatenation order." });
      } else {
        order = entry["order"] as ConcatOrder;
      }
    }
    let provenance: ProvenanceMode = "header";
    if (entry["provenance"] !== undefined) {
      if (typeof entry["provenance"] !== "string" || !(PROVENANCE_MODES as readonly string[]).includes(entry["provenance"])) {
        issues.push({ path: `${pathPrefix}.provenance`, message: "provenance must be 'header' or 'none'." });
      } else {
        provenance = entry["provenance"] as ProvenanceMode;
      }
    }
    const frontmatter = parseFrontmatter(entry["frontmatter"], pathPrefix, issues);
    const wrap = parseWrap(entry["wrap"], pathPrefix, issues);
    if (typeof entry["fromKind"] === "string" && typeof entry["from"] === "string" && typeof entry["to"] === "string" && typeof format === "string" && (FORMAT_ENGINE_IDS as readonly string[]).includes(format)) {
      mappings.push({
        fromKind: entry["fromKind"],
        from: toPosixPath(entry["from"]),
        to: toPosixPath(entry["to"]),
        format: format as FormatEngineId,
        frontmatter,
        order,
        wrap,
        provenance,
      });
    }
  });
  return mappings;
}

function parseFrontmatter(
  raw: unknown,
  pathPrefix: string,
  issues: DefinitionIssue[],
): Record<string, string> {
  if (raw === undefined) {
    return {};
  }
  if (!isPlainObject(raw)) {
    issues.push({ path: `${pathPrefix}.frontmatter`, message: "frontmatter must be a mapping." });
    return {};
  }
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== "string") {
      issues.push({
        path: `${pathPrefix}.frontmatter.${key}`,
        message: "frontmatter values must be strings.",
      });
      continue;
    }
    result[key] = value;
  }
  return result;
}

function parseWrap(
  raw: unknown,
  pathPrefix: string,
  issues: DefinitionIssue[],
): { heading: string; separator: string } {
  const defaults = { heading: "", separator: "\n\n" };
  if (raw === undefined) {
    return defaults;
  }
  if (!isPlainObject(raw)) {
    issues.push({ path: `${pathPrefix}.wrap`, message: "wrap must be a mapping." });
    return defaults;
  }
  for (const key of Object.keys(raw)) {
    if (key !== "heading" && key !== "separator") {
      issues.push({ path: `${pathPrefix}.wrap.${key}`, message: `Unknown wrap key '${key}'.` });
    }
  }
  return {
    heading: typeof raw["heading"] === "string" ? raw["heading"] : "",
    separator: typeof raw["separator"] === "string" ? raw["separator"] : "\n\n",
  };
}

function parsePosixList(raw: unknown, path: string, issues: DefinitionIssue[]): string[] {
  if (raw === undefined) {
    return [];
  }
  if (!Array.isArray(raw) || raw.some((item) => typeof item !== "string")) {
    issues.push({ path, message: `${path} must be an array of strings.` });
    return [];
  }
  return raw.map((item) => toPosixPath(item));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
