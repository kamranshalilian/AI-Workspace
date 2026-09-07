import {
  OPERATIONAL_SOURCE_CAPABILITIES,
  SOURCE_CAPABILITIES,
} from "../config/constants.js";
import { AiwError } from "../core/errors.js";
import type { SourceCapability } from "../manifest/types.js";

const OPERATIONAL = new Set<string>(OPERATIONAL_SOURCE_CAPABILITIES);

export function requireCapability(
  source: { id: string; capabilities: readonly string[] },
  capability: SourceCapability,
  operation: string,
): void {
  if (!source.capabilities.includes(capability)) {
    throw new AiwError(
      "VALIDATION",
      `Source '${source.id}' does not declare capability '${capability}' (required for ${operation}).`,
    );
  }
  if (!OPERATIONAL.has(capability)) {
    throw new AiwError("UNSUPPORTED", `Source capability '${capability}' is not implemented.`, {
      suggestion: "Phase 4 supports read and index only. write, link, import, export, and sync are reserved.",
    });
  }
}

export function parseCapabilityList(raw: string | undefined): SourceCapability[] {
  if (raw === undefined || raw.trim() === "") {
    return ["read"];
  }
  const values: SourceCapability[] = [];
  for (const part of raw.split(",")) {
    const item = part.trim();
    if (item === "") {
      continue;
    }
    if (!(SOURCE_CAPABILITIES as readonly string[]).includes(item)) {
      throw new AiwError("VALIDATION", `Unknown source capability '${item}'.`, {
        suggestion: "Recognized capabilities: read, index, write, link, import, export, sync.",
      });
    }
    if (!values.includes(item as SourceCapability)) {
      values.push(item as SourceCapability);
    }
  }
  if (values.length === 0) {
    return ["read"];
  }
  return [...values].sort();
}
