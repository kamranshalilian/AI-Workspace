import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { AiwError } from "../../src/core/errors.js";
import { resolveFrom } from "../../src/resolution/index.js";
import { makeTempDir, rmTempDir, writeFile, writeManifest } from "../helpers.js";

function nestedWorkspace(): { workspace: string; project: string } {
  const workspace = makeTempDir();
  writeManifest(
    workspace,
    [
      "specVersion: 1",
      "kind: workspace",
      "name: company",
      "sources:",
      "  shared-docs:",
      "    type: directory",
      "    path: ./docs",
      "agents:",
      "  shared:",
      "    definition: shared",
      "",
    ].join("\n"),
  );
  writeFile(workspace, ".ai/rules/security.md", "workspace security\n");
  writeFile(workspace, ".ai/rules/legacy.md", "legacy\n");
  writeFile(workspace, ".ai/architecture/overview.md", "architecture\n");
  fs.mkdirSync(path.join(workspace, "docs"), { recursive: true });

  const project = path.join(workspace, "accounting");
  fs.mkdirSync(project, { recursive: true });
  return { workspace, project };
}

test("extend unions parent and child, child wins on identity", () => {
  const { workspace, project } = nestedWorkspace();
  try {
    writeManifest(
      project,
      [
        "specVersion: 1",
        "kind: project",
        "name: accounting",
        "extends:",
        "  - path: ../.ai",
        "    mode: extend",
        "",
      ].join("\n"),
    );
    writeFile(project, ".ai/rules/security.md", "project security\n");
    writeFile(project, ".ai/rules/payments.md", "payments\n");

    const snapshot = resolveFrom(project);
    const identities = snapshot.resources.map((item) => item.identity);
    assert.deepEqual(identities, [
      "architecture/overview.md",
      "rules/legacy.md",
      "rules/payments.md",
      "rules/security.md",
    ]);
    const security = snapshot.resources.find((item) => item.identity === "rules/security.md");
    assert.equal(security?.originName, "accounting");
    const architecture = snapshot.resources.find((item) => item.identity === "architecture/overview.md");
    assert.equal(architecture?.originName, "company");
    assert.equal(snapshot.sources.some((source) => source.id === "shared-docs"), true);
    assert.equal(snapshot.agents.some((agent) => agent.id === "shared"), true);
    assert.equal(snapshot.inheritance.mode, "extend");
  } finally {
    rmTempDir(workspace);
  }
});

test("extend exclude omits inherited identities but keeps child files", () => {
  const { workspace, project } = nestedWorkspace();
  try {
    writeManifest(
      project,
      [
        "specVersion: 1",
        "kind: project",
        "name: accounting",
        "extends:",
        "  - path: ../.ai",
        "    mode: extend",
        "    exclude:",
        "      - rules/legacy.md",
        "",
      ].join("\n"),
    );
    const snapshot = resolveFrom(project);
    assert.equal(
      snapshot.resources.some((item) => item.identity === "rules/legacy.md"),
      false,
    );
    assert.equal(
      snapshot.resources.some((item) => item.identity === "rules/security.md"),
      true,
    );
  } finally {
    rmTempDir(workspace);
  }
});

test("replace keeps only child resources and does not inherit sources", () => {
  const { workspace, project } = nestedWorkspace();
  try {
    writeManifest(
      project,
      [
        "specVersion: 1",
        "kind: project",
        "name: accounting",
        "extends:",
        "  - path: ../.ai",
        "    mode: replace",
        "",
      ].join("\n"),
    );
    writeFile(project, ".ai/rules/payments.md", "payments\n");
    const snapshot = resolveFrom(project);
    assert.deepEqual(
      snapshot.resources.map((item) => item.identity),
      ["rules/payments.md"],
    );
    assert.equal(snapshot.sources.length, 0);
    assert.equal(snapshot.agents.length, 0);
    assert.equal(snapshot.inheritance.mode, "replace");
    assert.equal(snapshot.inheritance.parent?.name, "company");
  } finally {
    rmTempDir(workspace);
  }
});

test("disable ignores parent even if it exists", () => {
  const { workspace, project } = nestedWorkspace();
  try {
    writeManifest(
      project,
      [
        "specVersion: 1",
        "kind: project",
        "name: accounting",
        "extends:",
        "  - path: ../.ai",
        "    mode: disable",
        "",
      ].join("\n"),
    );
    writeFile(project, ".ai/rules/local.md", "local\n");
    const snapshot = resolveFrom(project);
    assert.deepEqual(
      snapshot.resources.map((item) => item.identity),
      ["rules/local.md"],
    );
    assert.equal(snapshot.inheritance.mode, "disable");
    assert.equal(snapshot.sources.length, 0);
  } finally {
    rmTempDir(workspace);
  }
});

test("no parent resolves only local files", () => {
  const root = makeTempDir();
  try {
    writeManifest(root, "specVersion: 1\nkind: project\nname: solo\n");
    writeFile(root, ".ai/rules/a.md", "a\n");
    const snapshot = resolveFrom(root);
    assert.equal(snapshot.inheritance.mode, "none");
    assert.deepEqual(
      snapshot.resources.map((item) => item.identity),
      ["rules/a.md"],
    );
  } finally {
    rmTempDir(root);
  }
});

test("missing parent is an error for extend", () => {
  const root = makeTempDir();
  try {
    writeManifest(
      root,
      [
        "specVersion: 1",
        "kind: project",
        "name: orphan",
        "extends:",
        "  - path: ../.ai",
        "    mode: extend",
        "",
      ].join("\n"),
    );
    assert.throws(() => resolveFrom(root), (error: unknown) => {
      assert.ok(error instanceof AiwError);
      assert.equal(error.code, "MISSING_PARENT");
      return true;
    });
  } finally {
    rmTempDir(root);
  }
});

test("detects inheritance cycles", () => {
  const root = makeTempDir();
  const a = path.join(root, "alpha");
  const b = path.join(root, "beta");
  fs.mkdirSync(a, { recursive: true });
  fs.mkdirSync(b, { recursive: true });
  try {
    writeManifest(
      a,
      [
        "specVersion: 1",
        "kind: project",
        "name: alpha",
        "extends:",
        "  - path: ../beta/.ai",
        "",
      ].join("\n"),
    );
    writeManifest(
      b,
      [
        "specVersion: 1",
        "kind: project",
        "name: beta",
        "extends:",
        "  - path: ../alpha/.ai",
        "",
      ].join("\n"),
    );
    assert.throws(() => resolveFrom(a), (error: unknown) => {
      assert.ok(error instanceof AiwError);
      assert.equal(error.code, "CYCLE");
      return true;
    });
  } finally {
    rmTempDir(root);
  }
});

test("resolution ordering is deterministic", () => {
  const root = makeTempDir();
  try {
    writeManifest(root, "specVersion: 1\nkind: project\nname: ordered\n");
    writeFile(root, ".ai/rules/b.md", "b\n");
    writeFile(root, ".ai/rules/a.md", "a\n");
    writeFile(root, ".ai/context/z.md", "z\n");
    const first = resolveFrom(root).resources.map((item) => item.identity);
    const second = resolveFrom(root).resources.map((item) => item.identity);
    assert.deepEqual(first, ["context/z.md", "rules/a.md", "rules/b.md"]);
    assert.deepEqual(second, first);
  } finally {
    rmTempDir(root);
  }
});

test("excludes sensitive files from resources", () => {
  const root = makeTempDir();
  try {
    writeManifest(root, "specVersion: 1\nkind: project\nname: secure\n");
    writeFile(root, ".ai/rules/ok.md", "ok\n");
    writeFile(root, ".ai/rules/.env", "SECRET=1\n");
    writeFile(root, ".ai/rules/id_ed25519", "key\n");
    const snapshot = resolveFrom(root);
    assert.deepEqual(
      snapshot.resources.map((item) => item.identity),
      ["rules/ok.md"],
    );
    assert.ok(snapshot.skipped.some((issue) => issue.code === "EXCLUDED"));
  } finally {
    rmTempDir(root);
  }
});

test("child source id overrides inherited source", () => {
  const { workspace, project } = nestedWorkspace();
  try {
    writeManifest(
      project,
      [
        "specVersion: 1",
        "kind: project",
        "name: accounting",
        "extends:",
        "  - path: ../.ai",
        "    mode: extend",
        "sources:",
        "  shared-docs:",
        "    type: file",
        "    path: ./README.md",
        "",
      ].join("\n"),
    );
    writeFile(project, "README.md", "hello\n");
    const snapshot = resolveFrom(project);
    const source = snapshot.sources.find((item) => item.id === "shared-docs");
    assert.equal(source?.type, "file");
    assert.equal(source?.originName, "accounting");
    assert.equal(source?.status, "ok");
  } finally {
    rmTempDir(workspace);
  }
});
