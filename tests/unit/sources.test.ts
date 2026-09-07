import assert from "node:assert/strict";
import { test } from "node:test";
import { assertValidSourceId, isValidSourceId } from "../../src/sources/ids.js";
import { parseCapabilityList } from "../../src/sources/capabilities.js";
import { normalizeDeclaredSourcePath, sourceIdentity } from "../../src/sources/paths.js";

test("rejects unsafe source IDs", () => {
  for (const id of ["../foo", "foo/bar", "foo\\bar", "/foo", "C:\\foo", ".", "..", ""]) {
    assert.equal(isValidSourceId(id), false, id);
  }
  assert.equal(assertValidSourceId("shared-docs"), "shared-docs");
});

test("normalizes CLI source paths to POSIX", () => {
  assert.equal(normalizeDeclaredSourcePath("..\\foo\\bar"), "../foo/bar");
  assert.equal(normalizeDeclaredSourcePath("./foo/bar"), "./foo/bar");
  assert.equal(sourceIdentity("docs", "a\\b.md"), "source:docs:a/b.md");
});

test("capability lists default to read", () => {
  assert.deepEqual(parseCapabilityList(undefined), ["read"]);
  assert.deepEqual(parseCapabilityList("read,index"), ["index", "read"]);
});
