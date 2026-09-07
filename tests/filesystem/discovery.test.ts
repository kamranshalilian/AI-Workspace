import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { discoverScope } from "../../src/filesystem/discovery.js";
import { makeTempDir, rmTempDir, writeManifest } from "../helpers.js";

test("discovers the nearest .ai walking upward", () => {
  const root = makeTempDir();
  try {
    writeManifest(root, "specVersion: 1\nkind: project\nname: outer\n");
    const nested = path.join(root, "src", "lib");
    fs.mkdirSync(nested, { recursive: true });
    const found = discoverScope(nested);
    assert.ok(found);
    assert.equal(found?.root, path.resolve(root));
  } finally {
    rmTempDir(root);
  }
});

test("prefers a nested project over a parent workspace", () => {
  const workspace = makeTempDir();
  try {
    writeManifest(workspace, "specVersion: 1\nkind: workspace\nname: ws\n");
    const project = path.join(workspace, "accounting");
    fs.mkdirSync(project, { recursive: true });
    writeManifest(project, "specVersion: 1\nkind: project\nname: accounting\n");
    const found = discoverScope(project);
    assert.equal(found?.root, path.resolve(project));
  } finally {
    rmTempDir(workspace);
  }
});

test("returns undefined when no .ai exists", () => {
  const root = makeTempDir();
  try {
    assert.equal(discoverScope(root), undefined);
  } finally {
    rmTempDir(root);
  }
});
