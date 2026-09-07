import { stringify } from "yaml";
import type { AgentMapping } from "../agents/types.js";
import { sha256 } from "../filesystem/io.js";
import type { ResolvedResource } from "../resolution/types.js";
import { renderProvenanceComment } from "./provenance.js";
import { applyTemplate, resourceVars } from "./templates.js";
import fs from "node:fs";

export interface RenderedArtifact {
  posixPath: string;
  contents: string;
  identities: string[];
  hash: string;
}

export function normalizeNewlines(text: string): string {
  return text.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
}

export function readNormalizedText(absolutePath: string): string {
  return normalizeNewlines(fs.readFileSync(absolutePath, "utf8"));
}

export function ensureTrailingNewline(text: string): string {
  if (text === "" || text.endsWith("\n")) {
    return text;
  }
  return `${text}\n`;
}

export function sortResources(
  resources: readonly ResolvedResource[],
  order: AgentMapping["order"],
): ResolvedResource[] {
  const copy = [...resources];
  copy.sort((a, b) => {
    if (order === "kind-then-name" && a.kind !== b.kind) {
      return a.kind < b.kind ? -1 : 1;
    }
    if (a.identity < b.identity) {
      return -1;
    }
    if (a.identity > b.identity) {
      return 1;
    }
    return 0;
  });
  return copy;
}

export function renderIdentity(
  resource: ResolvedResource,
  mapping: AgentMapping,
  posixPath: string,
): RenderedArtifact {
  const body = ensureTrailingNewline(readNormalizedText(resource.absolutePath));
  const hash = `sha256:${resource.hash}`;
  return {
    posixPath,
    contents: withProvenance(mapping, { specVersion: 1, identity: resource.identity, hash }, body),
    identities: [resource.identity],
    hash,
  };
}

export function renderMarkdownFrontmatter(
  resource: ResolvedResource,
  mapping: AgentMapping,
  posixPath: string,
): RenderedArtifact {
  const vars = resourceVars(resource);
  const frontmatter: Record<string, string> = {};
  for (const key of Object.keys(mapping.frontmatter).sort()) {
    const template = mapping.frontmatter[key];
    if (template === undefined) {
      continue;
    }
    frontmatter[key] = applyTemplate(template, vars);
  }
  const yamlBlock = stringify(frontmatter, {
    sortMapEntries: true,
    lineWidth: 0,
    indent: 2,
  }).trimEnd();
  const body = readNormalizedText(resource.absolutePath).replace(/\n+$/, "");
  const hash = `sha256:${resource.hash}`;
  const inner = yamlBlock === "" ? `---\n---\n${body}` : `---\n${yamlBlock}\n---\n${body}`;
  return {
    posixPath,
    contents: withProvenance(mapping, { specVersion: 1, identity: resource.identity, hash }, ensureTrailingNewline(inner)),
    identities: [resource.identity],
    hash,
  };
}

export function renderConcatenatedMarkdown(
  resources: readonly ResolvedResource[],
  mapping: AgentMapping,
  posixPath: string,
): RenderedArtifact {
  const ordered = sortResources(resources, mapping.order);
  const parts: string[] = [];
  for (const resource of ordered) {
    const vars = resourceVars(resource);
    const heading = mapping.wrap.heading ? applyTemplate(mapping.wrap.heading, vars) : "";
    const body = readNormalizedText(resource.absolutePath).replace(/\n+$/, "");
    parts.push(heading === "" ? body : `${heading}\n\n${body}`);
  }
  const identities = ordered.map((item) => item.identity);
  const hash = combinedHash(ordered);
  const joined = parts.join(mapping.wrap.separator);
  return {
    posixPath,
    contents: withProvenance(
      mapping,
      { specVersion: 1, identities, hash },
      joined === "" ? "" : ensureTrailingNewline(joined),
    ),
    identities,
    hash,
  };
}

export function renderReferenceIndex(
  resources: readonly ResolvedResource[],
  mapping: AgentMapping,
  posixPath: string,
): RenderedArtifact {
  const ordered = sortResources(resources, "identity");
  const lines = ordered.map((resource) => `- \`${resource.identity}\``);
  const identities = ordered.map((item) => item.identity);
  const hash = combinedHash(ordered);
  const body = lines.length === 0 ? "" : ensureTrailingNewline(lines.join("\n"));
  return {
    posixPath,
    contents: withProvenance(mapping, { specVersion: 1, identities, hash }, body),
    identities,
    hash,
  };
}

export function combinedHash(resources: readonly ResolvedResource[]): string {
  const payload = resources.map((item) => `${item.identity}:${item.hash}`).join("\n");
  return `sha256:${sha256(Buffer.from(payload, "utf8"))}`;
}

function withProvenance(
  mapping: AgentMapping,
  record: { specVersion: 1; identity?: string; identities?: string[]; hash: string },
  body: string,
): string {
  if (mapping.provenance !== "header") {
    return body;
  }
  const header = renderProvenanceComment(record);
  if (body === "") {
    return header;
  }
  return `${header}\n${body}`;
}
