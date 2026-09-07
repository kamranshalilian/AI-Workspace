import { displayNameFromId } from "./ids.js";

/** Deterministic Phase 2-compatible Agent Definition stub (LF, trailing newline). */
export function renderAgentDefinitionStub(id: string): string {
  const name = displayNameFromId(id);
  return [
    "specVersion: 1",
    "kind: agent-definition",
    "",
    `id: ${id}`,
    `name: ${name}`,
    "",
    "capabilities: []",
    "",
    "native:",
    "  roots: []",
    "  files: []",
    "",
    "adapter:",
    "  engine: declarative",
    "  strategy: generated",
    "  mappings: []",
    "",
  ].join("\n");
}
