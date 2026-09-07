import { parseYamlDocument } from "../manifest/parse.js";

export interface ProvenanceRecord {
  specVersion: 1;
  identity?: string;
  identities?: string[];
  hash: string;
}

const COMMENT_RE = /^<!--\r?\n([\s\S]*?)\r?\n-->\r?\n?/;

export function renderProvenanceComment(record: ProvenanceRecord): string {
  const lines: string[] = ["  specVersion: 1"];
  if (record.identity !== undefined) {
    lines.push(`  identity: ${yamlString(record.identity)}`);
  }
  if (record.identities !== undefined) {
    lines.push("  identities:");
    for (const identity of record.identities) {
      lines.push(`    - ${yamlString(identity)}`);
    }
  }
  lines.push(`  hash: ${yamlString(record.hash)}`);
  return `<!--\naiw-provenance:\n${lines.join("\n")}\n-->\n`;
}

export function parseProvenance(contents: string): ProvenanceRecord | undefined {
  const match = COMMENT_RE.exec(contents);
  if (match === null) {
    return undefined;
  }
  const body = match[1] ?? "";
  if (!body.startsWith("aiw-provenance:")) {
    return undefined;
  }
  try {
    const parsed = parseYamlDocument(`${body}\n`);
    if (!isPlainObject(parsed)) {
      return undefined;
    }
    const inner = parsed["aiw-provenance"];
    if (!isPlainObject(inner)) {
      return undefined;
    }
    if (inner["specVersion"] !== 1) {
      return undefined;
    }
    const hash = inner["hash"];
    if (typeof hash !== "string" || !hash.startsWith("sha256:")) {
      return undefined;
    }
    const identity = typeof inner["identity"] === "string" ? inner["identity"] : undefined;
    const identities = Array.isArray(inner["identities"])
      ? inner["identities"].filter((item): item is string => typeof item === "string")
      : undefined;
    return {
      specVersion: 1,
      identity,
      identities,
      hash,
    };
  } catch {
    return undefined;
  }
}

export function isManagedContents(contents: string): boolean {
  return parseProvenance(contents) !== undefined;
}

export function stripProvenance(contents: string): string {
  const match = COMMENT_RE.exec(contents);
  if (match === null) {
    return contents;
  }
  const body = match[1] ?? "";
  if (!body.startsWith("aiw-provenance:")) {
    return contents;
  }
  return contents.slice(match[0].length);
}

function yamlString(value: string): string {
  if (/^[A-Za-z0-9_./:-]+$/.test(value)) {
    return value;
  }
  return JSON.stringify(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
