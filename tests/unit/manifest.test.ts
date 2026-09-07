import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAndValidateManifest, parseYamlDocument, validateManifestSchema } from "../../src/manifest/index.js";

test("parses a minimal valid project manifest", () => {
  const result = parseAndValidateManifest("specVersion: 1\nkind: project\nname: accounting\n");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.manifest.kind, "project");
    assert.equal(result.manifest.name, "accounting");
    assert.equal(result.manifest.specVersion, 1);
    assert.deepEqual(result.manifest.extends, undefined);
    assert.ok(result.manifest.context.include.includes("rules/**"));
  }
});

test("parses a minimal valid workspace manifest", () => {
  const result = parseAndValidateManifest("specVersion: 1\nkind: workspace\nname: company-workspace\n");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.manifest.kind, "workspace");
  }
});

test("rejects unsupported specVersion", () => {
  const result = parseAndValidateManifest("specVersion: 2\nkind: project\nname: accounting\n");
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.issues.some((issue) => issue.path === "specVersion"));
  }
});

test("rejects invalid kind", () => {
  const result = parseAndValidateManifest("specVersion: 1\nkind: repo\nname: accounting\n");
  assert.equal(result.ok, false);
});

test("rejects invalid name", () => {
  const result = parseAndValidateManifest("specVersion: 1\nkind: project\nname: Accounting\n");
  assert.equal(result.ok, false);
});

test("rejects unknown top-level keys", () => {
  const result = parseAndValidateManifest(
    "specVersion: 1\nkind: project\nname: accounting\nfoo: bar\n",
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.issues.some((issue) => issue.path === "foo"));
  }
});

test("rejects duplicate YAML keys", () => {
  assert.throws(() =>
    parseYamlDocument("specVersion: 1\nspecVersion: 1\nkind: project\nname: accounting\n"),
  );
});

test("rejects projects on a project manifest", () => {
  const result = parseAndValidateManifest(
    "specVersion: 1\nkind: project\nname: accounting\nprojects:\n  other:\n    path: ./other\n",
  );
  assert.equal(result.ok, false);
});

test("rejects reserved context.include", () => {
  const result = parseAndValidateManifest(
    "specVersion: 1\nkind: project\nname: accounting\ncontext:\n  include:\n    - agents/**\n",
  );
  assert.equal(result.ok, false);
});

test("rejects trust executable flags in v1", () => {
  const result = parseAndValidateManifest(
    "specVersion: 1\nkind: project\nname: accounting\npolicies:\n  trust:\n    executableAdapters: true\n",
  );
  assert.equal(result.ok, false);
});

test("rejects more than one extends entry", () => {
  const result = parseAndValidateManifest(
    "specVersion: 1\nkind: project\nname: accounting\nextends:\n  - path: ../.ai\n  - path: ../../.ai\n",
  );
  assert.equal(result.ok, false);
});

test("rejects invalid source type", () => {
  const result = parseAndValidateManifest(
    "specVersion: 1\nkind: project\nname: accounting\nsources:\n  docs:\n    type: mcp\n    path: ./docs\n",
  );
  assert.equal(result.ok, false);
});

test("rejects project path that escapes the workspace", () => {
  const result = parseAndValidateManifest(
    "specVersion: 1\nkind: workspace\nname: ws\nprojects:\n  other:\n    path: ../outside\n",
  );
  assert.equal(result.ok, false);
});

test("unions user exclusions with built-in defaults", () => {
  const result = validateManifestSchema({
    specVersion: 1,
    kind: "project",
    name: "accounting",
    policies: { exclusions: ["*.secret"] },
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.ok(result.manifest.policies.exclusions.includes(".env"));
    assert.ok(result.manifest.policies.exclusions.includes("*.secret"));
  }
});

test("strips UTF-8 BOM", () => {
  const result = parseAndValidateManifest("\uFEFFspecVersion: 1\nkind: project\nname: accounting\n");
  assert.equal(result.ok, true);
});
