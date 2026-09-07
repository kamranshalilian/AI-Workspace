import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { parseAgentDefinition } from "../../src/agents/parse.js";
import { renderAgentDefinitionStub } from "../../src/agents/stub.js";
import { makeTempDir, repoRoot, rmTempDir, writeFile, writeManifest } from "../helpers.js";

const cli = path.join(repoRoot(), "dist", "cli", "index.js");

function aiw(args: string[], cwd?: string) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf8",
    cwd,
  });
}

function fixtureProject(): { root: string; manifest: string } {
  const root = makeTempDir();
  const manifest = writeManifest(root, "specVersion: 1\nkind: project\nname: demo\n");
  return { root, manifest };
}

function walkRelative(root: string): string[] {
  const results: string[] = [];
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) {
      return;
    }
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const abs = path.join(dir, entry.name);
      const rel = path.relative(root, abs).split(path.sep).join("/");
      if (entry.isDirectory()) {
        walk(abs);
      } else {
        results.push(rel);
      }
    }
  };
  walk(root);
  return results;
}

test("A — agent create writes the expected YAML stub", () => {
  const { root } = fixtureProject();
  try {
    const result = aiw(["agent", "create", "my-agent", "--path", root]);
    assert.equal(result.status, 0, result.stderr);
    const dest = path.join(root, ".ai", "agents", "my-agent.yaml");
    assert.equal(fs.existsSync(dest), true);
    assert.equal(fs.readFileSync(dest, "utf8"), renderAgentDefinitionStub("my-agent"));
  } finally {
    rmTempDir(root);
  }
});

test("B — create is local to .ai/agents", () => {
  const { root } = fixtureProject();
  try {
    assert.equal(aiw(["agent", "create", "my-agent", "--path", root]).status, 0);
    assert.deepEqual(walkRelative(root), [".ai/agents/my-agent.yaml", ".ai/manifest.yaml"]);
    assert.equal(fs.existsSync(path.join(root, ".cursor")), false);
    assert.equal(fs.existsSync(path.join(root, "AGENTS.md")), false);
    assert.equal(fs.existsSync(path.join(root, "CLAUDE.md")), false);
  } finally {
    rmTempDir(root);
  }
});

test("C — create does not modify the manifest", () => {
  const { root, manifest } = fixtureProject();
  try {
    const before = fs.readFileSync(manifest, "utf8");
    assert.equal(aiw(["agent", "create", "my-agent", "--path", root]).status, 0);
    assert.equal(fs.readFileSync(manifest, "utf8"), before);
  } finally {
    rmTempDir(root);
  }
});

test("D — generated stub passes definition validation", () => {
  const { root } = fixtureProject();
  try {
    assert.equal(aiw(["agent", "create", "my-agent", "--path", root]).status, 0);
    const text = fs.readFileSync(path.join(root, ".ai", "agents", "my-agent.yaml"), "utf8");
    const parsed = parseAgentDefinition(text, path.join(root, ".ai", "agents", "my-agent.yaml"));
    assert.equal(parsed.ok, true);
  } finally {
    rmTempDir(root);
  }
});

test("E — registry discovers the newly created definition", () => {
  const { root } = fixtureProject();
  try {
    assert.equal(aiw(["agent", "create", "my-agent", "--path", root]).status, 0);
    const listed = aiw(["agent", "list", "--json", "--path", root]);
    assert.equal(listed.status, 0, listed.stderr);
    const payload = JSON.parse(listed.stdout) as {
      available: { id: string; source: string }[];
      enabled: unknown[];
    };
    const found = payload.available.find((item) => item.id === "my-agent");
    assert.equal(found?.source, "local");
    assert.deepEqual(payload.enabled, []);
  } finally {
    rmTempDir(root);
  }
});

test("F — created agent can be added with existing agent add", () => {
  const { root, manifest } = fixtureProject();
  try {
    assert.equal(aiw(["agent", "create", "my-agent", "--path", root]).status, 0);
    const added = aiw(["agent", "add", "my-agent", "--path", root]);
    assert.equal(added.status, 0, added.stderr);
    assert.match(fs.readFileSync(manifest, "utf8"), /my-agent:/);
  } finally {
    rmTempDir(root);
  }
});

test("G/M — created and configured agent exports through the generic engine", () => {
  const { root } = fixtureProject();
  try {
    writeFile(root, ".ai/rules/security.md", "do not leak secrets\n");
    assert.equal(aiw(["agent", "create", "test-agent", "--path", root]).status, 0);
    fs.writeFileSync(
      path.join(root, ".ai", "agents", "test-agent.yaml"),
      [
        "specVersion: 1",
        "kind: agent-definition",
        "id: test-agent",
        "name: Test Agent",
        "capabilities:",
        "  - rules",
        "native:",
        "  files:",
        "    - NATIVE.md",
        "adapter:",
        "  engine: declarative",
        "  strategy: generated",
        "  mappings:",
        "    - fromKind: rules",
        "      from: \"**/*.md\"",
        "      to: NATIVE.md",
        "      format: concatenated-markdown",
        "      provenance: header",
        "",
      ].join("\n"),
    );
    assert.equal(aiw(["agent", "add", "test-agent", "--path", root]).status, 0);
    assert.equal(aiw(["export", "--agent", "test-agent", "--path", root]).status, 0);
    const generated = fs.readFileSync(path.join(root, "NATIVE.md"), "utf8");
    assert.match(generated, /aiw-provenance:/);
    assert.match(generated, /do not leak secrets/);
    assert.equal(fs.existsSync(path.join(repoRoot(), "src", "adapters", "test-agent.ts")), false);
    assert.equal(fs.existsSync(path.join(repoRoot(), "src", "agents", "test-agent.ts")), false);
  } finally {
    rmTempDir(root);
  }
});

test("H — empty mappings do not crash export", () => {
  const { root } = fixtureProject();
  try {
    assert.equal(aiw(["agent", "create", "my-agent", "--path", root]).status, 0);
    assert.equal(aiw(["agent", "add", "my-agent", "--path", root]).status, 0);
    const exported = aiw(["export", "--agent", "my-agent", "--path", root]);
    assert.equal(exported.status, 0, exported.stderr);
    assert.match(exported.stdout, /No mappings matched; nothing to export/);
    assert.deepEqual(
      walkRelative(root).filter((item) => !item.startsWith(".ai/")),
      [],
    );
  } finally {
    rmTempDir(root);
  }
});

test("I — duplicate definitions are not overwritten", () => {
  const { root } = fixtureProject();
  try {
    assert.equal(aiw(["agent", "create", "my-agent", "--path", root]).status, 0);
    const original = fs.readFileSync(path.join(root, ".ai", "agents", "my-agent.yaml"), "utf8");
    const duplicate = aiw(["agent", "create", "my-agent", "--path", root]);
    assert.equal(duplicate.status, 3);
    assert.match(duplicate.stderr, /already exists/);
    assert.equal(fs.readFileSync(path.join(root, ".ai", "agents", "my-agent.yaml"), "utf8"), original);
  } finally {
    rmTempDir(root);
  }
});

test("J — invalid IDs are rejected", () => {
  const { root } = fixtureProject();
  try {
    const missing = aiw(["agent", "create", "--path", root]);
    assert.equal(missing.status, 1);
    const upper = aiw(["agent", "create", "My-Agent", "--path", root]);
    assert.equal(upper.status, 1);
    assert.match(upper.stderr, /Invalid agent id/);
    assert.equal(fs.existsSync(path.join(root, ".ai", "agents")), false);
  } finally {
    rmTempDir(root);
  }
});

test("K — path traversal IDs cannot escape .ai/agents", () => {
  const { root } = fixtureProject();
  try {
    for (const id of ["../foo", "../../foo", "foo/bar", "foo\\bar", "/foo", "C:\\foo", "C:/foo", ".", ".."]) {
      const result = aiw(["agent", "create", id, "--path", root]);
      assert.notEqual(result.status, 0, id);
      assert.notEqual(result.status, 0);
    }
    assert.equal(fs.existsSync(path.join(root, "foo.yaml")), false);
    assert.equal(fs.existsSync(path.join(root, ".ai", "foo.yaml")), false);
    assert.equal(walkRelative(root).some((item) => item.includes("..")), false);
  } finally {
    rmTempDir(root);
  }
});

test("L — local definition shadows bundled definition without modifying the package", () => {
  const { root } = fixtureProject();
  const bundled = path.join(repoRoot(), "definitions", "agents", "cursor.yaml");
  const before = fs.readFileSync(bundled, "utf8");
  try {
    assert.equal(aiw(["agent", "create", "cursor", "--path", root]).status, 0);
    assert.equal(fs.readFileSync(bundled, "utf8"), before);
    const local = fs.readFileSync(path.join(root, ".ai", "agents", "cursor.yaml"), "utf8");
    assert.equal(local, renderAgentDefinitionStub("cursor"));
    assert.notEqual(local, before);
    const listed = JSON.parse(aiw(["agent", "list", "--json", "--path", root]).stdout) as {
      available: { id: string; source: string }[];
    };
    assert.equal(listed.available.find((item) => item.id === "cursor")?.source, "local");
  } finally {
    rmTempDir(root);
  }
});

test("N — generated YAML is deterministic", () => {
  const first = fixtureProject();
  const second = fixtureProject();
  try {
    assert.equal(aiw(["agent", "create", "my-agent", "--path", first.root]).status, 0);
    assert.equal(aiw(["agent", "create", "my-agent", "--path", second.root]).status, 0);
    const a = fs.readFileSync(path.join(first.root, ".ai", "agents", "my-agent.yaml"));
    const b = fs.readFileSync(path.join(second.root, ".ai", "agents", "my-agent.yaml"));
    assert.deepEqual(a, b);
    assert.equal(a.includes(0x0d), false);
  } finally {
    rmTempDir(first.root);
    rmTempDir(second.root);
  }
});

test("O — logical path is POSIX while writes use the filesystem abstraction", () => {
  const { root } = fixtureProject();
  try {
    const created = aiw(["agent", "create", "my-agent", "--json", "--path", root]);
    assert.equal(created.status, 0, created.stderr);
    const payload = JSON.parse(created.stdout) as { path: string; id: string };
    assert.equal(payload.path, ".ai/agents/my-agent.yaml");
    assert.equal(payload.path.includes("\\"), false);
    assert.equal(fs.existsSync(path.join(root, ".ai", "agents", "my-agent.yaml")), true);
  } finally {
    rmTempDir(root);
  }
});

test("unknown workspace/project is a non-zero error", () => {
  const root = makeTempDir();
  try {
    const result = aiw(["agent", "create", "my-agent", "--path", root]);
    assert.equal(result.status, 4);
    assert.match(result.stderr, /No \.ai\/manifest\.yaml/);
  } finally {
    rmTempDir(root);
  }
});
