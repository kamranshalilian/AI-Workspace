import fs from "node:fs";
import path from "node:path";
import { AI_DIR_NAME, NAME_PATTERN } from "../config/constants.js";
import { writeFileAtomic } from "../filesystem/io.js";
import type { ScopeKind } from "../manifest/types.js";
import { AiwError } from "./errors.js";

export interface InitOptions {
  directory: string;
  kind: ScopeKind;
  name?: string;
  force?: boolean;
}

export interface InitResult {
  root: string;
  manifestPath: string;
  kind: ScopeKind;
  name: string;
  created: boolean;
}

export function normalizeScopeName(input: string): string | undefined {
  const kebab = input
    .trim()
    .toLowerCase()
    .replaceAll("_", "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (NAME_PATTERN.test(kebab)) {
    return kebab;
  }
  return undefined;
}

export function renderInitManifest(kind: ScopeKind, name: string): string {
  return `specVersion: 1\nkind: ${kind}\nname: ${name}\n`;
}

export function initScope(options: InitOptions): InitResult {
  const root = path.resolve(options.directory);
  const aiDir = path.join(root, AI_DIR_NAME);
  const manifestPath = path.join(aiDir, "manifest.yaml");

  const name = options.name ?? normalizeScopeName(path.basename(root));
  if (name === undefined) {
    throw new AiwError(
      "USAGE",
      `Cannot derive a valid name from directory '${path.basename(root)}'. Pass --name.`,
    );
  }
  if (!NAME_PATTERN.test(name)) {
    throw new AiwError("USAGE", `Invalid name '${name}'.`);
  }

  let existed = false;
  if (fs.existsSync(aiDir)) {
    const stat = fs.statSync(aiDir);
    if (!stat.isDirectory()) {
      throw new AiwError("IO", `${aiDir} exists and is not a directory.`);
    }
    existed = true;
    if (!options.force) {
      throw new AiwError("CONFLICT", `.ai/ already exists at ${aiDir}.`, {
        suggestion: "Use --force to overwrite manifest.yaml only. Other files are left intact.",
      });
    }
  } else {
    fs.mkdirSync(aiDir, { recursive: true });
  }

  writeFileAtomic(manifestPath, renderInitManifest(options.kind, name));

  return {
    root,
    manifestPath,
    kind: options.kind,
    name,
    created: !existed,
  };
}
