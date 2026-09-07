import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AiwError } from "../core/errors.js";
import { isDirectory, isFile } from "../filesystem/io.js";
import { comparePosix } from "../filesystem/paths.js";
import type { EffectiveSnapshot } from "../resolution/types.js";
import { parseAgentDefinition } from "./parse.js";
import type { AgentDefinition } from "./types.js";

export function bundledDefinitionsDir(): string {
  const start = fileURLToPath(new URL(".", import.meta.url));
  let current = start;
  while (true) {
    const candidate = path.join(current, "definitions", "agents");
    if (isDirectory(candidate) && hasYaml(candidate)) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new AiwError("IO", "Bundled agent definitions were not found in the package.", {
        suggestion: "Reinstall ai-workspace so definitions/agents is included in the package.",
      });
    }
    current = parent;
  }
}

export function definitionSearchDirs(snapshot: EffectiveSnapshot): string[] {
  const dirs: string[] = [];
  for (let index = snapshot.chain.length - 1; index >= 0; index -= 1) {
    const entry = snapshot.chain[index];
    if (entry === undefined) {
      continue;
    }
    dirs.push(path.join(entry.root, ".ai", "agents"));
  }
  dirs.push(bundledDefinitionsDir());
  return dirs;
}

export function resolveDefinition(id: string, searchDirs: readonly string[]): AgentDefinition {
  for (const dir of searchDirs) {
    const filePath = path.join(dir, `${id}.yaml`);
    if (!isFile(filePath)) {
      continue;
    }
    const text = fs.readFileSync(filePath, "utf8");
    const parsed = parseAgentDefinition(text, filePath);
    if (!parsed.ok) {
      throw new AiwError(
        "VALIDATION",
        `Invalid agent definition '${id}': ${parsed.issues.map((issue) => issue.message).join("; ")}`,
        { details: { filePath, issues: parsed.issues } },
      );
    }
    if (parsed.definition.id !== id) {
      throw new AiwError(
        "VALIDATION",
        `Agent definition id '${parsed.definition.id}' does not match file stem '${id}'.`,
      );
    }
    return parsed.definition;
  }
  throw new AiwError("VALIDATION", `Unknown agent definition '${id}'.`, {
    suggestion: "Place a YAML definition in .ai/agents/ or use a bundled definition id.",
  });
}

export function listDefinitions(searchDirs: readonly string[]): AgentDefinition[] {
  const byId = new Map<string, AgentDefinition>();
  for (const dir of [...searchDirs].reverse()) {
    if (!isDirectory(dir)) {
      continue;
    }
    const names = fs.readdirSync(dir).filter((name) => name.endsWith(".yaml")).sort();
    for (const name of names) {
      const id = name.slice(0, -".yaml".length);
      const filePath = path.join(dir, name);
      const parsed = parseAgentDefinition(fs.readFileSync(filePath, "utf8"), filePath);
      if (!parsed.ok || parsed.definition.id !== id) {
        continue;
      }
      byId.set(id, parsed.definition);
    }
  }
  return [...byId.values()].sort((a, b) => comparePosix(a.id, b.id));
}

export function listBundledDefinitions(): AgentDefinition[] {
  return listDefinitions([bundledDefinitionsDir()]);
}

function hasYaml(dir: string): boolean {
  try {
    return fs.readdirSync(dir).some((name) => name.endsWith(".yaml"));
  } catch {
    return false;
  }
}
