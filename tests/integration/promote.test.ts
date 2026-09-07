import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { makeTempDir, repoRoot, rmTempDir, writeFile, writeManifest } from "../helpers.js";

const aiwBin = path.join(repoRoot(), "dist", "cli", "index.js");

function aiw(args: string[], cwd?: string) {
  return spawnSync(process.execPath, [aiwBin, ...args], {
    encoding: "utf8",
    cwd,
  });
}

function projectWithNative(): string {
  const root = makeTempDir("aiw-promote-");
  writeManifest(root, "specVersion: 1\nkind: project\nname: demo\n");
  return root;
}

test("valid native artifact with a reversible mapping is promoted", () => {
  const root = projectWithNative();
  try {
    writeFile(root, ".ai/rules/security.md", "do not leak secrets\n");
    assert.equal(aiw(["agent", "add", "cursor", "--path", root]).status, 0);
    assert.equal(aiw(["export", "--agent", "cursor", "--path", root]).status, 0);
    writeFile(root, ".cursor/rules/security.mdc", fs.readFileSync(path.join(root, ".cursor", "rules", "security.mdc"), "utf8").replace("do not leak secrets", "promoted body"));
    const result = aiw(["promote", "--agent", "cursor", "--json", "--path", root]);
    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout) as { ok: boolean; agent: { kind: string; id: string }; written: string[] };
    assert.equal(payload.ok, true);
    assert.equal(payload.agent.kind, "agent");
    assert.equal(payload.agent.id, "cursor");
    assert.equal(fs.readFileSync(path.join(root, ".ai", "rules", "security.md"), "utf8"), "promoted body\n");
  } finally {
    rmTempDir(root);
  }
});

test("missing reversible mapping fails clearly", () => {
  const root = projectWithNative();
  try {
    assert.equal(aiw(["agent", "create", "local-agent", "--path", root]).status, 0);
    assert.equal(aiw(["agent", "add", "local-agent", "--path", root]).status, 0);
    const result = aiw(["promote", "--agent", "local-agent", "--path", root]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /no mapping that can be reversed/i);
  } finally {
    rmTempDir(root);
  }
});

test("unsupported concatenated format fails clearly", () => {
  const root = projectWithNative();
  try {
    writeFile(root, ".ai/rules/security.md", "rule\n");
    assert.equal(aiw(["agent", "add", "claude", "--path", root]).status, 0);
    const result = aiw(["promote", "--agent", "claude", "--path", root]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /cannot be reversed|no mapping that can be reversed/i);
  } finally {
    rmTempDir(root);
  }
});

test("unmanaged canonical files are not overwritten by promote", () => {
  const root = projectWithNative();
  try {
    writeFile(root, ".ai/rules/security.md", "canonical original\n");
    writeFile(
      root,
      ".cursor/rules/security.mdc",
      "---\ndescription: security\n---\nfrom native\n",
    );
    assert.equal(aiw(["agent", "add", "cursor", "--path", root]).status, 0);
    const result = aiw(["promote", "--agent", "cursor", "--path", root]);
    assert.equal(result.status, 3, result.stderr);
    assert.equal(fs.readFileSync(path.join(root, ".ai", "rules", "security.md"), "utf8"), "canonical original\n");
  } finally {
    rmTempDir(root);
  }
});

test("promote is deterministic and preserves provenance relationship", () => {
  const root = projectWithNative();
  try {
    writeFile(
      root,
      ".cursor/rules/security.mdc",
      "---\ndescription: security\n---\nfirst\n",
    );
    assert.equal(aiw(["agent", "add", "cursor", "--path", root]).status, 0);
    const first = aiw(["promote", "--agent", "cursor", "--json", "--path", root]);
    const second = aiw(["promote", "--agent", "cursor", "--json", "--path", root]);
    assert.equal(first.status, 0, first.stderr);
    assert.equal(second.status, 0, second.stderr);
    const a = JSON.parse(first.stdout) as { written: string[] };
    const b = JSON.parse(second.stdout) as { unchanged: string[] };
    assert.deepEqual(a.written, [".ai/rules/security.md"]);
    assert.deepEqual(b.unchanged, [".ai/rules/security.md"]);
    assert.equal(fs.readFileSync(path.join(root, ".ai", "rules", "security.md"), "utf8"), "first\n");
  } finally {
    rmTempDir(root);
  }
});

test("dry-run promote does not write canonical files", () => {
  const root = projectWithNative();
  try {
    writeFile(
      root,
      ".cursor/rules/security.mdc",
      "---\ndescription: security\n---\npreview\n",
    );
    assert.equal(aiw(["agent", "add", "cursor", "--path", root]).status, 0);
    const result = aiw(["promote", "--agent", "cursor", "--dry-run", "--json", "--path", root]);
    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout) as { dryRun: boolean; written: string[] };
    assert.equal(payload.dryRun, true);
    assert.deepEqual(payload.written, [".ai/rules/security.md"]);
    assert.equal(fs.existsSync(path.join(root, ".ai", "rules", "security.md")), false);
  } finally {
    rmTempDir(root);
  }
});

test("promote --agent is required", () => {
  const root = projectWithNative();
  try {
    const result = aiw(["promote", "--path", root]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Usage: aiw promote --agent/);
  } finally {
    rmTempDir(root);
  }
});
