import path from "node:path";
import fs from "node:fs";
import type { AgentDefinition, AgentMapping } from "../agents/types.js";
import { AiwError } from "../core/errors.js";
import { matchesGlob } from "../filesystem/exclusions.js";
import { isInsideOrEqual, resolveFromBase } from "../filesystem/paths.js";
import { writeFileAtomic } from "../filesystem/io.js";
import type { EffectiveSnapshot, ResolvedResource } from "../resolution/types.js";
import {
  renderConcatenatedMarkdown,
  renderIdentity,
  renderMarkdownFrontmatter,
  renderReferenceIndex,
  type RenderedArtifact,
} from "./formats.js";
import { parseProvenance } from "./provenance.js";
import { applyTemplate, resourceVars } from "./templates.js";

export type OutputState = "missing" | "managed" | "managed-stale" | "unmanaged" | "unchanged";

export interface PlannedArtifact extends RenderedArtifact {
  absolutePath: string;
  state: OutputState;
}

export interface ExportAgentReport {
  id: string;
  definitionId: string;
  written: string[];
  unchanged: string[];
  skippedUnmanaged: string[];
  leftoverGenerated: string[];
}

export function matchResources(
  resources: readonly ResolvedResource[],
  mapping: AgentMapping,
): ResolvedResource[] {
  const matched: ResolvedResource[] = [];
  for (const resource of resources) {
    if (mapping.fromKind !== "*" && resource.kind !== mapping.fromKind) {
      continue;
    }
    if (!matchesGlob(resource.relativePath, mapping.from)) {
      continue;
    }
    matched.push(resource);
  }
  return matched;
}

export function renderDefinition(
  definition: AgentDefinition,
  snapshot: EffectiveSnapshot,
): RenderedArtifact[] {
  if (definition.adapter.engine !== "declarative") {
    throw new AiwError("UNSUPPORTED", "Only declarative adapters are supported in v1.");
  }
  if (definition.adapter.strategy !== "generated") {
    throw new AiwError(
      "UNSUPPORTED",
      `Adapter strategy '${definition.adapter.strategy}' is not implemented in Phase 2.`,
      { suggestion: "Use strategy: generated." },
    );
  }

  const byPath = new Map<string, { artifact: RenderedArtifact; format: string }>();
  for (const mapping of definition.adapter.mappings) {
    const matched = matchResources(snapshot.resources, mapping);
    if (mapping.format === "identity" || mapping.format === "markdown-frontmatter") {
      for (const resource of matched) {
        const posixPath = applyTemplate(mapping.to, resourceVars(resource));
        assertSafeOutput(snapshot.active.root, posixPath);
        const artifact =
          mapping.format === "identity"
            ? renderIdentity(resource, mapping, posixPath)
            : renderMarkdownFrontmatter(resource, mapping, posixPath);
        collide(byPath, artifact, mapping.format);
      }
      continue;
    }
    if (matched.length === 0) {
      continue;
    }
    const paths = new Set(matched.map((resource) => applyTemplate(mapping.to, resourceVars(resource))));
    if (paths.size !== 1) {
      throw new AiwError(
        "VALIDATION",
        `Concatenated mapping in '${definition.id}' must resolve to a single output path.`,
      );
    }
    const posixPath = [...paths][0] ?? mapping.to;
    assertSafeOutput(snapshot.active.root, posixPath);
    const artifact =
      mapping.format === "reference-index"
        ? renderReferenceIndex(matched, mapping, posixPath)
        : renderConcatenatedMarkdown(matched, mapping, posixPath);
    collide(byPath, artifact, mapping.format);
  }
  return [...byPath.values()]
    .map((entry) => entry.artifact)
    .sort((a, b) => (a.posixPath < b.posixPath ? -1 : a.posixPath > b.posixPath ? 1 : 0));
}

export function planArtifacts(
  definition: AgentDefinition,
  snapshot: EffectiveSnapshot,
): PlannedArtifact[] {
  const rendered = renderDefinition(definition, snapshot);
  return rendered.map((artifact) => {
    const absolutePath = resolveFromBase(snapshot.active.root, artifact.posixPath);
    return {
      ...artifact,
      absolutePath,
      state: classify(absolutePath, artifact),
    };
  });
}

export function applyExport(
  planned: readonly PlannedArtifact[],
): { written: string[]; unchanged: string[]; skippedUnmanaged: string[] } {
  const written: string[] = [];
  const unchanged: string[] = [];
  const skippedUnmanaged: string[] = [];
  for (const artifact of planned) {
    if (artifact.state === "unmanaged") {
      skippedUnmanaged.push(artifact.posixPath);
      continue;
    }
    if (artifact.state === "unchanged") {
      unchanged.push(artifact.posixPath);
      continue;
    }
    writeFileAtomic(artifact.absolutePath, artifact.contents);
    written.push(artifact.posixPath);
  }
  written.sort();
  unchanged.sort();
  skippedUnmanaged.sort();
  return { written, unchanged, skippedUnmanaged };
}

export function leftoverGenerated(
  definition: AgentDefinition,
  snapshot: EffectiveSnapshot,
): string[] {
  return planArtifacts(definition, snapshot)
    .filter((artifact) => artifact.state === "unchanged" || artifact.state === "managed-stale")
    .map((artifact) => artifact.posixPath);
}

function classify(absolutePath: string, artifact: RenderedArtifact): OutputState {
  if (!fs.existsSync(absolutePath)) {
    return "missing";
  }
  const current = fs.readFileSync(absolutePath, "utf8");
  if (current === artifact.contents) {
    return "unchanged";
  }
  const provenance = parseProvenance(current);
  if (provenance === undefined) {
    return "unmanaged";
  }
  return "managed-stale";
}

function collide(
  byPath: Map<string, { artifact: RenderedArtifact; format: string }>,
  artifact: RenderedArtifact,
  format: string,
): void {
  const existing = byPath.get(artifact.posixPath);
  if (existing === undefined) {
    byPath.set(artifact.posixPath, { artifact, format });
    return;
  }
  const mergeable = isConcatLike(existing.format) && isConcatLike(format);
  if (!mergeable) {
    throw new AiwError(
      "VALIDATION",
      `Multiple mappings write '${artifact.posixPath}' with incompatible formats.`,
    );
  }
  byPath.set(artifact.posixPath, { artifact, format });
}

function isConcatLike(format: string): boolean {
  return format === "concatenated-markdown" || format === "reference-index";
}

function assertSafeOutput(scopeRoot: string, posixPath: string): void {
  const absolute = resolveFromBase(scopeRoot, posixPath);
  if (!isInsideOrEqual(scopeRoot, absolute)) {
    throw new AiwError("VALIDATION", `Adapter output '${posixPath}' escapes the scope root.`);
  }
  if (isInsideOrEqual(path.join(scopeRoot, ".git"), absolute)) {
    throw new AiwError("VALIDATION", `Adapter output '${posixPath}' must not write into .git.`);
  }
  if (isInsideOrEqual(path.join(scopeRoot, ".ai"), absolute)) {
    throw new AiwError("VALIDATION", `Adapter output '${posixPath}' must not rewrite canonical .ai files.`);
  }
}
