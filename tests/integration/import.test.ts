import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { makeTempDir, repoRoot, rmTempDir, writeFile, writeManifest } from "../helpers.js";

const cli = path.join(repoRoot(), "dist", "cli", "index.js");

function aiw(args: string[], cwd: string) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf8",
    cwd,
  });
}

function initProject(): string {
  const root = makeTempDir("aiw-import-");
  writeManifest(root, "specVersion: 1\nkind: project\nname: demo\n");
  return root;
}

function addDirectorySource(root: string, id: string, sourceDir: string, capabilities = "read,index,import") {
  const rel = path.relative(root, sourceDir).split(path.sep).join("/");
  const added = aiw(
    ["source", "add", id, "--type", "directory", "--path", rel.startsWith(".") ? rel : `./${rel}`, "--capabilities", capabilities],
    root,
  );
  assert.equal(added.status, 0, added.stderr);
}

test("valid source import materializes a snapshot and leaves the live source untouched", () => {
  const root = initProject();
  const knowledge = path.join(root, "knowledge");
  try {
    fs.mkdirSync(path.join(knowledge, "notes"), { recursive: true });
    fs.writeFileSync(path.join(knowledge, "notes", "a.md"), "alpha\n");
    fs.writeFileSync(path.join(knowledge, "notes", "b.md"), "beta\n");
    addDirectorySource(root, "knowledge", knowledge);
    const before = fs.readFileSync(path.join(knowledge, "notes", "a.md"), "utf8");
    const result = aiw(["import", "--source", "knowledge", "--json"], root);
    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout) as { ok: boolean; written: string[]; source: { kind: string; id: string } };
    assert.equal(payload.ok, true);
    assert.equal(payload.source.kind, "source");
    assert.equal(payload.source.id, "knowledge");
    assert.equal(fs.readFileSync(path.join(root, ".ai", "sources", "knowledge", "notes", "a.md"), "utf8"), "alpha\n");
    assert.equal(fs.readFileSync(path.join(knowledge, "notes", "a.md"), "utf8"), before);
    const index = fs.readFileSync(path.join(root, ".ai", "sources", "knowledge", ".aiw-import.yaml"), "utf8");
    assert.match(index, /kind: import-snapshot/);
    assert.match(index, /kind: source/);
    assert.match(index, /id: knowledge/);
  } finally {
    rmTempDir(root);
  }
});

test("missing registered source fails", () => {
  const root = initProject();
  try {
    const result = aiw(["import", "--source", "missing"], root);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /not registered/);
  } finally {
    rmTempDir(root);
  }
});

test("unresolved source fails", () => {
  const root = initProject();
  try {
    const added = aiw(
      ["source", "add", "gone", "--type", "directory", "--path", "./nope", "--capabilities", "read,index,import"],
      root,
    );
    assert.equal(added.status, 0, added.stderr);
    const result = aiw(["import", "--source", "gone"], root);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /unresolved/);
  } finally {
    rmTempDir(root);
  }
});

test("include/exclude and security exclusions apply to import", () => {
  const root = initProject();
  const tree = path.join(root, "tree");
  try {
    fs.mkdirSync(path.join(tree, "keep"), { recursive: true });
    fs.mkdirSync(path.join(tree, "skip"), { recursive: true });
    fs.writeFileSync(path.join(tree, "keep", "ok.md"), "ok\n");
    fs.writeFileSync(path.join(tree, "skip", "no.md"), "no\n");
    fs.writeFileSync(path.join(tree, ".env"), "SECRET=1\n");
    fs.writeFileSync(path.join(tree, "site.key"), "key\n");
    fs.writeFileSync(path.join(tree, "tokens.txt"), "t\n");
    writeManifest(
      root,
      "specVersion: 1\nkind: project\nname: demo\nsources:\n  tree:\n    type: directory\n    path: ./tree\n    capabilities: [read, index, import]\n    include: [keep/**]\n    exclude: []\n",
    );
    const result = aiw(["import", "--source", "tree"], root);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(path.join(root, ".ai", "sources", "tree", "keep", "ok.md")), true);
    assert.equal(fs.existsSync(path.join(root, ".ai", "sources", "tree", "skip", "no.md")), false);
    assert.equal(fs.existsSync(path.join(root, ".ai", "sources", "tree", ".env")), false);
    assert.equal(fs.existsSync(path.join(root, ".ai", "sources", "tree", "site.key")), false);
    assert.equal(fs.existsSync(path.join(root, ".ai", "sources", "tree", "tokens.txt")), false);
  } finally {
    rmTempDir(root);
  }
});

test("import is deterministic and idempotent", () => {
  const root = initProject();
  const knowledge = path.join(root, "knowledge");
  try {
    fs.mkdirSync(knowledge, { recursive: true });
    fs.writeFileSync(path.join(knowledge, "z.md"), "z\n");
    fs.writeFileSync(path.join(knowledge, "a.md"), "a\n");
    addDirectorySource(root, "knowledge", knowledge);
    const first = aiw(["import", "--source", "knowledge", "--json"], root);
    const second = aiw(["import", "--source", "knowledge", "--json"], root);
    assert.equal(first.status, 0, first.stderr);
    assert.equal(second.status, 0, second.stderr);
    const a = JSON.parse(first.stdout) as { written: string[]; unchanged: string[] };
    const b = JSON.parse(second.stdout) as { written: string[]; unchanged: string[] };
    assert.deepEqual(a.written, [".ai/sources/knowledge/a.md", ".ai/sources/knowledge/z.md"]);
    assert.deepEqual(b.unchanged, a.written);
    assert.deepEqual(b.written, []);
  } finally {
    rmTempDir(root);
  }
});

test("dry-run import reports writes without creating snapshot files", () => {
  const root = initProject();
  const knowledge = path.join(root, "knowledge");
  try {
    fs.mkdirSync(knowledge, { recursive: true });
    fs.writeFileSync(path.join(knowledge, "note.md"), "hi\n");
    addDirectorySource(root, "knowledge", knowledge);
    const result = aiw(["import", "--source", "knowledge", "--dry-run", "--json"], root);
    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout) as { dryRun: boolean; written: string[] };
    assert.equal(payload.dryRun, true);
    assert.deepEqual(payload.written, [".ai/sources/knowledge/note.md"]);
    assert.equal(fs.existsSync(path.join(root, ".ai", "sources")), false);
    assert.equal(fs.existsSync(path.join(root, ".ai", "state")), false);
  } finally {
    rmTempDir(root);
  }
});

test("unmanaged snapshot files are not overwritten", () => {
  const root = initProject();
  const knowledge = path.join(root, "knowledge");
  try {
    fs.mkdirSync(knowledge, { recursive: true });
    fs.writeFileSync(path.join(knowledge, "note.md"), "live\n");
    addDirectorySource(root, "knowledge", knowledge);
    writeFile(root, ".ai/sources/knowledge/note.md", "hand written\n");
    const result = aiw(["import", "--source", "knowledge"], root);
    assert.equal(result.status, 3);
    assert.equal(fs.readFileSync(path.join(root, ".ai", "sources", "knowledge", "note.md"), "utf8"), "hand written\n");
    assert.equal(fs.readFileSync(path.join(knowledge, "note.md"), "utf8"), "live\n");
  } finally {
    rmTempDir(root);
  }
});

test("Graphify-shaped and spec-kit-shaped fixtures import through the generic directory type", () => {
  const root = initProject();
  try {
    const graphify = path.join(repoRoot(), "tests", "fixtures", "graphify-shaped");
    const specKit = path.join(repoRoot(), "tests", "fixtures", "spec-kit-shaped");
    const arbitrary = path.join(repoRoot(), "tests", "fixtures", "arbitrary-knowledge");
    addDirectorySource(root, "graph", graphify);
    addDirectorySource(root, "specs", specKit);
    addDirectorySource(root, "docs", arbitrary);
    assert.equal(aiw(["import", "--source", "graph"], root).status, 0);
    assert.equal(aiw(["import", "--source", "specs"], root).status, 0);
    assert.equal(aiw(["import", "--source", "docs"], root).status, 0);
    assert.equal(fs.existsSync(path.join(root, ".ai", "sources", "graph", "nodes", "a.yaml")), true);
    assert.equal(fs.existsSync(path.join(root, ".ai", "sources", "specs", "specs", "feature.md")), true);
    assert.equal(fs.existsSync(path.join(root, ".ai", "sources", "docs", "notes", "todo.md")), true);
  } finally {
    rmTempDir(root);
  }
});

test("import does not export native agent files", () => {
  const root = initProject();
  const knowledge = path.join(root, "knowledge");
  try {
    fs.mkdirSync(knowledge, { recursive: true });
    fs.writeFileSync(path.join(knowledge, "note.md"), "hi\n");
    addDirectorySource(root, "knowledge", knowledge);
    assert.equal(aiw(["import", "--source", "knowledge"], root).status, 0);
    assert.equal(fs.existsSync(path.join(root, ".cursor")), false);
    assert.equal(fs.existsSync(path.join(root, "AGENTS.md")), false);
    assert.equal(fs.existsSync(path.join(root, "CLAUDE.md")), false);
  } finally {
    rmTempDir(root);
  }
});
