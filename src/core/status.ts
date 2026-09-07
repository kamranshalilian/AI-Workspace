import { SPEC_VERSION, WELL_KNOWN_KINDS } from "../config/constants.js";
import { comparePosix } from "../filesystem/paths.js";
import { resolveFrom } from "../resolution/index.js";
import type { EffectiveSnapshot } from "../resolution/types.js";

export interface StatusSummary {
  specVersion: 1;
  command: "status";
  ok: boolean;
  active: EffectiveSnapshot["active"];
  inheritance: {
    mode: EffectiveSnapshot["inheritance"]["mode"];
    parent:
      | {
          kind: string;
          name: string;
        }
      | undefined;
    declaredPath: string | undefined;
  };
  resources: {
    total: number;
    byKind: Record<string, { total: number; inherited: number; local: number }>;
    identities: string[];
  };
  sources: { id: string; type: string; status: string; origin: string; capabilities: string[]; path: string }[];
  agents: { id: string; enabled: boolean; definition: string; origin: string }[];
  validation: {
    errors: number;
    warnings: number;
  };
  issues: EffectiveSnapshot["issues"];
}

export function statusFrom(startDir: string): { snapshot: EffectiveSnapshot; summary: StatusSummary } {
  const snapshot = resolveFrom(startDir);
  return { snapshot, summary: summarizeStatus(snapshot) };
}

export function summarizeStatus(snapshot: EffectiveSnapshot): StatusSummary {
  const byKind: StatusSummary["resources"]["byKind"] = {};
  const kinds = new Set<string>([...WELL_KNOWN_KINDS, ...snapshot.resources.map((item) => item.kind)]);
  const kindList = [...kinds].sort(comparePosix);
  for (const kind of kindList) {
    const items = snapshot.resources.filter((item) => item.kind === kind);
    if (items.length === 0 && !(WELL_KNOWN_KINDS as readonly string[]).includes(kind)) {
      continue;
    }
    if (items.length === 0) {
      continue;
    }
    byKind[kind] = {
      total: items.length,
      inherited: items.filter((item) => item.originRoot !== snapshot.active.root).length,
      local: items.filter((item) => item.originRoot === snapshot.active.root).length,
    };
  }

  const errors = snapshot.issues.filter((issue) => issue.severity === "error").length;
  const warnings =
    snapshot.issues.filter((issue) => issue.severity === "warning").length + snapshot.skipped.length;

  return {
    specVersion: SPEC_VERSION,
    command: "status",
    ok: errors === 0,
    active: snapshot.active,
    inheritance: {
      mode: snapshot.inheritance.mode,
      parent: snapshot.inheritance.parent
        ? {
            kind: snapshot.inheritance.parent.kind,
            name: snapshot.inheritance.parent.name,
          }
        : undefined,
      declaredPath: snapshot.inheritance.declaredPath,
    },
    resources: {
      total: snapshot.resources.length,
      byKind,
      identities: snapshot.resources.map((item) => item.identity),
    },
    sources: snapshot.sources.map((source) => ({
      id: source.id,
      type: source.type,
      status: source.status,
      origin: source.originName,
      capabilities: [...source.capabilities],
      path: source.declaredPath,
    })),
    agents: snapshot.agents.map((agent) => ({
      id: agent.id,
      enabled: agent.enabled,
      definition: agent.definitionId,
      origin: agent.originName,
    })),
    validation: { errors, warnings },
    issues: snapshot.issues,
  };
}
