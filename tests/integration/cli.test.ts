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

test("init creates only manifest.yaml", () => {
  const root = makeTempDir();
  try {
    const result = aiw(["init", "--path", root, "--name", "demo"]);
    assert.equal(result.status, 0, result.stderr);
    const aiDir = path.join(root, ".ai");
    const names = fs.readdirSync(aiDir);
    assert.deepEqual(names, ["manifest.yaml"]);
    const text = fs.readFileSync(path.join(aiDir, "manifest.yaml"), "utf8");
    assert.equal(text, "specVersion: 1\nkind: project\nname: demo\n");
    assert.equal(fs.existsSync(path.join(root, ".cursor")), false);
    assert.equal(fs.existsSync(path.join(root, "AGENTS.md")), false);
    assert.equal(fs.existsSync(path.join(root, "CLAUDE.md")), false);
  } finally {
    rmTempDir(root);
  }
});

test("init refuses to overwrite without --force", () => {
  const root = makeTempDir();
  try {
    aiw(["init", "--path", root, "--name", "demo"]);
    const result = aiw(["init", "--path", root, "--name", "demo"]);
    assert.equal(result.status, 3);
  } finally {
    rmTempDir(root);
  }
});

test("validate succeeds for a valid manifest", () => {
  const root = makeTempDir();
  try {
    aiw(["init", "--path", root, "--name", "demo"]);
    const result = aiw(["validate", "--path", root, "--json"]);
    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout) as { ok: boolean };
    assert.equal(payload.ok, true);
  } finally {
    rmTempDir(root);
  }
});

test("validate fails for an invalid manifest", () => {
  const root = makeTempDir();
  try {
    writeManifest(root, "specVersion: 1\nkind: nope\nname: demo\n");
    const result = aiw(["validate", "--path", root, "--json"]);
    assert.equal(result.status, 2);
    const payload = JSON.parse(result.stdout) as { ok: boolean };
    assert.equal(payload.ok, false);
  } finally {
    rmTempDir(root);
  }
});

test("status and doctor summarize a resolved project", () => {
  const root = makeTempDir();
  try {
    aiw(["init", "--path", root, "--name", "demo"]);
    writeFile(root, ".ai/rules/security.md", "be careful\n");
    const status = aiw(["status", "--path", root, "--json"]);
    assert.equal(status.status, 0, status.stderr);
    const summary = JSON.parse(status.stdout) as {
      active: { name: string };
      resources: { identities: string[] };
    };
    assert.equal(summary.active.name, "demo");
    assert.deepEqual(summary.resources.identities, ["rules/security.md"]);

    const doctor = aiw(["doctor", "--path", root, "--json"]);
    assert.equal(doctor.status, 0, doctor.stderr);
    const report = JSON.parse(doctor.stdout) as { ok: boolean; command: string };
    assert.equal(report.ok, true);
    assert.equal(report.command, "doctor");
  } finally {
    rmTempDir(root);
  }
});

test("CLI reports missing parent clearly", () => {
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
        "",
      ].join("\n"),
    );
    const result = aiw(["validate", "--path", root]);
    assert.equal(result.status, 2);
    assert.match(result.stdout + result.stderr, /Parent/i);
  } finally {
    rmTempDir(root);
  }
});

test("CLI exits 4 when no .ai is present", () => {
  const root = makeTempDir();
  try {
    const result = aiw(["status", "--path", root]);
    assert.equal(result.status, 4);
  } finally {
    rmTempDir(root);
  }
});

test("later-phase commands are rejected", () => {
  const result = aiw(["project"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Phase 5/);
});

test("--all is rejected in Phase 1", () => {
  const result = aiw(["status", "--all"]);
  assert.equal(result.status, 1);
});
