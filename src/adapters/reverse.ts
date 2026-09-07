import { AiwError } from "../core/errors.js";
import type { AgentMapping, FormatEngineId } from "../agents/types.js";
import { posixJoin, toPosixPath } from "../filesystem/paths.js";
import { ensureTrailingNewline, normalizeNewlines } from "./formats.js";
import { stripProvenance } from "./provenance.js";
import type { TemplateVars } from "./templates.js";

const REVERSIBLE_FORMATS = new Set<FormatEngineId>(["identity", "markdown-frontmatter"]);

export function isReversibleFormat(format: FormatEngineId): boolean {
  return REVERSIBLE_FORMATS.has(format);
}

export function reverseConvert(format: FormatEngineId, nativeContents: string): string {
  if (!isReversibleFormat(format)) {
    throw new AiwError(
      "VALIDATION",
      `Format '${format}' cannot be reversed into canonical content.`,
      {
        suggestion:
          "Promotion requires a declared identity or markdown-frontmatter mapping. Concatenated and reference-index outputs cannot be split without guessing.",
      },
    );
  }
  let body = stripProvenance(nativeContents);
  body = normalizeNewlines(body);
  if (body.startsWith("\n")) {
    body = body.slice(1);
  }
  if (format === "markdown-frontmatter") {
    body = stripYamlFrontmatter(body);
  }
  return ensureTrailingNewline(body);
}

export function canonicalRelativeFromMapping(
  mapping: AgentMapping,
  vars: Partial<TemplateVars>,
): { identity: string; relativePath: string } {
  if (mapping.fromKind === "*") {
    throw new AiwError(
      "VALIDATION",
      "Cannot promote a mapping whose fromKind is '*'.",
      { suggestion: "Use an explicit canonical kind in the agent definition mapping." },
    );
  }
  const relativePath = inferRelativePath(mapping, vars);
  if (relativePath === undefined || relativePath === "" || relativePath.includes("\0") || relativePath.split("/").includes("..")) {
    throw new AiwError(
      "VALIDATION",
      `Cannot invert mapping '${mapping.to}' into a canonical path.`,
      { suggestion: "Promotion requires a declared mapping whose native path uniquely identifies a canonical file." },
    );
  }
  const posixRelative = toPosixPath(relativePath).replace(/^\/+/, "");
  return {
    identity: `${mapping.fromKind}/${posixRelative}`,
    relativePath: posixRelative,
  };
}

export function stripYamlFrontmatter(text: string): string {
  const normalized = normalizeNewlines(text);
  if (!normalized.startsWith("---\n") && normalized !== "---") {
    return normalized;
  }
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(normalized);
  if (match === null) {
    return normalized;
  }
  return normalized.slice(match[0].length);
}

function inferRelativePath(mapping: AgentMapping, vars: Partial<TemplateVars>): string | undefined {
  if (vars.relativePath !== undefined && vars.relativePath !== "") {
    return toPosixPath(vars.relativePath);
  }
  if (vars.identity !== undefined && vars.identity !== "") {
    const identity = toPosixPath(vars.identity);
    const prefix = `${mapping.fromKind}/`;
    return identity.startsWith(prefix) ? identity.slice(prefix.length) : identity;
  }
  const stem = vars.stem ?? vars.name;
  if (stem === undefined || stem === "") {
    return undefined;
  }
  const extension = extensionFromGlob(mapping.from);
  if (extension === undefined) {
    return undefined;
  }
  return `${stem}.${extension}`;
}

function extensionFromGlob(from: string): string | undefined {
  const match = /\.([A-Za-z0-9]+)$/.exec(from);
  return match?.[1];
}

export function canonicalPosixPath(fromKind: string, relativePath: string): string {
  return posixJoin(".ai", fromKind, relativePath);
}
