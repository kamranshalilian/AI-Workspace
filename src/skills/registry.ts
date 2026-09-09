import fs from "node:fs";
import path from "node:path";
import { sha256 } from "../filesystem/io.js";
import { comparePosix } from "../filesystem/paths.js";
import type { EffectiveSnapshot, ResolvedResource, ResolvedSource } from "../resolution/types.js";
import { SKILL_ARTIFACT_BASENAME } from "../config/constants.js";
import { skillArtifactIdentity, skillVersionIdentity } from "./identity.js";
import { tryParseSkillMarkdown } from "./parse.js";
import type {
  SkillOriginKind,
  SkillProvenance,
  SkillRegistry,
  SkillRegistryEntry,
  SkillSourceRef,
} from "./types.js";

/**
 * Interpret merged `skills:` declarations against the already-resolved snapshot.
 * Does not walk parent manifests, copy files, or execute scripts.
 */
export function skillRegistry(snapshot: EffectiveSnapshot): SkillRegistry {
  const entries: SkillRegistryEntry[] = snapshot.skills.map((declared) =>
    interpretDeclared(snapshot, declared.id, declared.enabled, declared.sourceId, declared.originRoot, declared.originName),
  );
  entries.sort((a, b) => comparePosix(a.id, b.id));
  return { entries };
}

function interpretDeclared(
  snapshot: EffectiveSnapshot,
  id: string,
  enabled: boolean,
  sourceId: string | undefined,
  originRoot: string,
  originName: string,
): SkillRegistryEntry {
  if (!enabled) {
    return {
      id,
      enabled: false,
      status: "disabled",
      source: sourceRef(id, sourceId),
      originKind: originKind(snapshot, originRoot, sourceId),
      originName,
      originRoot,
      versionIdentity: id,
    };
  }
  if (sourceId !== undefined) {
    return interpretFederated(snapshot, id, sourceId, originRoot, originName);
  }
  return interpretCanonical(snapshot, id, originRoot, originName);
}

function interpretCanonical(
  snapshot: EffectiveSnapshot,
  id: string,
  originRoot: string,
  originName: string,
): SkillRegistryEntry {
  const identity = skillArtifactIdentity(id);
  const resource = snapshot.resources.find((item) => item.identity === identity);
  const source = sourceRef(id, undefined);
  const kind = originKind(snapshot, originRoot, undefined);
  if (resource === undefined) {
    return {
      id,
      enabled: true,
      status: "missing",
      source,
      originKind: kind,
      originName,
      originRoot,
      versionIdentity: id,
    };
  }
  return entryFromArtifact(id, source, kind, resource.originName, resource.originRoot, resource.absolutePath, {
    identity: resource.identity,
    hash: resource.hash,
    canonical: true,
  });
}

function interpretFederated(
  snapshot: EffectiveSnapshot,
  id: string,
  sourceId: string,
  originRoot: string,
  originName: string,
): SkillRegistryEntry {
  const source = sourceRef(id, sourceId);
  const kind: SkillOriginKind = "external";
  const resolvedSource = snapshot.sources.find((item) => item.id === sourceId);
  if (resolvedSource === undefined) {
    return {
      id,
      enabled: true,
      status: "invalid",
      source,
      originKind: kind,
      originName,
      originRoot,
      versionIdentity: id,
      invalidReason: `unknown source '${sourceId}'`,
    };
  }
  if (resolvedSource.status !== "resolved") {
    return {
      id,
      enabled: true,
      status: "missing",
      source,
      originKind: kind,
      originName,
      originRoot,
      versionIdentity: id,
      invalidReason: `source '${sourceId}' is ${resolvedSource.status}`,
    };
  }
  const relative = federatedSkillRelativePath(id, resolvedSource);
  if (relative === undefined) {
    return {
      id,
      enabled: true,
      status: "missing",
      source,
      originKind: kind,
      originName,
      originRoot,
      versionIdentity: id,
    };
  }
  const absolutePath = path.join(resolvedSource.resolvedPath, ...relative.split("/"));
  return entryFromArtifact(id, source, kind, originName, originRoot, absolutePath, {
    identity: `source:${sourceId}:${relative}`,
    hash: undefined,
    canonical: false,
  });
}

function entryFromArtifact(
  id: string,
  source: SkillSourceRef,
  kind: SkillOriginKind,
  originName: string,
  originRoot: string,
  absolutePath: string,
  identity: { identity: string; hash: string | undefined; canonical: boolean },
): SkillRegistryEntry {
  let text: string;
  try {
    text = fs.readFileSync(absolutePath, "utf8");
  } catch {
    return {
      id,
      enabled: true,
      status: "missing",
      source,
      originKind: kind,
      originName,
      originRoot,
      versionIdentity: id,
    };
  }
  const parsed = tryParseSkillMarkdown(text);
  if (!parsed.ok) {
    return {
      id,
      enabled: true,
      status: "invalid",
      source,
      originKind: kind,
      originName,
      originRoot,
      versionIdentity: id,
      invalidReason: parsed.message,
    };
  }
  const hash = identity.hash ?? sha256(Buffer.from(text, "utf8"));
  const provenance: SkillProvenance = {
    identity: identity.identity,
    originName,
    originRoot,
    hash,
    canonical: identity.canonical,
    kind,
  };
  return {
    id,
    enabled: true,
    status: "resolved",
    source,
    originKind: kind,
    originName,
    originRoot,
    artifactName: parsed.artifact.name,
    version: parsed.artifact.version,
    versionIdentity: skillVersionIdentity(id, parsed.artifact.version),
    provenance,
  };
}

function federatedSkillRelativePath(id: string, source: ResolvedSource): string | undefined {
  const packaged = `${id}/${SKILL_ARTIFACT_BASENAME}`;
  const nested = source.inventory.some((entry) => entry.relativePath === packaged);
  if (nested) {
    return packaged;
  }
  const root = source.inventory.some((entry) => entry.relativePath === SKILL_ARTIFACT_BASENAME);
  if (root) {
    return SKILL_ARTIFACT_BASENAME;
  }
  return undefined;
}

function sourceRef(id: string, sourceId: string | undefined): SkillSourceRef {
  if (sourceId === undefined) {
    return { type: "canonical", path: skillArtifactIdentity(id) };
  }
  return { type: "federated", id: sourceId, path: SKILL_ARTIFACT_BASENAME };
}

function originKind(snapshot: EffectiveSnapshot, originRoot: string, sourceId: string | undefined): SkillOriginKind {
  if (sourceId !== undefined) {
    return "external";
  }
  if (originRoot !== snapshot.active.root) {
    return "inherited";
  }
  return "canonical";
}

export function resourceOriginKind(snapshot: EffectiveSnapshot, resource: ResolvedResource): SkillOriginKind {
  if (resource.originRoot !== snapshot.active.root) {
    return "inherited";
  }
  return "canonical";
}
