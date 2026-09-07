import assert from "node:assert/strict";
import { test } from "node:test";
import {
  contentHash,
  logicalPath,
  treeIdentity,
} from "../../src/state/identity.js";

test("identical content produces identical identity", () => {
  assert.equal(contentHash("hello\n"), contentHash("hello\n"));
  assert.equal(contentHash("hello\r\n"), contentHash("hello\n"));
  assert.equal(contentHash("hello\r"), contentHash("hello\n"));
});

test("content change produces a different identity", () => {
  assert.notEqual(contentHash("hello\n"), contentHash("hello world\n"));
});

test("repeated calculation is deterministic", () => {
  const first = contentHash("stable payload\n");
  for (let i = 0; i < 5; i += 1) {
    assert.equal(contentHash("stable payload\n"), first);
  }
});

test("tree identity ignores input order", () => {
  const a = { path: "notes/a.md", hash: "sha256:aaa" };
  const b = { path: "notes/b.md", hash: "sha256:bbb" };
  assert.equal(treeIdentity([a, b]), treeIdentity([b, a]));
});

test("tree identity changes when a file hash changes", () => {
  const left = treeIdentity([
    { path: "a.md", hash: "sha256:1" },
    { path: "b.md", hash: "sha256:2" },
  ]);
  const right = treeIdentity([
    { path: "a.md", hash: "sha256:1" },
    { path: "b.md", hash: "sha256:changed" },
  ]);
  assert.notEqual(left, right);
});

test("logical paths are POSIX-normalized and stable across Windows input", () => {
  assert.equal(logicalPath("a\\b\\c.md"), "a/b/c.md");
  assert.equal(logicalPath("a/b/c.md"), "a/b/c.md");
  const windowsTree = treeIdentity([{ path: "rules\\security.md", hash: "sha256:x" }]);
  const posixTree = treeIdentity([{ path: "rules/security.md", hash: "sha256:x" }]);
  assert.equal(windowsTree, posixTree);
});

test("content hashes use the sha256: prefix", () => {
  assert.match(contentHash("x"), /^sha256:[0-9a-f]{64}$/);
});
