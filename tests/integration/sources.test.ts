import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { parseAndValidateManifest } from "../../src/manifest/index.js";
import { requireCapability } from "../../src/sources/capabilities.js";
import { makeTempDir, repoRoot, rmTempDir, writeFile, writeManifest } from "../helpers.js";

const cli = path.join(repoRoot(), "dist", "cli", "index.js");
const fixtures = path.join(repoRoot(), "tests", "fixtures");

function aiw(args: string[], cwd: string) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf8",
    cwd,
  });
}

function initProject(): string {
  const root = makeTempDir();
  assert.equal(aiw(["init", "--name", "demo"], root).status, 0);
  return root;
}

function copyFixture(name: string, dest: string): void {
  fs.cpSync(path.join(fixtures, name), dest, { recursive: true });
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

test("A — source schema accepts directory/file/repository/generated", () => {
  for (const type of ["directory", "file", "repository", "generated"]) {
    const result = parseAndValidateManifest(
      `specVersion: 1\nkind: project\nname: demo\nsources:\n  knowledge:\n    type: ${type}\n    path: ../data\n`,
    );
    assert.equal(result.ok, true, type);
  }
});

test("B — reserved source types are rejected", () => {
  for (const type of ["command", "api", "mcp", "database", "remote"]) {
    const result = parseAndValidateManifest(
      `specVersion: 1\nkind: project\nname: demo\nsources:\n  bad:\n    type: ${type}\n    path: ../data\n`,
    );
    assert.equal(result.ok, false, type);
    if (!result.ok) {
      assert.ok(result.issues.some((issue) => /reserved/i.test(issue.message)));
    }
  }
});

test("C — read and index capabilities are accepted", () => {
  const result = parseAndValidateManifest(
    "specVersion: 1\nkind: project\nname: demo\nsources:\n  docs:\n    type: directory\n    path: ../docs\n    capabilities: [read, index]\n",
  );
  assert.equal(result.ok, true);
});

test("D — future capabilities are recognized but operationally rejected", () => {
  const parsed = parseAndValidateManifest(
    "specVersion: 1\nkind: project\nname: demo\nsources:\n  docs:\n    type: directory\n    path: ../docs\n    capabilities: [read, write]\n",
  );
  assert.equal(parsed.ok, true);
  assert.throws(
    () => requireCapability({ id: "docs", capabilities: ["read", "write"] }, "write", "mutate"),
    /not implemented/,
  );
});

test("E — unknown capabilities are rejected", () => {
  const result = parseAndValidateManifest(
    "specVersion: 1\nkind: project\nname: demo\nsources:\n  docs:\n    type: directory\n    path: ../docs\n    capabilities: [teleport]\n",
  );
  assert.equal(result.ok, false);
});

test("F/W — source add is manifest-only and does not copy", () => {
  const root = initProject();
  const knowledge = path.join(path.dirname(root), `${path.basename(root)}-knowledge`);
  try {
    fs.mkdirSync(knowledge, { recursive: true });
    fs.writeFileSync(path.join(knowledge, "note.md"), "hello\n");
    const before = walkRelative(root);
    const added = aiw(
      ["source", "add", "knowledge", "--type", "directory", "--path", "../" + path.basename(knowledge), "--capabilities", "read,index"],
      root,
    );
    assert.equal(added.status, 0, added.stderr);
    assert.equal(fs.existsSync(path.join(root, ".ai", "sources")), false);
    assert.equal(fs.existsSync(path.join(root, ".ai", "sources", "knowledge")), false);
    const after = walkRelative(root);
    assert.deepEqual(
      after.filter((item) => item !== ".ai/manifest.yaml"),
      before.filter((item) => item !== ".ai/manifest.yaml"),
    );
    assert.match(fs.readFileSync(path.join(root, ".ai", "manifest.yaml"), "utf8"), /knowledge:/);
    assert.match(fs.readFileSync(path.join(root, ".ai", "manifest.yaml"), "utf8"), /type: directory/);
  } finally {
    rmTempDir(root);
    rmTempDir(knowledge);
  }
});

test("G — source list is human-readable", () => {
  const root = initProject();
  try {
    const listedEmpty = aiw(["source", "list"], root);
    assert.equal(listedEmpty.status, 0, listedEmpty.stderr);
    assert.match(listedEmpty.stdout, /\(none\)/);
    assert.equal(
      aiw(["source", "add", "docs", "--type", "generated", "--path", "../.missing"], root).status,
      0,
    );
    const listed = aiw(["source", "list"], root);
    assert.equal(listed.status, 0, listed.stderr);
    assert.match(listed.stdout, /docs/);
    assert.match(listed.stdout, /type: generated/);
    assert.match(listed.stdout, /status: unresolved/);
  } finally {
    rmTempDir(root);
  }
});

test("H — source list JSON is deterministic", () => {
  const root = initProject();
  try {
    assert.equal(aiw(["source", "add", "docs", "--type", "file", "--path", "./README.md"], root).status, 0);
    const first = aiw(["source", "list", "--json"], root);
    const second = aiw(["source", "list", "--json"], root);
    assert.equal(first.status, 0, first.stderr);
    assert.equal(first.stdout, second.stdout);
    const payload = JSON.parse(first.stdout) as { specVersion: number; command: string; sources: unknown[] };
    assert.equal(payload.specVersion, 1);
    assert.equal(payload.command, "source-list");
  } finally {
    rmTempDir(root);
  }
});

test("I — source remove is manifest-only", () => {
  const root = initProject();
  const file = path.join(root, "keep.md");
  try {
    fs.writeFileSync(file, "keep\n");
    assert.equal(aiw(["source", "add", "keep", "--type", "file", "--path", "./keep.md"], root).status, 0);
    const removed = aiw(["source", "remove", "keep"], root);
    assert.equal(removed.status, 0, removed.stderr);
    assert.equal(fs.existsSync(file), true);
    assert.equal(fs.existsSync(path.join(root, ".ai", "sources")), false);
    assert.doesNotMatch(fs.readFileSync(path.join(root, ".ai", "manifest.yaml"), "utf8"), /keep:/);
  } finally {
    rmTempDir(root);
  }
});

test("J — duplicate source add is protected", () => {
  const root = initProject();
  try {
    assert.equal(aiw(["source", "add", "docs", "--type", "directory", "--path", "../docs"], root).status, 0);
    const duplicate = aiw(["source", "add", "docs", "--type", "directory", "--path", "../other"], root);
    assert.equal(duplicate.status, 3);
    assert.match(duplicate.stderr, /already registered/);
  } finally {
    rmTempDir(root);
  }
});

test("K — missing path registers as unresolved, not invalid", () => {
  const root = initProject();
  try {
    const added = aiw(["source", "add", "graphify", "--type", "generated", "--path", "../.graphify"], root);
    assert.equal(added.status, 0, added.stderr);
    const listed = JSON.parse(aiw(["source", "list", "--json"], root).stdout) as {
      sources: { id: string; status: string }[];
    };
    assert.equal(listed.sources[0]?.status, "unresolved");
    const validated = aiw(["validate", "--json"], root);
    assert.equal(validated.status, 0, validated.stderr);
    assert.equal((JSON.parse(validated.stdout) as { ok: boolean }).ok, true);
  } finally {
    rmTempDir(root);
  }
});

test("L/P/S — directory inventory is recursive, filtered, and identity-stable", () => {
  const root = initProject();
  const tree = path.join(root, "knowledge");
  try {
    fs.mkdirSync(path.join(tree, "keep"), { recursive: true });
    fs.mkdirSync(path.join(tree, "skip"), { recursive: true });
    fs.writeFileSync(path.join(tree, "keep", "a.md"), "a\n");
    fs.writeFileSync(path.join(tree, "keep", "b.txt"), "b\n");
    fs.writeFileSync(path.join(tree, "skip", "c.md"), "c\n");
    writeManifest(
      root,
      [
        "specVersion: 1",
        "kind: project",
        "name: demo",
        "sources:",
        "  knowledge:",
        "    type: directory",
        "    path: ./knowledge",
        "    capabilities: [read, index]",
        "    include: [\"**/*.md\"]",
        "    exclude: [\"skip/**\"]",
        "",
      ].join("\n"),
    );
    const listed = JSON.parse(aiw(["source", "list", "--json"], root).stdout) as {
      sources: { files: { relativePath: string; identity: string }[] }[];
    };
    assert.deepEqual(listed.sources[0]?.files, [
      { relativePath: "keep/a.md", identity: "source:knowledge:keep/a.md" },
    ]);
  } finally {
    rmTempDir(root);
  }
});

test("M — file source inventories a single file", () => {
  const root = initProject();
  try {
    fs.writeFileSync(path.join(root, "ARCHITECTURE.md"), "# arch\n");
    assert.equal(
      aiw(["source", "add", "architecture", "--type", "file", "--path", "./ARCHITECTURE.md", "--capabilities", "read,index"], root)
        .status,
      0,
    );
    const listed = JSON.parse(aiw(["source", "list", "--json"], root).stdout) as {
      sources: { files: { identity: string }[] }[];
    };
    assert.deepEqual(listed.sources[0]?.files.map((item) => item.identity), [
      "source:architecture:ARCHITECTURE.md",
    ]);
  } finally {
    rmTempDir(root);
  }
});

test("N — repository source is a local tree", () => {
  const root = initProject();
  try {
    fs.mkdirSync(path.join(root, "lib", "src"), { recursive: true });
    fs.writeFileSync(path.join(root, "lib", "src", "index.ts"), "export {}\n");
    assert.equal(
      aiw(["source", "add", "shared", "--type", "repository", "--path", "./lib", "--capabilities", "read,index"], root).status,
      0,
    );
    const listed = JSON.parse(aiw(["source", "list", "--json"], root).stdout) as {
      sources: { type: string; status: string; files: { identity: string }[] }[];
    };
    assert.equal(listed.sources[0]?.type, "repository");
    assert.equal(listed.sources[0]?.status, "resolved");
    assert.ok(listed.sources[0]?.files.some((item) => item.identity === "source:shared:src/index.ts"));
  } finally {
    rmTempDir(root);
  }
});

test("O — generated source does not execute and is unresolved when missing", () => {
  const root = initProject();
  try {
    const added = aiw(["source", "add", "generated-data", "--type", "generated", "--path", "./out"], root);
    assert.equal(added.status, 0, added.stderr);
    assert.equal(fs.existsSync(path.join(root, "out")), false);
    const listed = JSON.parse(aiw(["source", "list", "--json"], root).stdout) as {
      sources: { status: string }[];
    };
    assert.equal(listed.sources[0]?.status, "unresolved");
  } finally {
    rmTempDir(root);
  }
});

test("Q — security exclusions apply to source inventory", () => {
  const root = initProject();
  const tree = path.join(root, "ext");
  try {
    fs.mkdirSync(tree, { recursive: true });
    fs.writeFileSync(path.join(tree, "ok.md"), "ok\n");
    fs.writeFileSync(path.join(tree, ".env"), "SECRET=1\n");
    fs.writeFileSync(path.join(tree, ".env.local"), "SECRET=2\n");
    fs.writeFileSync(path.join(tree, "site.pem"), "pem\n");
    fs.writeFileSync(path.join(tree, "site.key"), "key\n");
    fs.writeFileSync(path.join(tree, "site.p12"), "p12\n");
    fs.writeFileSync(path.join(tree, "site.pfx"), "pfx\n");
    fs.writeFileSync(path.join(tree, "id_rsa"), "rsa\n");
    fs.writeFileSync(path.join(tree, "id_ed25519"), "ed\n");
    fs.writeFileSync(path.join(tree, "credentials.json"), "{}\n");
    fs.writeFileSync(path.join(tree, "secrets.txt"), "x\n");
    fs.writeFileSync(path.join(tree, "tokens.txt"), "y\n");
    assert.equal(
      aiw(["source", "add", "ext", "--type", "directory", "--path", "./ext", "--capabilities", "read,index"], root).status,
      0,
    );
    const listed = JSON.parse(aiw(["source", "list", "--json"], root).stdout) as {
      sources: { files: { relativePath: string }[] }[];
    };
    assert.deepEqual(listed.sources[0]?.files.map((item) => item.relativePath), ["ok.md"]);
  } finally {
    rmTempDir(root);
  }
});

test("Q — symlink targets remain subject to security exclusions", () => {
  const root = initProject();
  const tree = path.join(root, "ext");
  try {
    fs.mkdirSync(tree, { recursive: true });
    const secret = path.join(root, ".env");
    fs.writeFileSync(secret, "SECRET=1\n");
    fs.writeFileSync(path.join(tree, "visible.md"), "ok\n");
    fs.symlinkSync(secret, path.join(tree, "not-secret.md"));
    assert.equal(
      aiw(["source", "add", "ext", "--type", "directory", "--path", "./ext", "--capabilities", "read,index"], root).status,
      0,
    );
    const listed = JSON.parse(aiw(["source", "list", "--json"], root).stdout) as {
      sources: { files: { relativePath: string }[] }[];
    };
    const names = listed.sources[0]?.files.map((item) => item.relativePath) ?? [];
    assert.deepEqual(names, ["visible.md"]);
  } finally {
    rmTempDir(root);
  }
});

test("R — sources inherit with child-wins semantics", () => {
  const workspace = makeTempDir();
  const project = path.join(workspace, "app");
  try {
    writeManifest(
      workspace,
      [
        "specVersion: 1",
        "kind: workspace",
        "name: company",
        "sources:",
        "  shared:",
        "    type: directory",
        "    path: ./docs",
        "",
      ].join("\n"),
    );
    fs.mkdirSync(path.join(workspace, "docs"), { recursive: true });
    fs.mkdirSync(project, { recursive: true });
    writeManifest(
      project,
      [
        "specVersion: 1",
        "kind: project",
        "name: app",
        "extends:",
        "  - path: ../.ai",
        "    mode: extend",
        "sources:",
        "  local:",
        "    type: file",
        "    path: ./README.md",
        "",
      ].join("\n"),
    );
    writeFile(project, "README.md", "hi\n");
    const listed = JSON.parse(aiw(["source", "list", "--json"], project).stdout) as {
      sources: { id: string }[];
    };
    assert.deepEqual(listed.sources.map((item) => item.id), ["local", "shared"]);
  } finally {
    rmTempDir(workspace);
  }
});

test("T/U/V — generic fixtures work through the same source implementation", () => {
  const cases = [
    { fixture: "graphify-shaped", id: "graphify", expected: ["edges/relationships.yaml", "nodes/a.yaml", "nodes/b.yaml"] },
    { fixture: "spec-kit-shaped", id: "spec-kit", expected: ["docs/guide.md", "metadata/info.yaml", "specs/feature.md"] },
    {
      fixture: "arbitrary-knowledge",
      id: "arbitrary",
      expected: ["architecture/system.md", "data/facts.yaml", "notes/todo.md"],
    },
  ];
  for (const item of cases) {
    const root = initProject();
    const dest = path.join(root, item.fixture);
    try {
      copyFixture(item.fixture, dest);
      const added = aiw(
        ["source", "add", item.id, "--type", "directory", "--path", `./${item.fixture}`, "--capabilities", "read,index"],
        root,
      );
      assert.equal(added.status, 0, added.stderr);
      const listed = JSON.parse(aiw(["source", "list", "--json"], root).stdout) as {
        sources: { files: { relativePath: string; identity: string }[] }[];
      };
      assert.deepEqual(
        listed.sources[0]?.files.map((file) => file.relativePath),
        item.expected,
      );
      assert.ok(listed.sources[0]?.files.every((file) => file.identity.startsWith(`source:${item.id}:`)));
    } finally {
      rmTempDir(root);
    }
  }
});

test("invalid IDs and Windows-style paths are handled", () => {
  const root = initProject();
  const sibling = path.join(path.dirname(root), `${path.basename(root)}-data`);
  try {
    fs.mkdirSync(path.join(sibling, "bar"), { recursive: true });
    fs.writeFileSync(path.join(sibling, "bar", "a.md"), "a\n");
    for (const id of ["../foo", "foo/bar", "foo\\bar", "/foo", ".", ".."]) {
      const result = aiw(["source", "add", id, "--type", "directory", "--path", "./x"], root);
      assert.notEqual(result.status, 0, id);
    }
    const added = aiw(
      ["source", "add", "shared", "--type", "directory", "--path", `..\\${path.basename(sibling)}\\bar`, "--capabilities", "read,index"],
      root,
    );
    assert.equal(added.status, 0, added.stderr);
    const manifest = fs.readFileSync(path.join(root, ".ai", "manifest.yaml"), "utf8");
    assert.match(manifest, /path: \.\.\/.*\/bar/);
    assert.equal(manifest.includes("\\"), false);
    const status = JSON.parse(aiw(["status", "--json"], root).stdout) as {
      sources: { status: string }[];
    };
    assert.equal(status.sources[0]?.status, "resolved");
    const doctor = aiw(["doctor", "--json"], root);
    assert.equal(doctor.status, 0, doctor.stderr);
    assert.match(doctor.stdout, /source shared: resolved/);
  } finally {
    rmTempDir(root);
    rmTempDir(sibling);
  }
});

test("type mismatch is invalid and fails validate", () => {
  const root = initProject();
  try {
    fs.mkdirSync(path.join(root, "dir"), { recursive: true });
    writeManifest(
      root,
      [
        "specVersion: 1",
        "kind: project",
        "name: demo",
        "sources:",
        "  bad:",
        "    type: file",
        "    path: ./dir",
        "",
      ].join("\n"),
    );
    const listed = JSON.parse(aiw(["source", "list", "--json"], root).stdout) as {
      sources: { status: string }[];
    };
    assert.equal(listed.sources[0]?.status, "invalid");
    const validated = aiw(["validate", "--json"], root);
    assert.equal(validated.status, 2);
  } finally {
    rmTempDir(root);
  }
});

test("source files are not fed into agent resources", () => {
  const root = initProject();
  try {
    fs.mkdirSync(path.join(root, "ext"), { recursive: true });
    fs.writeFileSync(path.join(root, "ext", "note.md"), "note\n");
    writeFile(root, ".ai/rules/security.md", "rule\n");
    assert.equal(
      aiw(["source", "add", "ext", "--type", "directory", "--path", "./ext", "--capabilities", "read,index"], root).status,
      0,
    );
    const status = JSON.parse(aiw(["status", "--json"], root).stdout) as { resources: { identities: string[] } };
    assert.deepEqual(status.resources.identities, ["rules/security.md"]);
    assert.equal(status.resources.identities.some((item) => item.startsWith("source:")), false);
  } finally {
    rmTempDir(root);
  }
});
