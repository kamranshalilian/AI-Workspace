import { SPEC_VERSION, SOURCE_TYPES, RESERVED_SOURCE_TYPES } from "../config/constants.js";
import { discoverScope } from "../filesystem/discovery.js";
import { upsertManifestSource, removeManifestSource } from "../manifest/write.js";
import type { SourceCapability, SourceType } from "../manifest/types.js";
import { loadScope, resolveFrom } from "../resolution/index.js";
import type { SourceInventoryEntry, SourceResolutionStatus } from "../resolution/types.js";
import { parseCapabilityList } from "../sources/capabilities.js";
import { assertValidSourceId } from "../sources/ids.js";
import { normalizeDeclaredSourcePath } from "../sources/paths.js";
import { AiwError } from "./errors.js";

export interface SourceAddResult {
  specVersion: 1;
  command: "source-add";
  ok: true;
  id: string;
  type: SourceType;
  path: string;
  capabilities: SourceCapability[];
  status: SourceResolutionStatus;
}

export interface SourceRemoveResult {
  specVersion: 1;
  command: "source-remove";
  ok: true;
  id: string;
}

export interface SourceListItem {
  id: string;
  type: string;
  path: string;
  capabilities: string[];
  status: SourceResolutionStatus;
  origin: string;
  files: SourceInventoryEntry[];
}

export interface SourceListResult {
  specVersion: 1;
  command: "source-list";
  sources: SourceListItem[];
}

export function addSource(
  startDir: string,
  id: string,
  typeRaw: string | undefined,
  pathRaw: string | undefined,
  capabilitiesRaw: string | undefined,
): SourceAddResult {
  const discovered = discoverScope(startDir);
  if (discovered === undefined) {
    throw new AiwError("NOT_FOUND", `No .ai/manifest.yaml found from ${startDir}.`, {
      suggestion: "Run `aiw init` in the project directory.",
    });
  }
  const safeId = assertValidSourceId(id);
  const type = parseSourceType(typeRaw);
  const declaredPath = normalizeDeclaredSourcePath(pathRaw ?? "");
  const capabilities = parseCapabilityList(capabilitiesRaw);
  loadScope(discovered.root);
  upsertManifestSource(discovered.manifestPath, safeId, {
    type,
    path: declaredPath,
    capabilities,
  });
  const snapshot = resolveFrom(discovered.root);
  const resolved = snapshot.sources.find((item) => item.id === safeId);
  return {
    specVersion: SPEC_VERSION,
    command: "source-add",
    ok: true,
    id: safeId,
    type,
    path: declaredPath,
    capabilities,
    status: resolved?.status ?? "unresolved",
  };
}

export function removeSource(startDir: string, id: string): SourceRemoveResult {
  const discovered = discoverScope(startDir);
  if (discovered === undefined) {
    throw new AiwError("NOT_FOUND", `No .ai/manifest.yaml found from ${startDir}.`, {
      suggestion: "Run `aiw init` in the project directory.",
    });
  }
  const safeId = assertValidSourceId(id);
  removeManifestSource(discovered.manifestPath, safeId);
  return {
    specVersion: SPEC_VERSION,
    command: "source-remove",
    ok: true,
    id: safeId,
  };
}

export function listSources(startDir: string): SourceListResult {
  const snapshot = resolveFrom(startDir);
  return {
    specVersion: SPEC_VERSION,
    command: "source-list",
    sources: snapshot.sources.map((source) => ({
      id: source.id,
      type: source.type,
      path: source.declaredPath,
      capabilities: [...source.capabilities],
      status: source.status,
      origin: source.originName,
      files: source.inventory.map((entry) => ({
        relativePath: entry.relativePath,
        identity: entry.identity,
      })),
    })),
  };
}

function parseSourceType(typeRaw: string | undefined): SourceType {
  if (typeRaw === undefined || typeRaw.trim() === "") {
    throw new AiwError("USAGE", "Source type is required.", {
      suggestion: "Usage: aiw source add <id> --type <directory|file|repository|generated> --path <path>.",
    });
  }
  const type = typeRaw.trim();
  if ((RESERVED_SOURCE_TYPES as readonly string[]).includes(type)) {
    throw new AiwError("VALIDATION", `Source type '${type}' is reserved and not available.`, {
      suggestion: "Use directory, file, repository, or generated.",
    });
  }
  if (!(SOURCE_TYPES as readonly string[]).includes(type)) {
    throw new AiwError("VALIDATION", `Invalid source type '${type}'.`, {
      suggestion: "Use directory, file, repository, or generated.",
    });
  }
  return type as SourceType;
}
