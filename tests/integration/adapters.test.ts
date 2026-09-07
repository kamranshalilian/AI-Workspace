import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { parseAgentDefinition } from "../../src/agents/parse.js";
import { applyTemplate } from "../../src/adapters/templates.js";
import { makeTempDir, repoRoot, rmTempDir, writeFile, writeManifest } from "../helpers.js";

const cli = path.join(repoRoot(), "dist", "cli", "index.js");

function aiw(args: string[], cwd?: string) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf8",
    cwd,
  });
}

function fixtureProject(): string {
  const root = makeTempDir();
  writeManifest(root, "specVersion: 1\nkind: project\nname: demo\n");
  writeFile(root, ".ai/rules/security.md", "do not leak secrets\n");
  return root;
}

test("A — bundled rules definition produces a native rule file", () => {
  const root = fixtureProject();
  try {
    assert.equal(aiw(["agent", "add", "cursor", "--path", root]).status, 0);
    assert.equal(aiw(["export", "--agent", "cursor", "--path", root]).status, 0);
    const generated = fs.readFileSync(path.join(root, ".cursor", "rules", "security.mdc"), "utf8");
    assert.match(generated, /aiw-provenance:/);
    assert.match(generated, /do not leak secrets/);
    assert.match(generated, /description: security/);
  } finally {
    rmTempDir(root);
  }
});

test("B — concatenated definition produces a root markdown file", () => {
  const root = fixtureProject();
  try {
    assert.equal(aiw(["agent", "add", "claude", "--path", root]).status, 0);
    assert.equal(aiw(["export", "--agent", "claude", "--path", root]).status, 0);
    const generated = fs.readFileSync(path.join(root, "CLAUDE.md"), "utf8");
    assert.match(generated, /aiw-provenance:/);
    assert.match(generated, /## rules \/ security/);
    assert.match(generated, /do not leak secrets/);
  } finally {
    rmTempDir(root);
  }
});

test("C — second concatenated definition uses the same canonical rule", () => {
  const root = fixtureProject();
  try {
    assert.equal(aiw(["agent", "add", "codex", "--path", root]).status, 0);
    assert.equal(aiw(["export", "--agent", "codex", "--path", root]).status, 0);
    const generated = fs.readFileSync(path.join(root, "AGENTS.md"), "utf8");
    assert.match(generated, /aiw-provenance:/);
    assert.match(generated, /do not leak secrets/);
  } finally {
    rmTempDir(root);
  }
});

test("D — one canonical source produces three native representations", () => {
  const root = fixtureProject();
  try {
    assert.equal(aiw(["agent", "add", "cursor", "--path", root]).status, 0);
    assert.equal(aiw(["agent", "add", "claude", "--path", root]).status, 0);
    assert.equal(aiw(["agent", "add", "codex", "--path", root]).status, 0);
    assert.equal(aiw(["export", "--path", root]).status, 0);
    assert.equal(fs.existsSync(path.join(root, ".cursor", "rules", "security.mdc")), true);
    assert.equal(fs.existsSync(path.join(root, "CLAUDE.md")), true);
    assert.equal(fs.existsSync(path.join(root, "AGENTS.md")), true);
  } finally {
    rmTempDir(root);
  }
});

test("E — export is byte-deterministic", () => {
  const root = fixtureProject();
  try {
    aiw(["agent", "add", "claude", "--path", root]);
    aiw(["export", "--path", root]);
    const first = fs.readFileSync(path.join(root, "CLAUDE.md"));
    const secondRun = aiw(["export", "--path", root, "--json"]);
    assert.equal(secondRun.status, 0);
    const payload = JSON.parse(secondRun.stdout) as { agents: { unchanged: string[] }[] };
    assert.deepEqual(payload.agents[0]?.unchanged, ["CLAUDE.md"]);
    const second = fs.readFileSync(path.join(root, "CLAUDE.md"));
    assert.deepEqual(second, first);
  } finally {
    rmTempDir(root);
  }
});

test("F — unmanaged native files are not overwritten", () => {
  const root = fixtureProject();
  try {
    writeFile(root, "CLAUDE.md", "hand written\n");
    aiw(["agent", "add", "claude", "--path", root]);
    const result = aiw(["export", "--path", root]);
    assert.equal(result.status, 3);
    assert.equal(fs.readFileSync(path.join(root, "CLAUDE.md"), "utf8"), "hand written\n");
  } finally {
    rmTempDir(root);
  }
});

test("G — managed native files update when canonical content changes", () => {
  const root = fixtureProject();
  try {
    aiw(["agent", "add", "cursor", "--path", root]);
    aiw(["export", "--path", root]);
    writeFile(root, ".ai/rules/security.md", "updated rule\n");
    assert.equal(aiw(["export", "--path", root]).status, 0);
    const generated = fs.readFileSync(path.join(root, ".cursor", "rules", "security.mdc"), "utf8");
    assert.match(generated, /updated rule/);
    assert.doesNotMatch(generated, /do not leak secrets/);
  } finally {
    rmTempDir(root);
  }
});

test("H — agent add changes only the manifest", () => {
  const root = fixtureProject();
  try {
    const before = walkRelative(root);
    assert.equal(aiw(["agent", "add", "cursor", "--path", root]).status, 0);
    const after = walkRelative(root);
    assert.deepEqual(after, before);
    const manifest = fs.readFileSync(path.join(root, ".ai", "manifest.yaml"), "utf8");
    assert.match(manifest, /definition: cursor/);
    assert.equal(fs.existsSync(path.join(root, ".cursor")), false);
  } finally {
    rmTempDir(root);
  }
});

test("I — agent remove does not delete native files", () => {
  const root = fixtureProject();
  try {
    aiw(["agent", "add", "claude", "--path", root]);
    aiw(["export", "--path", root]);
    const result = aiw(["agent", "remove", "claude", "--path", root]);
    assert.equal(result.status, 0);
    assert.equal(fs.existsSync(path.join(root, "CLAUDE.md")), true);
    const manifest = fs.readFileSync(path.join(root, ".ai", "manifest.yaml"), "utf8");
    assert.doesNotMatch(manifest, /definition: claude/);
  } finally {
    rmTempDir(root);
  }
});

test("J — unknown agent fails", () => {
  const root = fixtureProject();
  try {
    const result = aiw(["agent", "add", "does-not-exist", "--path", root]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Unknown agent definition/);
  } finally {
    rmTempDir(root);
  }
});

test("K — synthetic YAML agent works without Core changes", () => {
  const root = fixtureProject();
  try {
    writeFile(
      root,
      ".ai/agents/test-agent.yaml",
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
  } finally {
    rmTempDir(root);
  }
});

test("L — mapping output paths normalize Windows separators", () => {
  const posix = applyTemplate("out\\{{stem}}.md", {
    identity: "rules/security.md",
    kind: "rules",
    relativePath: "security.md",
    stem: "security",
    name: "security",
  });
  assert.equal(posix, "out/security.md");
});

test("M — executable adapters are rejected", () => {
  const parsed = parseAgentDefinition(
    [
      "specVersion: 1",
      "kind: agent-definition",
      "id: bad",
      "name: Bad",
      "adapter:",
      "  engine: executable",
      "  mappings:",
      "    - fromKind: rules",
      "      from: \"**/*.md\"",
      "      to: OUT.md",
      "      format: identity",
      "",
    ].join("\n"),
    "bad.yaml",
  );
  assert.equal(parsed.ok, false);
  if (!parsed.ok) {
    assert.ok(parsed.issues.some((issue) => /executable/i.test(issue.message)));
  }
});

function walkRelative(root: string): string[] {
  const results: string[] = [];
  const walk = (dir: string) => {
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
