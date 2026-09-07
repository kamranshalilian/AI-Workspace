import assert from "node:assert/strict";
import { test } from "node:test";
import { reverseConvert, stripYamlFrontmatter } from "../../src/adapters/reverse.js";
import { globFromTemplate, invertTemplate } from "../../src/adapters/templates.js";
import { renderProvenanceComment } from "../../src/adapters/provenance.js";
import { AiwError } from "../../src/core/errors.js";

test("invertTemplate extracts stem from a native path", () => {
  const vars = invertTemplate(".agent/rules/{{stem}}.md", ".agent/rules/security.md");
  assert.equal(vars?.stem, "security");
  assert.equal(globFromTemplate(".agent/rules/{{stem}}.md"), ".agent/rules/*.md");
});

test("invertTemplate normalizes Windows-style native paths", () => {
  const vars = invertTemplate(".agent/rules/{{stem}}.md", ".agent\\rules\\security.md");
  assert.equal(vars?.stem, "security");
});

test("identity reverse conversion strips provenance only", () => {
  const header = renderProvenanceComment({
    specVersion: 1,
    identity: "rules/security.md",
    hash: "sha256:abc",
  });
  const native = `${header}body text\n`;
  assert.equal(reverseConvert("identity", native), "body text\n");
});

test("markdown-frontmatter reverse conversion strips provenance and YAML", () => {
  const header = renderProvenanceComment({
    specVersion: 1,
    identity: "rules/security.md",
    hash: "sha256:abc",
  });
  const native = `${header}---\ndescription: security\n---\nbody text\n`;
  assert.equal(reverseConvert("markdown-frontmatter", native), "body text\n");
  assert.equal(stripYamlFrontmatter("---\ndescription: x\n---\nkept\n"), "kept\n");
});

test("concatenated-markdown reverse conversion fails clearly", () => {
  assert.throws(() => reverseConvert("concatenated-markdown", "x"), AiwError);
  assert.throws(() => reverseConvert("reference-index", "x"), AiwError);
});
