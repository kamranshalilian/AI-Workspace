import assert from "node:assert/strict";
import { test } from "node:test";
import { loadScope } from "../../src/resolution/index.js";
import { collectResources } from "../../src/resolution/collect.js";
import { BUILTIN_EXCLUSIONS, DEFAULT_MAX_FILE_BYTES } from "../../src/config/constants.js";
import { makeTempDir, rmTempDir, writeFile, writeManifest } from "../helpers.js";

test("collects included files and skips reserved directories", () => {
  const root = makeTempDir();
  try {
    writeManifest(root, "specVersion: 1\nkind: project\nname: demo\n");
    writeFile(root, ".ai/rules/a.md", "a\n");
    writeFile(root, ".ai/agents/ignored.yaml", "id: x\n");
    writeFile(root, ".ai/cache/tmp.txt", "tmp\n");
    const scope = loadScope(root);
    const { resources } = collectResources(scope, BUILTIN_EXCLUSIONS, DEFAULT_MAX_FILE_BYTES);
    assert.deepEqual(
      resources.map((item) => item.identity),
      ["rules/a.md"],
    );
  } finally {
    rmTempDir(root);
  }
});
