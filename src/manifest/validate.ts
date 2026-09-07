import {
  ADAPTER_STRATEGIES,
  BUILTIN_EXCLUSIONS,
  DEFAULT_CONTEXT_INCLUDE,
  DEFAULT_MAX_FILE_BYTES,
  INHERITANCE_MODES,
  MANIFEST_TOP_LEVEL_KEYS,
  NAME_PATTERN,
  AGENT_ID_PATTERN,
  RESERVED_AI_NAMES,
  SCOPE_KINDS,
  SOURCE_CAPABILITIES,
  SOURCE_TYPES,
  SPEC_VERSION,
} from "../config/constants.js";
import { toPosixPath } from "../filesystem/paths.js";
import type {
  AdapterStrategy,
  AgentInstance,
  ContextConfig,
  ExtendsEntry,
  InheritanceMode,
  Manifest,
  ManifestIssue,
  Policies,
  ProjectRegistration,
  SchemaValidationResult,
  ScopeKind,
  SourceCapability,
  SourceConfig,
  SourceType,
} from "./types.js";

const TOP_LEVEL = new Set<string>(MANIFEST_TOP_LEVEL_KEYS);

export function validateManifestSchema(raw: unknown): SchemaValidationResult {
  const issues: ManifestIssue[] = [];
  if (!isPlainObject(raw)) {
    return {
      ok: false,
      issues: [{ path: "", message: "Manifest must be a YAML mapping." }],
    };
  }

  for (const key of Object.keys(raw)) {
    if (!TOP_LEVEL.has(key)) {
      issues.push({ path: key, message: `Unknown top-level key '${key}'.` });
    }
  }

  const specVersion = raw["specVersion"];
  if (specVersion !== SPEC_VERSION) {
    issues.push({
      path: "specVersion",
      message: `Unsupported specVersion '${stringifyUnknown(specVersion)}' (expected ${SPEC_VERSION}).`,
    });
  }

  const kind = raw["kind"];
  if (!isScopeKind(kind)) {
    issues.push({
      path: "kind",
      message: `Invalid kind '${stringifyUnknown(kind)}' (expected 'project' or 'workspace').`,
    });
  }

  const name = raw["name"];
  if (typeof name !== "string" || !NAME_PATTERN.test(name)) {
    issues.push({
      path: "name",
      message: `Invalid name '${stringifyUnknown(name)}' (expected 1–64 chars matching [a-z0-9][a-z0-9-]*).`,
    });
  }

  let description: string | undefined;
  if (raw["description"] !== undefined) {
    if (typeof raw["description"] !== "string") {
      issues.push({ path: "description", message: "description must be a string." });
    } else {
      description = raw["description"];
    }
  }

  const extendsResult = parseExtends(raw["extends"], issues);
  const context = parseContext(raw["context"], issues);
  const sources = parseKeyedMap(raw["sources"], "sources", issues, parseSource);
  const agents = parseKeyedMap(raw["agents"], "agents", issues, parseAgent, AGENT_ID_PATTERN);
  const projects = parseProjects(raw["projects"], kind, issues);
  const policies = parsePolicies(raw["policies"], issues);

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  if (!isScopeKind(kind) || typeof name !== "string") {
    return { ok: false, issues: [{ path: "", message: "Manifest is invalid." }] };
  }

  const manifest: Manifest = {
    specVersion: SPEC_VERSION,
    kind,
    name,
    description,
    extends: extendsResult,
    context,
    sources,
    agents,
    projects,
    policies,
  };
  return { ok: true, manifest };
}

function parseExtends(raw: unknown, issues: ManifestIssue[]): ExtendsEntry | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!Array.isArray(raw)) {
    issues.push({ path: "extends", message: "extends must be an array." });
    return undefined;
  }
  if (raw.length === 0) {
    return undefined;
  }
  if (raw.length > 1) {
    issues.push({
      path: "extends",
      message: "v1 allows at most one extends entry (single parent).",
    });
    return undefined;
  }
  const entry = raw[0];
  if (!isPlainObject(entry)) {
    issues.push({ path: "extends.0", message: "extends entry must be a mapping." });
    return undefined;
  }
  for (const key of Object.keys(entry)) {
    if (key !== "path" && key !== "mode" && key !== "exclude") {
      issues.push({ path: `extends.0.${key}`, message: `Unknown extends key '${key}'.` });
    }
  }
  if (typeof entry["path"] !== "string" || entry["path"].trim() === "") {
    issues.push({ path: "extends.0.path", message: "extends.path is required." });
    return undefined;
  }
  let mode: InheritanceMode = "extend";
  if (entry["mode"] !== undefined) {
    if (!isInheritanceMode(entry["mode"])) {
      issues.push({
        path: "extends.0.mode",
        message: `Invalid inheritance mode '${stringifyUnknown(entry["mode"])}'.`,
      });
    } else {
      mode = entry["mode"];
    }
  }
  const exclude = parseStringArray(entry["exclude"], "extends.0.exclude", issues);
  return {
    path: toPosixPath(entry["path"]),
    mode,
    exclude,
  };
}

function parseContext(raw: unknown, issues: ManifestIssue[]): ContextConfig {
  if (raw === undefined) {
    return {
      include: [...DEFAULT_CONTEXT_INCLUDE],
      exclude: [],
    };
  }
  if (!isPlainObject(raw)) {
    issues.push({ path: "context", message: "context must be a mapping." });
    return { include: [...DEFAULT_CONTEXT_INCLUDE], exclude: [] };
  }
  for (const key of Object.keys(raw)) {
    if (key !== "include" && key !== "exclude") {
      issues.push({ path: `context.${key}`, message: `Unknown context key '${key}'.` });
    }
  }
  const include =
    raw["include"] === undefined
      ? [...DEFAULT_CONTEXT_INCLUDE]
      : parseStringArray(raw["include"], "context.include", issues);
  const exclude = parseStringArray(raw["exclude"], "context.exclude", issues);
  for (const glob of include) {
    if (includeTargetsReserved(glob)) {
      issues.push({
        path: "context.include",
        message: `context.include must not target reserved path '${glob}'.`,
      });
    }
  }
  return { include, exclude };
}

function parseSource(raw: unknown, path: string, issues: ManifestIssue[]): SourceConfig | undefined {
  if (!isPlainObject(raw)) {
    issues.push({ path, message: "Source must be a mapping." });
    return undefined;
  }
  for (const key of Object.keys(raw)) {
    if (!["type", "path", "capabilities", "include", "exclude"].includes(key)) {
      issues.push({ path: `${path}.${key}`, message: `Unknown source key '${key}'.` });
    }
  }
  const type = raw["type"];
  if (!isSourceType(type)) {
    issues.push({
      path: `${path}.type`,
      message: `Invalid source type '${stringifyUnknown(type)}'.`,
    });
    return undefined;
  }
  if (typeof raw["path"] !== "string" || raw["path"].trim() === "") {
    issues.push({ path: `${path}.path`, message: "Source path is required." });
    return undefined;
  }
  const capabilitiesRaw = raw["capabilities"];
  let capabilities: SourceCapability[] = ["read"];
  if (capabilitiesRaw !== undefined) {
    if (!Array.isArray(capabilitiesRaw) || capabilitiesRaw.some((item) => typeof item !== "string")) {
      issues.push({ path: `${path}.capabilities`, message: "capabilities must be an array of strings." });
    } else {
      capabilities = [];
      for (const item of capabilitiesRaw) {
        if (!isSourceCapability(item)) {
          issues.push({
            path: `${path}.capabilities`,
            message: `Unknown source capability '${item}'.`,
          });
        } else {
          capabilities.push(item);
        }
      }
      capabilities.sort();
    }
  }
  const include =
    raw["include"] === undefined
      ? ["**/*"]
      : parseStringArray(raw["include"], `${path}.include`, issues);
  const exclude = parseStringArray(raw["exclude"], `${path}.exclude`, issues);
  return {
    type,
    path: toPosixPath(raw["path"]),
    capabilities,
    include,
    exclude,
  };
}

function parseAgent(raw: unknown, path: string, issues: ManifestIssue[]): AgentInstance | undefined {
  if (!isPlainObject(raw)) {
    issues.push({ path, message: "Agent instance must be a mapping." });
    return undefined;
  }
  for (const key of Object.keys(raw)) {
    if (!["enabled", "definition", "adapter"].includes(key)) {
      issues.push({ path: `${path}.${key}`, message: `Unknown agent key '${key}'.` });
    }
  }
  let enabled = true;
  if (raw["enabled"] !== undefined) {
    if (typeof raw["enabled"] !== "boolean") {
      issues.push({ path: `${path}.enabled`, message: "enabled must be a boolean." });
    } else {
      enabled = raw["enabled"];
    }
  }
  const id = path.slice("agents.".length);
  let definition = id;
  if (raw["definition"] !== undefined) {
    if (typeof raw["definition"] !== "string" || !AGENT_ID_PATTERN.test(raw["definition"])) {
      issues.push({ path: `${path}.definition`, message: "definition must be a valid id." });
    } else {
      definition = raw["definition"];
    }
  }
  let strategy: AdapterStrategy = "generated";
  if (raw["adapter"] !== undefined) {
    if (!isPlainObject(raw["adapter"])) {
      issues.push({ path: `${path}.adapter`, message: "adapter must be a mapping." });
    } else {
      for (const key of Object.keys(raw["adapter"])) {
        if (key !== "strategy") {
          issues.push({
            path: `${path}.adapter.${key}`,
            message: `Unknown adapter key '${key}'.`,
          });
        }
      }
      const rawStrategy = raw["adapter"]["strategy"];
      if (rawStrategy !== undefined) {
        if (!isAdapterStrategy(rawStrategy)) {
          issues.push({
            path: `${path}.adapter.strategy`,
            message: `Invalid adapter strategy '${stringifyUnknown(rawStrategy)}'.`,
          });
        } else {
          strategy = rawStrategy;
        }
      }
    }
  }
  return { enabled, definition, adapter: { strategy } };
}

function parseProjects(
  raw: unknown,
  kind: unknown,
  issues: ManifestIssue[],
): Record<string, ProjectRegistration> {
  if (raw === undefined) {
    return {};
  }
  if (kind === "project") {
    issues.push({ path: "projects", message: "projects is only valid on kind: workspace." });
    return {};
  }
  return parseKeyedMap(raw, "projects", issues, (entry, path, inner) => {
    if (!isPlainObject(entry)) {
      inner.push({ path, message: "Project registration must be a mapping." });
      return undefined;
    }
    for (const key of Object.keys(entry)) {
      if (key !== "path") {
        inner.push({ path: `${path}.${key}`, message: `Unknown project key '${key}'.` });
      }
    }
    if (typeof entry["path"] !== "string" || entry["path"].trim() === "") {
      inner.push({ path: `${path}.path`, message: "Project path is required." });
      return undefined;
    }
    const posix = toPosixPath(entry["path"]);
    if (posix === ".." || posix.startsWith("../") || posix.includes("/../") || posix.endsWith("/..")) {
      inner.push({
        path: `${path}.path`,
        message: "Project path must stay inside the workspace (no '..').",
      });
      return undefined;
    }
    return { path: posix };
  });
}

function parsePolicies(raw: unknown, issues: ManifestIssue[]): Policies {
  const defaults: Policies = {
    exclusions: [...BUILTIN_EXCLUSIONS],
    maxFileBytes: DEFAULT_MAX_FILE_BYTES,
    trust: { executableAdapters: false, executableSources: false },
  };
  if (raw === undefined) {
    return defaults;
  }
  if (!isPlainObject(raw)) {
    issues.push({ path: "policies", message: "policies must be a mapping." });
    return defaults;
  }
  for (const key of Object.keys(raw)) {
    if (!["exclusions", "maxFileBytes", "trust"].includes(key)) {
      issues.push({ path: `policies.${key}`, message: `Unknown policies key '${key}'.` });
    }
  }
  const extraExclusions = parseStringArray(raw["exclusions"], "policies.exclusions", issues);
  let maxFileBytes = DEFAULT_MAX_FILE_BYTES;
  if (raw["maxFileBytes"] !== undefined) {
    if (
      typeof raw["maxFileBytes"] !== "number" ||
      !Number.isInteger(raw["maxFileBytes"]) ||
      raw["maxFileBytes"] <= 0
    ) {
      issues.push({
        path: "policies.maxFileBytes",
        message: "maxFileBytes must be a positive integer.",
      });
    } else {
      maxFileBytes = raw["maxFileBytes"];
    }
  }
  if (raw["trust"] !== undefined) {
    if (!isPlainObject(raw["trust"])) {
      issues.push({ path: "policies.trust", message: "trust must be a mapping." });
    } else {
      for (const key of Object.keys(raw["trust"])) {
        if (key !== "executableAdapters" && key !== "executableSources") {
          issues.push({
            path: `policies.trust.${key}`,
            message: `Unknown trust key '${key}'.`,
          });
        }
      }
      for (const flag of ["executableAdapters", "executableSources"] as const) {
        if (raw["trust"][flag] === true) {
          issues.push({
            path: `policies.trust.${flag}`,
            message: `${flag} cannot be true in spec v1.`,
          });
        } else if (raw["trust"][flag] !== undefined && raw["trust"][flag] !== false) {
          issues.push({
            path: `policies.trust.${flag}`,
            message: `${flag} must be false.`,
          });
        }
      }
    }
  }
  return {
    exclusions: uniqueSorted([...BUILTIN_EXCLUSIONS, ...extraExclusions]),
    maxFileBytes,
    trust: { executableAdapters: false, executableSources: false },
  };
}

function parseKeyedMap<T>(
  raw: unknown,
  path: string,
  issues: ManifestIssue[],
  parseEntry: (value: unknown, entryPath: string, issues: ManifestIssue[]) => T | undefined,
  idPattern: RegExp = NAME_PATTERN,
): Record<string, T> {
  if (raw === undefined) {
    return {};
  }
  if (!isPlainObject(raw)) {
    issues.push({ path, message: `${path} must be a mapping.` });
    return {};
  }
  const result: Record<string, T> = {};
  const keys = Object.keys(raw).sort();
  for (const key of keys) {
    if (!idPattern.test(key)) {
      issues.push({ path: `${path}.${key}`, message: `Invalid ${path} id '${key}'.` });
      continue;
    }
    const parsed = parseEntry(raw[key], `${path}.${key}`, issues);
    if (parsed !== undefined) {
      result[key] = parsed;
    }
  }
  return result;
}

function parseStringArray(raw: unknown, path: string, issues: ManifestIssue[]): string[] {
  if (raw === undefined) {
    return [];
  }
  if (!Array.isArray(raw) || raw.some((item) => typeof item !== "string")) {
    issues.push({ path, message: `${path} must be an array of strings.` });
    return [];
  }
  return raw.map((item) => toPosixPath(item));
}

function includeTargetsReserved(glob: string): boolean {
  const posix = toPosixPath(glob).replace(/^\.\//, "");
  const first = posix.split("/")[0] ?? posix;
  const literal = first.replaceAll("\\", "");
  if (literal === "manifest.yaml") {
    return true;
  }
  for (const reserved of RESERVED_AI_NAMES) {
    if (reserved === "manifest.yaml") {
      continue;
    }
    if (literal === reserved) {
      return true;
    }
  }
  return false;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort(compare);
}

function compare(a: string, b: string): number {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isScopeKind(value: unknown): value is ScopeKind {
  return typeof value === "string" && (SCOPE_KINDS as readonly string[]).includes(value);
}

function isInheritanceMode(value: unknown): value is InheritanceMode {
  return typeof value === "string" && (INHERITANCE_MODES as readonly string[]).includes(value);
}

function isSourceType(value: unknown): value is SourceType {
  return typeof value === "string" && (SOURCE_TYPES as readonly string[]).includes(value);
}

function isSourceCapability(value: unknown): value is SourceCapability {
  return typeof value === "string" && (SOURCE_CAPABILITIES as readonly string[]).includes(value);
}

function isAdapterStrategy(value: unknown): value is AdapterStrategy {
  return typeof value === "string" && (ADAPTER_STRATEGIES as readonly string[]).includes(value);
}

function stringifyUnknown(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === undefined) {
    return "undefined";
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
