import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { makeTempDir, repoRoot, rmTempDir } from "../helpers.js";

test("P/Q/R/S — packed global CLI works outside the repository", { timeout: 180_000 }, () => {
  const packDir = makeTempDir("aiw-pack-");
  const prefix = makeTempDir("aiw-prefix-");
  const outside = makeTempDir("aiw-clean-");
  try {
    const packed = spawnSync("npm", ["pack", "--pack-destination", packDir], {
      cwd: repoRoot(),
      encoding: "utf8",
    });
    assert.equal(packed.status, 0, packed.stderr);
    const tarballs = fs.readdirSync(packDir).filter((name) => name.endsWith(".tgz"));
    assert.equal(tarballs.length, 1);
    const tgz = path.join(packDir, tarballs[0] ?? "");
    const listing = spawnSync("tar", ["-tzf", tgz], { encoding: "utf8" });
    assert.equal(listing.status, 0, listing.stderr);
    const names = listing.stdout.split("\n");
    assert.ok(names.includes("package/dist/cli/index.js"), "CLI entrypoint missing from tarball");
    assert.ok(names.includes("package/package.json"), "package.json missing from tarball");
    assert.ok(names.includes("package/definitions/agents/cursor.yaml"), "bundled cursor definition missing");
    assert.ok(names.includes("package/definitions/agents/claude.yaml"), "bundled claude definition missing");
    assert.ok(names.includes("package/definitions/agents/codex.yaml"), "bundled codex definition missing");
    assert.ok(
      names.includes("package/dist/definitions/agents/cursor.yaml"),
      "runtime copied cursor definition missing",
    );
    assert.equal(
      names.some((name) => name === "package/src/cli/index.ts" || name.startsWith("package/src/")),
      false,
      "source tree must not be required at runtime",
    );

    const installed = spawnSync("npm", ["install", "-g", "--prefix", prefix, tgz], {
      encoding: "utf8",
      timeout: 120_000,
    });
    assert.equal(installed.status, 0, `${installed.stdout}\n${installed.stderr}`);

    const aiwBin = path.join(prefix, "bin", "aiw");
    assert.equal(fs.existsSync(aiwBin), true, `missing global bin at ${aiwBin}`);
    const pkgRoot = path.join(prefix, "lib", "node_modules", "ai-workspace");
    assert.equal(fs.existsSync(path.join(pkgRoot, "src")), false);
    assert.notEqual(path.resolve(pkgRoot), path.resolve(repoRoot()));
    const locator = fs.readFileSync(path.join(pkgRoot, "dist", "agents", "index.js"), "utf8");
    assert.equal(locator.includes("process.cwd()"), false);

    const env = {
      ...process.env,
      PATH: `${path.join(prefix, "bin")}${path.delimiter}${process.env.PATH ?? ""}`,
    };
    const run = (args: string[]) =>
      spawnSync(aiwBin, args, {
        cwd: outside,
        encoding: "utf8",
        env,
      });

    const help = run(["--help"]);
    assert.equal(help.status, 0, help.stderr);
    assert.match(help.stdout, /agent create/);
    assert.match(help.stdout, /source add/);

    assert.equal(run(["init", "--name", "clean"]).status, 0);
    assert.equal(run(["status"]).status, 0);
    assert.equal(run(["validate"]).status, 0);

    const listed = run(["agent", "list"]);
    assert.equal(listed.status, 0, listed.stderr);
    assert.match(listed.stdout, /cursor/);
    assert.match(listed.stdout, /claude/);
    assert.match(listed.stdout, /codex/);

    const created = run(["agent", "create", "my-agent"]);
    assert.equal(created.status, 0, created.stderr);
    assert.equal(fs.existsSync(path.join(outside, ".ai", "agents", "my-agent.yaml")), true);
    assert.equal(fs.existsSync(path.join(os.homedir(), ".ai", "agents", "my-agent.yaml")), false);

    assert.equal(run(["agent", "add", "my-agent"]).status, 0);
    const exported = run(["export", "--agent", "my-agent"]);
    assert.equal(exported.status, 0, exported.stderr);
    assert.match(exported.stdout, /No mappings matched; nothing to export/);

    fs.mkdirSync(path.join(outside, "knowledge"), { recursive: true });
    fs.writeFileSync(path.join(outside, "knowledge", "note.md"), "hi\n");
    const sourceHelp = run(["source", "--help"]);
    assert.equal(sourceHelp.status, 0, sourceHelp.stderr);
    assert.match(sourceHelp.stdout, /source add/);
    const sourceAdd = run([
      "source",
      "add",
      "knowledge",
      "--type",
      "directory",
      "--path",
      "./knowledge",
      "--capabilities",
      "read,index",
    ]);
    assert.equal(sourceAdd.status, 0, sourceAdd.stderr);
    assert.equal(fs.existsSync(path.join(outside, ".ai", "sources")), false);
    const sourceList = run(["source", "list"]);
    assert.equal(sourceList.status, 0, sourceList.stderr);
    assert.match(sourceList.stdout, /knowledge/);
    assert.equal(run(["source", "remove", "knowledge"]).status, 0);
  } finally {
    rmTempDir(packDir);
    rmTempDir(prefix);
    rmTempDir(outside);
  }
});
