import fs from "node:fs";
import { isMap, parseDocument } from "yaml";
import { AiwError } from "../core/errors.js";
import { writeFileAtomic } from "../filesystem/io.js";
import type { SourceCapability, SourceType } from "./types.js";
import { parseYamlDocument } from "./parse.js";
import { validateManifestSchema } from "./validate.js";

export function upsertManifestAgent(
  manifestPath: string,
  id: string,
  definitionId: string,
): { created: boolean } {
  const text = fs.readFileSync(manifestPath, "utf8");
  const doc = parseDocument(text, { uniqueKeys: true, schema: "core", strict: true, merge: false });
  if (!isMap(doc.contents)) {
    throw new AiwError("VALIDATION", "Manifest must be a mapping.");
  }
  if (!doc.has("agents") || doc.get("agents") === null) {
    doc.set("agents", doc.createNode({}));
  }
  const agents = doc.get("agents");
  if (!isMap(agents)) {
    throw new AiwError("VALIDATION", "agents must be a mapping.");
  }
  if (agents.has(id)) {
    return { created: false };
  }
  agents.set(
    id,
    doc.createNode({
      enabled: true,
      definition: definitionId,
    }),
  );
  persist(manifestPath, String(doc));
  assertManifest(manifestPath);
  return { created: true };
}

export function removeManifestAgent(manifestPath: string, id: string): void {
  const text = fs.readFileSync(manifestPath, "utf8");
  const doc = parseDocument(text, { uniqueKeys: true, schema: "core", strict: true, merge: false });
  if (!isMap(doc.contents)) {
    throw new AiwError("VALIDATION", "Manifest must be a mapping.");
  }
  const agents = doc.get("agents");
  if (!isMap(agents) || !agents.has(id)) {
    throw new AiwError("VALIDATION", `Agent '${id}' is not registered.`, {
      suggestion: "Run `aiw agent list` to see registered agents.",
    });
  }
  agents.delete(id);
  persist(manifestPath, String(doc));
  assertManifest(manifestPath);
}

export function upsertManifestSource(
  manifestPath: string,
  id: string,
  config: { type: SourceType; path: string; capabilities: SourceCapability[] },
): void {
  const text = fs.readFileSync(manifestPath, "utf8");
  const doc = parseDocument(text, { uniqueKeys: true, schema: "core", strict: true, merge: false });
  if (!isMap(doc.contents)) {
    throw new AiwError("VALIDATION", "Manifest must be a mapping.");
  }
  if (!doc.has("sources") || doc.get("sources") === null) {
    doc.set("sources", doc.createNode({}));
  }
  const sources = doc.get("sources");
  if (!isMap(sources)) {
    throw new AiwError("VALIDATION", "sources must be a mapping.");
  }
  if (sources.has(id)) {
    throw new AiwError("CONFLICT", `Source '${id}' is already registered.`, {
      suggestion: "Choose a different id. Existing sources are not overwritten.",
    });
  }
  sources.set(
    id,
    doc.createNode({
      type: config.type,
      path: config.path,
      capabilities: [...config.capabilities],
    }),
  );
  persist(manifestPath, String(doc));
  assertManifest(manifestPath);
}

export function removeManifestSource(manifestPath: string, id: string): void {
  const text = fs.readFileSync(manifestPath, "utf8");
  const doc = parseDocument(text, { uniqueKeys: true, schema: "core", strict: true, merge: false });
  if (!isMap(doc.contents)) {
    throw new AiwError("VALIDATION", "Manifest must be a mapping.");
  }
  const sources = doc.get("sources");
  if (!isMap(sources) || !sources.has(id)) {
    throw new AiwError("VALIDATION", `Source '${id}' is not registered.`, {
      suggestion: "Run `aiw source list` to see registered sources.",
    });
  }
  sources.delete(id);
  persist(manifestPath, String(doc));
  assertManifest(manifestPath);
}

export function upsertManifestProject(manifestPath: string, id: string, projectPath: string): void {
  const text = fs.readFileSync(manifestPath, "utf8");
  const doc = parseDocument(text, { uniqueKeys: true, schema: "core", strict: true, merge: false });
  if (!isMap(doc.contents)) {
    throw new AiwError("VALIDATION", "Manifest must be a mapping.");
  }
  if (!doc.has("projects") || doc.get("projects") === null) {
    doc.set("projects", doc.createNode({}));
  }
  const projects = doc.get("projects");
  if (!isMap(projects)) {
    throw new AiwError("VALIDATION", "projects must be a mapping.");
  }
  if (projects.has(id)) {
    throw new AiwError("CONFLICT", `Project '${id}' is already registered.`, {
      suggestion: "Choose a different id. Existing projects are not overwritten.",
    });
  }
  projects.set(
    id,
    doc.createNode({
      path: projectPath,
    }),
  );
  persist(manifestPath, String(doc));
  assertManifest(manifestPath);
}

export function removeManifestProject(manifestPath: string, id: string): void {
  const text = fs.readFileSync(manifestPath, "utf8");
  const doc = parseDocument(text, { uniqueKeys: true, schema: "core", strict: true, merge: false });
  if (!isMap(doc.contents)) {
    throw new AiwError("VALIDATION", "Manifest must be a mapping.");
  }
  const projects = doc.get("projects");
  if (!isMap(projects) || !projects.has(id)) {
    throw new AiwError("VALIDATION", `Project '${id}' is not registered.`, {
      suggestion: "Run `aiw project list` to see registered projects.",
    });
  }
  projects.delete(id);
  persist(manifestPath, String(doc));
  assertManifest(manifestPath);
}

function persist(manifestPath: string, raw: string): void {
  const text = raw.endsWith("\n") ? raw : `${raw}\n`;
  writeFileAtomic(manifestPath, text);
}

function assertManifest(manifestPath: string): void {
  const result = validateManifestSchema(parseYamlDocument(fs.readFileSync(manifestPath, "utf8")));
  if (!result.ok) {
    throw new AiwError("VALIDATION", "Writing the manifest entry produced an invalid manifest.");
  }
}
