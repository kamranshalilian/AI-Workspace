import { isBinaryBuffer, isFile, readFileBytes, readFilePrefix, sha256 } from "../filesystem/io.js";
import { toPosixPath } from "../filesystem/paths.js";
import { BINARY_SNIFF_BYTES } from "../config/constants.js";
import type { ContentEntry } from "./types.js";

export function normalizeNewlines(text: string): string {
  return text.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
}

export function logicalPath(input: string): string {
  return toPosixPath(input);
}

export function contentHash(text: string): string {
  const bytes = Buffer.from(normalizeNewlines(text), "utf8");
  return formatHash(sha256(bytes));
}

export function contentHashFromBytes(bytes: Buffer): string {
  return contentHash(bytes.toString("utf8"));
}

export function formatHash(hex: string): string {
  return hex.startsWith("sha256:") ? hex : `sha256:${hex}`;
}

export function fileContentHash(absolutePath: string): string | undefined {
  if (!isFile(absolutePath)) {
    return undefined;
  }
  let prefix: Buffer;
  try {
    prefix = readFilePrefix(absolutePath, BINARY_SNIFF_BYTES);
  } catch {
    return undefined;
  }
  if (isBinaryBuffer(prefix)) {
    return undefined;
  }
  const bytes = readFileBytes(absolutePath);
  return contentHashFromBytes(bytes);
}

export function treeIdentity(entries: readonly ContentEntry[]): string {
  const lines = [...entries]
    .map((entry) => `${logicalPath(entry.path)}\t${entry.hash}`)
    .sort();
  const payload = lines.length === 0 ? "" : `${lines.join("\n")}\n`;
  return contentHash(payload);
}
