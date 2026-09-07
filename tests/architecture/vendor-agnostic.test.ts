import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { repoRoot } from "../helpers.js";

const forbidden = [
  /\bif\s*\([^)]*(cursor|claude|codex|graphify|spec-kit|speckit)/i,
  /\b(agent|id|name)\s*===\s*['"](cursor|claude|codex|graphify)['"]/i,
];

const forbiddenTokens = [
  "cursor",
  "claude",
  "codex",
  "graphify",
  "spec-kit",
  "speckit",
  ".cursor",
  "AGENTS.md",
  "CLAUDE.md",
];

const scannedRoots = ["core", "manifest", "resolution", "filesystem", "config", "agents", "adapters", "sources"];

test("core modules do not contain vendor-specific branching or names", () => {
  const srcRoot = path.join(repoRoot(), "src");
  const hits: string[] = [];

  for (const dir of scannedRoots) {
    const abs = path.join(srcRoot, dir);
    for (const file of walkTs(abs)) {
      const text = fs.readFileSync(file, "utf8");
      const rel = path.relative(srcRoot, file).split(path.sep).join("/");
      for (const pattern of forbidden) {
        if (pattern.test(text)) {
          hits.push(`${rel}: matches ${pattern}`);
        }
      }
      const lower = text.toLowerCase();
      for (const token of forbiddenTokens) {
        if (lower.includes(token.toLowerCase())) {
          hits.push(`${rel}: contains '${token}'`);
        }
      }
    }
  }

  assert.deepEqual(hits, []);
});

test("no vendor-named or custom-agent TypeScript implementations exist", () => {
  const srcRoot = path.join(repoRoot(), "src");
  for (const name of ["cursor", "claude", "codex", "graphify", "spec-kit", "speckit", "test-agent", "my-agent"]) {
    assert.equal(fs.existsSync(path.join(srcRoot, "adapters", `${name}.ts`)), false);
    assert.equal(fs.existsSync(path.join(srcRoot, "agents", `${name}.ts`)), false);
    assert.equal(fs.existsSync(path.join(srcRoot, "sources", `${name}.ts`)), false);
  }
});

test("bundled definition locator does not depend on process.cwd()", () => {
  const text = fs.readFileSync(path.join(repoRoot(), "src", "agents", "index.ts"), "utf8");
  assert.equal(text.includes("process.cwd()"), false);
});

function walkTs(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkTs(abs));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      results.push(abs);
    }
  }
  return results;
}
