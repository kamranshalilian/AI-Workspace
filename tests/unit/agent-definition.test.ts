import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAgentDefinition } from "../../src/agents/parse.js";
import { renderAgentDefinitionStub } from "../../src/agents/stub.js";
import { assertValidAgentId, displayNameFromId, isValidAgentId } from "../../src/agents/ids.js";

test("generated stub is valid, deterministic, and uses LF", () => {
  const first = renderAgentDefinitionStub("my-agent");
  const second = renderAgentDefinitionStub("my-agent");
  assert.equal(first, second);
  assert.equal(first.includes("\r"), false);
  assert.equal(first.endsWith("\n"), true);
  assert.equal(displayNameFromId("my-agent"), "My Agent");
  const parsed = parseAgentDefinition(first, "/tmp/.ai/agents/my-agent.yaml");
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.definition.id, "my-agent");
    assert.equal(parsed.definition.adapter.engine, "declarative");
    assert.deepEqual(parsed.definition.adapter.mappings, []);
  }
});

test("empty mappings are a valid Agent Definition", () => {
  const parsed = parseAgentDefinition(
    [
      "specVersion: 1",
      "kind: agent-definition",
      "id: empty",
      "name: Empty",
      "adapter:",
      "  engine: declarative",
      "  mappings: []",
      "",
    ].join("\n"),
    "empty.yaml",
  );
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.deepEqual(parsed.definition.adapter.mappings, []);
  }
});

test("rejects unsafe Agent IDs before path construction", () => {
  const invalid = ["", "../foo", "../../foo", "foo/bar", "foo\\bar", "/foo", "C:\\foo", "C:/foo", ".", "..", "My Agent", "-leading"];
  for (const id of invalid) {
    assert.equal(isValidAgentId(id), false, id);
    assert.throws(() => assertValidAgentId(id));
  }
  assert.equal(assertValidAgentId("my-agent"), "my-agent");
  assert.equal(assertValidAgentId("test.agent_1"), "test.agent_1");
});
