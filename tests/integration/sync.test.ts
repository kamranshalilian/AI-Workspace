import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { makeTempDir, repoRoot, rmTempDir, writeFile, writeManifest } from "../helpers.js";

const cli = path.join(repoRoot(), "dist", "cli", "index.js");

function aiw(args: string[], cwd?: string) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf8",
    cwd,
  });
}

function setupImportedSource(): { root: string; knowledge: string } {
  const root = makeTempDir("aiw-sync-");
  writeManifest(root, "specVersion: 1\nkind: project\nname: demo\n");
  const knowledge = path.join(root, "knowledge");
  fs.mkdirSync(knowledge, { recursive: true });
  fs.writeFileSync(path.join(knowledge, "note.md"), "v1\n");
  const added = aiw(
    ["source", "add", "knowledge", "--type", "directory", "--path", "./knowledge", "--capabilities", "read,index,import"],
    root,
  );
  assert.equal(added.status, 0, added.stderr);
  const imported = aiw(["import", "--source", "knowledge"], root);
  assert.equal(imported.status, 0, imported.stderr);
  return { root, knowledge };
}

test("sync reports clean when both sides are unchanged", () => {
  const { root } = setupImportedSource();
  try {
    const first = aiw(["sync", "--source", "knowledge", "--json"], root);
    const second = aiw(["sync", "--source", "knowledge", "--json"], root);
    assert.equal(first.status, 0, first.stderr);
    assert.equal(second.status, 0, second.stderr);
    const a = JSON.parse(first.stdout) as { relations: { state: string }[] };
    const b = JSON.parse(second.stdout) as { relations: { state: string }[] };
    assert.equal(a.relations[0]?.state, "clean");
    assert.equal(b.relations[0]?.state, "clean");
  } finally {
    rmTempDir(root);
  }
});

test("canonical-only change is canonical-changed and does not overwrite the live source", () => {
  const { root, knowledge } = setupImportedSource();
  try {
    aiw(["sync", "--source", "knowledge"], root);
    writeFile(root, ".ai/sources/knowledge/note.md", "snapshot-only\n");
    const result = aiw(["sync", "--source", "knowledge", "--json"], root);
    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout) as { relations: { state: string }[] };
    assert.equal(payload.relations[0]?.state, "canonical-changed");
    assert.equal(fs.readFileSync(path.join(knowledge, "note.md"), "utf8"), "v1\n");
  } finally {
    rmTempDir(root);
  }
});

test("external-only change is external-changed and does not overwrite the snapshot until apply", () => {
  const { root, knowledge } = setupImportedSource();
  try {
    aiw(["sync", "--source", "knowledge"], root);
    fs.writeFileSync(path.join(knowledge, "note.md"), "live-only\n");
    const result = aiw(["sync", "--source", "knowledge", "--json"], root);
    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout) as { relations: { state: string }[]; written: string[] };
    assert.equal(payload.relations[0]?.state, "external-changed");
    assert.equal(fs.readFileSync(path.join(root, ".ai", "sources", "knowledge", "note.md"), "utf8"), "v1\n");
    const applied = aiw(["sync", "--source", "knowledge", "--apply", "--json"], root);
    assert.equal(applied.status, 0, applied.stderr);
    assert.equal(fs.readFileSync(path.join(root, ".ai", "sources", "knowledge", "note.md"), "utf8"), "live-only\n");
    assert.equal(fs.readFileSync(path.join(knowledge, "note.md"), "utf8"), "live-only\n");
  } finally {
    rmTempDir(root);
  }
});

test("changed / changed is a conflict and preserves both states", () => {
  const { root, knowledge } = setupImportedSource();
  try {
    aiw(["sync", "--source", "knowledge"], root);
    writeFile(root, ".ai/sources/knowledge/note.md", "snapshot-edit\n");
    fs.writeFileSync(path.join(knowledge, "note.md"), "live-edit\n");
    const result = aiw(["sync", "--source", "knowledge", "--apply", "--json"], root);
    assert.equal(result.status, 3, result.stderr);
    const payload = JSON.parse(result.stdout) as { ok: boolean; conflicts: string[]; relations: { state: string }[] };
    assert.equal(payload.ok, false);
    assert.equal(payload.relations[0]?.state, "conflict");
    assert.ok(payload.conflicts.length > 0);
    assert.equal(fs.readFileSync(path.join(root, ".ai", "sources", "knowledge", "note.md"), "utf8"), "snapshot-edit\n");
    assert.equal(fs.readFileSync(path.join(knowledge, "note.md"), "utf8"), "live-edit\n");
  } finally {
    rmTempDir(root);
  }
});

test("dry-run apply does not write files", () => {
  const { root, knowledge } = setupImportedSource();
  try {
    aiw(["sync", "--source", "knowledge"], root);
    fs.writeFileSync(path.join(knowledge, "note.md"), "live-only\n");
    const result = aiw(["sync", "--source", "knowledge", "--apply", "--dry-run", "--json"], root);
    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout) as { dryRun: boolean; apply: boolean; written: string[] };
    assert.equal(payload.dryRun, true);
    assert.equal(payload.apply, true);
    assert.ok(payload.written.includes(".ai/sources/knowledge/note.md"));
    assert.equal(fs.readFileSync(path.join(root, ".ai", "sources", "knowledge", "note.md"), "utf8"), "v1\n");
  } finally {
    rmTempDir(root);
  }
});

test("agent sync distinguishes canonical-changed from native unmanaged protection", () => {
  const root = makeTempDir("aiw-sync-agent-");
  try {
    writeManifest(root, "specVersion: 1\nkind: project\nname: demo\n");
    writeFile(root, ".ai/rules/security.md", "rule-v1\n");
    assert.equal(aiw(["agent", "add", "cursor", "--path", root]).status, 0);
    assert.equal(aiw(["export", "--agent", "cursor", "--path", root]).status, 0);
    assert.equal(aiw(["sync", "--agent", "cursor", "--path", root]).status, 0);
    writeFile(root, ".ai/rules/security.md", "rule-v2\n");
    const changed = aiw(["sync", "--agent", "cursor", "--json", "--path", root]);
    assert.equal(changed.status, 0, changed.stderr);
    const payload = JSON.parse(changed.stdout) as { relations: { state: string; path: string }[] };
    assert.equal(payload.relations[0]?.state, "canonical-changed");
    writeFile(root, ".cursor/rules/security.mdc", "hand written native\n");
    const unmanaged = aiw(["sync", "--agent", "cursor", "--apply", "--json", "--path", root]);
    assert.equal(unmanaged.status, 3, unmanaged.stderr);
    const unmanagedPayload = JSON.parse(unmanaged.stdout) as { skippedUnmanaged: string[] };
    assert.ok(unmanagedPayload.skippedUnmanaged.includes(".cursor/rules/security.mdc"));
    assert.equal(fs.readFileSync(path.join(root, ".cursor", "rules", "security.mdc"), "utf8"), "hand written native\n");
  } finally {
    rmTempDir(root);
  }
});

test("sync does not import secrets", () => {
  const root = makeTempDir("aiw-sync-sec-");
  try {
    writeManifest(root, "specVersion: 1\nkind: project\nname: demo\n");
    const knowledge = path.join(root, "knowledge");
    fs.mkdirSync(knowledge, { recursive: true });
    fs.writeFileSync(path.join(knowledge, "ok.md"), "ok\n");
    fs.writeFileSync(path.join(knowledge, ".env"), "SECRET=1\n");
    const added = aiw(
      ["source", "add", "knowledge", "--type", "directory", "--path", "./knowledge", "--capabilities", "read,index,import"],
      root,
    );
    assert.equal(added.status, 0, added.stderr);
    assert.equal(aiw(["import", "--source", "knowledge"], root).status, 0);
    assert.equal(aiw(["sync", "--source", "knowledge", "--apply"], root).status, 0);
    assert.equal(fs.existsSync(path.join(root, ".ai", "sources", "knowledge", ".env")), false);
  } finally {
    rmTempDir(root);
  }
});

test("import without --source is a usage error", () => {
  const root = makeTempDir("aiw-sync-usage-");
  try {
    writeManifest(root, "specVersion: 1\nkind: project\nname: demo\n");
    const result = aiw(["import"], root);
    assert.equal(result.status, 1);
  } finally {
    rmTempDir(root);
  }
});
