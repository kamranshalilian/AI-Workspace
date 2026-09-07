import assert from "node:assert/strict";
import { test } from "node:test";
import { toPosixPath, toNativePath, resolveFromBase } from "../../src/filesystem/paths.js";
import path from "node:path";

test("Windows-style CLI paths normalize to POSIX identities", () => {
  assert.equal(toPosixPath("rules\\security.md"), "rules/security.md");
  assert.equal(toPosixPath("..\\..\\.ai"), "../../.ai");
});

test("native conversion is reversible for relative POSIX paths", () => {
  const posix = "rules/nested/file.md";
  const native = toNativePath(posix);
  assert.equal(toPosixPath(native), posix);
});

test("resolveFromBase accepts backslash input without depending on POSIX cwd", () => {
  const base = path.parse(process.cwd()).root;
  const resolved = resolveFromBase(base, "alpha\\beta");
  assert.equal(resolved, path.resolve(base, "alpha", "beta"));
});
