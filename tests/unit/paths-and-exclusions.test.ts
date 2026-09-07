import assert from "node:assert/strict";
import { test } from "node:test";
import { isExcluded } from "../../src/filesystem/exclusions.js";
import { BUILTIN_EXCLUSIONS } from "../../src/config/constants.js";
import { resolveFromBase, toNativePath, toPosixPath } from "../../src/filesystem/paths.js";
import path from "node:path";

test("normalizes Windows separators to POSIX", () => {
  assert.equal(toPosixPath("foo\\bar\\baz"), "foo/bar/baz");
  assert.equal(toPosixPath("foo/bar"), "foo/bar");
});

test("converts POSIX paths to native separators", () => {
  const native = toNativePath("foo/bar");
  assert.equal(native, ["foo", "bar"].join(path.sep));
});

test("resolves mixed declared paths from a base", () => {
  const resolved = resolveFromBase("/tmp/project", "nested\\child");
  assert.equal(resolved, path.resolve("/tmp/project", "nested", "child"));
});

test("excludes builtin sensitive basenames and paths", () => {
  const patterns = BUILTIN_EXCLUSIONS;
  assert.equal(isExcluded(".env", patterns), true);
  assert.equal(isExcluded(".env.local", patterns), true);
  assert.equal(isExcluded("id_rsa", patterns), true);
  assert.equal(isExcluded("certs/site.pem", patterns), true);
  assert.equal(isExcluded("rules/secrets.md", patterns), true);
  assert.equal(isExcluded("rules/token-list.md", patterns), true);
  assert.equal(isExcluded("rules/security.md", patterns), false);
});
