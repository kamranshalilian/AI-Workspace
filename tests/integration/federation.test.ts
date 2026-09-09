import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { resolveFrom } from "../../src/resolution/index.js";
import { makeTempDir, repoRoot, rmTempDir, writeFile, writeManifest } from "../helpers.js";

const cli = path.join(repoRoot(), "dist", "cli", "index.js");

function aiw(args: string[], cwd?: string) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf8",
    cwd,
  });
}

function federatedWorkspace(): { workspace: string; accounting: string; wallet: string } {
  const workspace = makeTempDir("aiw-fed-");
  writeManifest(workspace, "specVersion: 1\nkind: workspace\nname: company-workspace\n");
  writeFile(workspace, ".ai/rules/shared.md", "workspace-shared\n");
  const accounting = path.join(workspace, "accounting");
  const wallet = path.join(workspace, "wallet");
  fs.mkdirSync(accounting, { recursive: true });
  fs.mkdirSync(wallet, { recursive: true });
  writeManifest(
    accounting,
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
  writeManifest(wallet, "specVersion: 1\nkind: project\nname: wallet\n");
  writeFile(accounting, ".ai/rules/accounting.md", "accounting-only\n");
  writeFile(wallet, ".ai/rules/wallet.md", "wallet-only\n");
  writeFile(accounting, ".ai/rules/.env", "SECRET=accounting\n");
  writeFile(wallet, ".ai/rules/api.pem", "wallet-key\n");
  return { workspace, accounting, wallet };
}

test("registry membership does not imply inheritance", () => {
  const { workspace, accounting, wallet } = federatedWorkspace();
  try {
    aiw(["project", "add", "accounting", "./accounting", "--path", workspace]);
    aiw(["project", "add", "wallet", "./wallet", "--path", workspace]);
    const inherited = resolveFrom(accounting);
    const isolated = resolveFrom(wallet);
    assert.equal(
      inherited.resources.some((item) => item.identity === "rules/shared.md"),
      true,
    );
    assert.equal(
      inherited.resources.some((item) => item.identity === "rules/accounting.md"),
      true,
    );
    assert.equal(
      isolated.resources.some((item) => item.identity === "rules/shared.md"),
      false,
    );
    assert.equal(
      isolated.resources.some((item) => item.identity === "rules/wallet.md"),
      true,
    );
  } finally {
    rmTempDir(workspace);
  }
});

test("project add is registry-only and --path is the workspace root", () => {
  const workspace = makeTempDir("aiw-fed-");
  const elsewhere = makeTempDir("aiw-cwd-");
  try {
    assert.equal(aiw(["init", "--kind", "workspace", "--name", "company-workspace", "--path", workspace]).status, 0);
    const added = aiw(["project", "add", "accounting", "./accounting", "--path", workspace], elsewhere);
    assert.equal(added.status, 0, added.stderr);
    const manifest = fs.readFileSync(path.join(workspace, ".ai", "manifest.yaml"), "utf8");
    assert.match(manifest, /accounting:/);
    assert.match(manifest, /path: \.\/accounting/);
    assert.equal(fs.existsSync(path.join(workspace, "accounting")), false);
    assert.equal(fs.existsSync(path.join(elsewhere, "accounting")), false);
    assert.equal(fs.existsSync(path.join(elsewhere, ".ai")), false);
  } finally {
    rmTempDir(workspace);
    rmTempDir(elsewhere);
  }
});

test("project list reports resolved, unresolved, and invalid deterministically", () => {
  const { workspace, accounting } = federatedWorkspace();
  try {
    const nested = path.join(workspace, "nested", "frontend");
    fs.mkdirSync(nested, { recursive: true });
    writeManifest(nested, "specVersion: 1\nkind: project\nname: frontend\n");
    const filePath = path.join(workspace, "not-a-dir");
    fs.writeFileSync(filePath, "nope\n");
    aiw(["project", "add", "wallet", "./wallet", "--path", workspace]);
    aiw(["project", "add", "accounting", "./accounting", "--path", workspace]);
    aiw(["project", "add", "frontend", "./nested/frontend", "--path", workspace]);
    aiw(["project", "add", "missing", "./does-not-exist", "--path", workspace]);
    aiw(["project", "add", "broken", "./not-a-dir", "--path", workspace]);
    const listed = aiw(["project", "list", "--json", "--path", workspace]);
    assert.equal(listed.status, 0, listed.stderr);
    const payload = JSON.parse(listed.stdout) as {
      projects: { id: string; path: string; status: string }[];
    };
    assert.deepEqual(
      payload.projects.map((item) => item.id),
      ["accounting", "broken", "frontend", "missing", "wallet"],
    );
    assert.equal(payload.projects.find((item) => item.id === "accounting")?.status, "resolved");
    assert.equal(payload.projects.find((item) => item.id === "missing")?.status, "unresolved");
    assert.equal(payload.projects.find((item) => item.id === "broken")?.status, "invalid");
    assert.equal(fs.existsSync(path.join(accounting, ".ai", "manifest.yaml")), true);
  } finally {
    rmTempDir(workspace);
  }
});

test("symlink project paths that share a real directory are duplicate/invalid", () => {
  const { workspace } = federatedWorkspace();
  try {
    fs.symlinkSync("accounting", path.join(workspace, "accounting-link"));
    assert.equal(aiw(["project", "add", "accounting", "./accounting", "--path", workspace]).status, 0);
    assert.equal(aiw(["project", "add", "accounting-link", "./accounting-link", "--path", workspace]).status, 0);
    const listed = aiw(["project", "list", "--json", "--path", workspace]);
    assert.equal(listed.status, 0, listed.stderr);
    const payload = JSON.parse(listed.stdout) as {
      projects: { id: string; status: string; invalidReason?: string }[];
    };
    const accounting = payload.projects.find((item) => item.id === "accounting");
    const linked = payload.projects.find((item) => item.id === "accounting-link");
    assert.equal(accounting?.status, "invalid");
    assert.equal(linked?.status, "invalid");
    assert.match(accounting?.invalidReason ?? "", /Duplicate project path/);
    assert.match(linked?.invalidReason ?? "", /Duplicate project path/);
  } finally {
    rmTempDir(workspace);
  }
});

test("parent and absolute registry paths resolve from the workspace", () => {
  const parent = makeTempDir("aiw-parent-");
  const workspace = path.join(parent, "workspace");
  const outside = path.join(parent, "outside");
  const absProject = path.join(parent, "absolute-project");
  fs.mkdirSync(workspace, { recursive: true });
  fs.mkdirSync(outside, { recursive: true });
  fs.mkdirSync(absProject, { recursive: true });
  try {
    writeManifest(workspace, "specVersion: 1\nkind: workspace\nname: company-workspace\n");
    writeManifest(outside, "specVersion: 1\nkind: project\nname: outside\n");
    writeManifest(absProject, "specVersion: 1\nkind: project\nname: abs\n");
    const relative = aiw(["project", "add", "outside", "../outside", "--path", workspace]);
    assert.equal(relative.status, 0, relative.stderr);
    const absolute = aiw(["project", "add", "abs", absProject, "--path", workspace]);
    assert.equal(absolute.status, 0, absolute.stderr);
    const listed = aiw(["project", "list", "--json", "--path", workspace]);
    const payload = JSON.parse(listed.stdout) as { projects: { id: string; status: string; path: string }[] };
    assert.equal(payload.projects.find((item) => item.id === "outside")?.status, "resolved");
    assert.equal(payload.projects.find((item) => item.id === "abs")?.status, "resolved");
    assert.match(payload.projects.find((item) => item.id === "outside")?.path ?? "", /\.\.\/outside/);
  } finally {
    rmTempDir(parent);
  }
});

test("export --all isolates projects and does not export the workspace", () => {
  const { workspace, accounting, wallet } = federatedWorkspace();
  try {
    assert.equal(aiw(["project", "add", "wallet", "./wallet", "--path", workspace]).status, 0);
    assert.equal(aiw(["project", "add", "accounting", "./accounting", "--path", workspace]).status, 0);
    assert.equal(aiw(["agent", "add", "claude", "--path", accounting]).status, 0);
    assert.equal(aiw(["agent", "add", "claude", "--path", wallet]).status, 0);
    const exported = aiw(["export", "--all", "--json", "--path", workspace]);
    assert.equal(exported.status, 0, exported.stderr);
    const payload = JSON.parse(exported.stdout) as {
      ok: boolean;
      projects: { id: string }[];
    };
    assert.equal(payload.ok, true);
    assert.deepEqual(
      payload.projects.map((item) => item.id),
      ["accounting", "wallet"],
    );
    const accountingNative = fs.readFileSync(path.join(accounting, "CLAUDE.md"), "utf8");
    const walletNative = fs.readFileSync(path.join(wallet, "CLAUDE.md"), "utf8");
    assert.match(accountingNative, /accounting-only/);
    assert.match(accountingNative, /workspace-shared/);
    assert.equal(accountingNative.includes("wallet-only"), false);
    assert.equal(accountingNative.includes("SECRET=accounting"), false);
    assert.match(walletNative, /wallet-only/);
    assert.equal(walletNative.includes("accounting-only"), false);
    assert.equal(walletNative.includes("workspace-shared"), false);
    assert.equal(walletNative.includes("wallet-key"), false);
    assert.equal(fs.existsSync(path.join(workspace, "CLAUDE.md")), false);
    assert.equal(fs.existsSync(path.join(workspace, "AGENTS.md")), false);
    assert.equal(fs.existsSync(path.join(workspace, ".cursor")), false);
  } finally {
    rmTempDir(workspace);
  }
});

test("validate --all processes every registered project after a failure", () => {
  const { workspace, accounting, wallet } = federatedWorkspace();
  try {
    const frontend = path.join(workspace, "frontend");
    fs.mkdirSync(frontend, { recursive: true });
    writeManifest(frontend, "specVersion: 1\nkind: project\nname: frontend\n");
    writeManifest(wallet, "specVersion: 1\nkind: nope\nname: wallet\n");
    aiw(["project", "add", "frontend", "./frontend", "--path", workspace]);
    aiw(["project", "add", "wallet", "./wallet", "--path", workspace]);
    aiw(["project", "add", "accounting", "./accounting", "--path", workspace]);
    const result = aiw(["validate", "--all", "--json", "--path", workspace]);
    assert.notEqual(result.status, 0);
    const payload = JSON.parse(result.stdout) as {
      ok: boolean;
      projects: { id: string; ok: boolean; status: string }[];
    };
    assert.equal(payload.ok, false);
    assert.deepEqual(
      payload.projects.map((item) => item.id),
      ["accounting", "frontend", "wallet"],
    );
    assert.equal(payload.projects.find((item) => item.id === "accounting")?.ok, true);
    assert.equal(payload.projects.find((item) => item.id === "frontend")?.ok, true);
    assert.equal(payload.projects.find((item) => item.id === "wallet")?.ok, false);
    assert.equal(fs.existsSync(path.join(accounting, ".ai", "manifest.yaml")), true);
  } finally {
    rmTempDir(workspace);
  }
});

test("--all JSON is deterministic and empty registries are valid", () => {
  const workspace = makeTempDir("aiw-empty-");
  try {
    writeManifest(workspace, "specVersion: 1\nkind: workspace\nname: company-workspace\nprojects: {}\n");
    for (const command of ["status", "validate", "doctor", "export", "sync"]) {
      const result = aiw([command, "--all", "--json", "--path", workspace]);
      assert.equal(result.status, 0, `${command}: ${result.stderr}`);
      const payload = JSON.parse(result.stdout) as { ok: boolean; projects: unknown[]; workspace: { name: string } };
      assert.equal(payload.ok, true);
      assert.deepEqual(payload.projects, []);
      assert.equal(payload.workspace.name, "company-workspace");
    }
  } finally {
    rmTempDir(workspace);
  }
});

test("missing registered projects are unresolved in --all aggregates", () => {
  const workspace = makeTempDir("aiw-missing-");
  try {
    writeManifest(workspace, "specVersion: 1\nkind: workspace\nname: company-workspace\n");
    aiw(["project", "add", "missing", "./does-not-exist", "--path", workspace]);
    const result = aiw(["status", "--all", "--json", "--path", workspace]);
    assert.equal(result.status, 2);
    const payload = JSON.parse(result.stdout) as { ok: boolean; projects: { id: string; status: string; ok: boolean }[] };
    assert.equal(payload.ok, false);
    assert.equal(payload.projects[0]?.id, "missing");
    assert.equal(payload.projects[0]?.status, "unresolved");
    assert.equal(payload.projects[0]?.ok, false);
  } finally {
    rmTempDir(workspace);
  }
});

test("sync --all keeps per-project state files independent", () => {
  const { workspace, accounting, wallet } = federatedWorkspace();
  try {
    aiw(["project", "add", "accounting", "./accounting", "--path", workspace]);
    aiw(["project", "add", "wallet", "./wallet", "--path", workspace]);
    aiw(["agent", "add", "claude", "--path", accounting]);
    aiw(["agent", "add", "claude", "--path", wallet]);
    assert.equal(aiw(["export", "--all", "--path", workspace]).status, 0);
    const synced = aiw(["sync", "--all", "--json", "--path", workspace]);
    assert.equal(synced.status, 0, synced.stderr);
    const accountingState = path.join(accounting, ".ai", "state", "sync.yaml");
    const walletState = path.join(wallet, ".ai", "state", "sync.yaml");
    assert.equal(fs.existsSync(accountingState), true);
    assert.equal(fs.existsSync(walletState), true);
    assert.equal(fs.existsSync(path.join(workspace, ".ai", "state", "sync.yaml")), false);
    const accountingText = fs.readFileSync(accountingState, "utf8");
    const walletText = fs.readFileSync(walletState, "utf8");
    assert.match(accountingText, /accounting/);
    assert.match(walletText, /wallet/);
    assert.equal(accountingText.includes("wallet-only"), false);
    assert.equal(walletText.includes("accounting-only"), false);
  } finally {
    rmTempDir(workspace);
  }
});

test("unregistered siblings are ignored by --all", () => {
  const { workspace } = federatedWorkspace();
  try {
    aiw(["project", "add", "accounting", "./accounting", "--path", workspace]);
    const result = aiw(["status", "--all", "--json", "--path", workspace]);
    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout) as { projects: { id: string }[] };
    assert.deepEqual(
      payload.projects.map((item) => item.id),
      ["accounting"],
    );
  } finally {
    rmTempDir(workspace);
  }
});

test("import --all and project --all are rejected", () => {
  const workspace = makeTempDir();
  try {
    writeManifest(workspace, "specVersion: 1\nkind: workspace\nname: company-workspace\n");
    const importAll = aiw(["import", "--all", "--source", "x", "--path", workspace]);
    assert.equal(importAll.status, 1);
    const projectAll = aiw(["project", "list", "--all", "--path", workspace]);
    assert.equal(projectAll.status, 1);
  } finally {
    rmTempDir(workspace);
  }
});

test("invalid project ids fail before writing the registry", () => {
  const workspace = makeTempDir();
  try {
    writeManifest(workspace, "specVersion: 1\nkind: workspace\nname: company-workspace\n");
    const result = aiw(["project", "add", "../foo", "./accounting", "--path", workspace]);
    assert.equal(result.status, 1);
    const manifest = fs.readFileSync(path.join(workspace, ".ai", "manifest.yaml"), "utf8");
    assert.equal(manifest.includes("foo"), false);
  } finally {
    rmTempDir(workspace);
  }
});

test("status --all uses --path even when cwd is elsewhere", () => {
  const { workspace } = federatedWorkspace();
  const cwd = os.tmpdir();
  try {
    aiw(["project", "add", "accounting", "./accounting", "--path", workspace]);
    const result = aiw(["status", "--all", "--json", "--path", workspace], cwd);
    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout) as { projects: { id: string; status: string }[] };
    assert.equal(payload.projects[0]?.id, "accounting");
    assert.equal(payload.projects[0]?.status, "resolved");
  } finally {
    rmTempDir(workspace);
  }
});
