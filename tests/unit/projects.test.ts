import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { addProject, listProjects, removeProject } from "../../src/core/project.js";
import { AiwError } from "../../src/core/errors.js";
import { parseAndValidateManifest } from "../../src/manifest/index.js";
import { assertValidProjectId } from "../../src/projects/ids.js";
import { normalizeDeclaredProjectPath } from "../../src/projects/paths.js";
import { classifyProject } from "../../src/projects/classify.js";
import { makeTempDir, rmTempDir, writeManifest, writeFile } from "../helpers.js";

test("project ids reject path-like and reserved values", () => {
  assert.equal(assertValidProjectId("accounting"), "accounting");
  assert.equal(assertValidProjectId("svc.wallet"), "svc.wallet");
  for (const id of [".", "..", "../foo", "../../foo", "foo/bar", "foo\\bar", "C:foo", "con", "nul", ""]) {
    assert.throws(() => assertValidProjectId(id), AiwError);
  }
});

test("declared project paths normalize to POSIX and allow parent and absolute forms", () => {
  assert.equal(normalizeDeclaredProjectPath("./accounting"), "./accounting");
  assert.equal(normalizeDeclaredProjectPath("services\\accounting"), "services/accounting");
  assert.equal(normalizeDeclaredProjectPath("../accounting"), "../accounting");
  assert.equal(normalizeDeclaredProjectPath("C:\\workspace\\accounting"), "C:/workspace/accounting");
  assert.equal(normalizeDeclaredProjectPath("/workspace/accounting"), "/workspace/accounting");
  assert.throws(() => normalizeDeclaredProjectPath(""), AiwError);
  assert.throws(() => normalizeDeclaredProjectPath("a\0b"), AiwError);
});

test("classifyProject uses the workspace root, not process.cwd()", () => {
  const workspace = makeTempDir();
  const cwd = process.cwd();
  try {
    const project = path.join(workspace, "accounting");
    fs.mkdirSync(project, { recursive: true });
    writeManifest(project, "specVersion: 1\nkind: project\nname: accounting\n");
    process.chdir(os.tmpdir());
    const classified = classifyProject(workspace, "accounting", "./accounting");
    assert.equal(classified.status, "resolved");
    assert.equal(classified.resolvedPath, path.resolve(project));
  } finally {
    process.chdir(cwd);
    rmTempDir(workspace);
  }
});

test("nested workspace manifests are invalid project targets", () => {
  const workspace = makeTempDir();
  try {
    const nested = path.join(workspace, "inner");
    fs.mkdirSync(nested, { recursive: true });
    writeManifest(nested, "specVersion: 1\nkind: workspace\nname: inner\n");
    const classified = classifyProject(workspace, "inner", "./inner");
    assert.equal(classified.status, "invalid");
  } finally {
    rmTempDir(workspace);
  }
});

test("missing project directories are unresolved", () => {
  const workspace = makeTempDir();
  try {
    const classified = classifyProject(workspace, "missing", "./does-not-exist");
    assert.equal(classified.status, "unresolved");
  } finally {
    rmTempDir(workspace);
  }
});

test("project add/remove/list are registry-only and lexicographic", () => {
  const workspace = makeTempDir();
  try {
    writeManifest(workspace, "specVersion: 1\nkind: workspace\nname: company-workspace\n");
    const wallet = addProject(workspace, "wallet", "./wallet");
    const accounting = addProject(workspace, "accounting", "./accounting");
    assert.equal(accounting.status, "unresolved");
    assert.equal(wallet.path, "./wallet");
    assert.equal(fs.existsSync(path.join(workspace, "accounting")), false);
    assert.equal(fs.existsSync(path.join(workspace, ".ai", "accounting")), false);

    const listed = listProjects(workspace);
    assert.deepEqual(
      listed.projects.map((item) => item.id),
      ["accounting", "wallet"],
    );

    const accountingDir = path.join(workspace, "accounting");
    fs.mkdirSync(accountingDir, { recursive: true });
    writeManifest(accountingDir, "specVersion: 1\nkind: project\nname: accounting\n");
    writeFile(accountingDir, ".cursor/rules/keep.md", "native\n");
    const removed = removeProject(workspace, "accounting");
    assert.equal(removed.id, "accounting");
    assert.equal(fs.existsSync(path.join(accountingDir, ".ai", "manifest.yaml")), true);
    assert.equal(fs.existsSync(path.join(accountingDir, ".cursor", "rules", "keep.md")), true);
    assert.deepEqual(
      listProjects(workspace).projects.map((item) => item.id),
      ["wallet"],
    );
  } finally {
    rmTempDir(workspace);
  }
});

test("duplicate project ids conflict", () => {
  const workspace = makeTempDir();
  try {
    writeManifest(workspace, "specVersion: 1\nkind: workspace\nname: company-workspace\n");
    addProject(workspace, "accounting", "./accounting");
    assert.throws(() => addProject(workspace, "accounting", "./other"), (error: unknown) => {
      return error instanceof AiwError && error.code === "CONFLICT";
    });
  } finally {
    rmTempDir(workspace);
  }
});

test("project commands require kind workspace", () => {
  const root = makeTempDir();
  try {
    writeManifest(root, "specVersion: 1\nkind: project\nname: demo\n");
    assert.throws(() => listProjects(root), (error: unknown) => {
      return error instanceof AiwError && error.code === "VALIDATION";
    });
  } finally {
    rmTempDir(root);
  }
});

test("manifest schema rejects reserved project ids and accepts parent paths", () => {
  const reserved = parseAndValidateManifest(
    "specVersion: 1\nkind: workspace\nname: ws\nprojects:\n  con:\n    path: ./con\n",
  );
  assert.equal(reserved.ok, false);
  const parent = parseAndValidateManifest(
    "specVersion: 1\nkind: workspace\nname: ws\nprojects:\n  other:\n    path: ../outside\n",
  );
  assert.equal(parent.ok, true);
});
