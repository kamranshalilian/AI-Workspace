import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { repoRoot } from "../helpers.js";

const vendorIds = [
  "cursor",
  "claude",
  "codex",
  "copilot",
  "gemini",
  "windsurf",
  "cline",
  "roo",
  "graphify",
  "spec-kit",
  "speckit",
];

const vendorAlternation = vendorIds.map(escapeRegExp).join("|");

const forbidden = [
  new RegExp(String.raw`\bif\s*\([^)]*\b(?:${vendorAlternation})\b`, "i"),
  new RegExp(String.raw`\b(?:agent|id|name)\s*===?\s*['"](?:${vendorAlternation})['"]`, "i"),
  new RegExp(String.raw`\bswitch\s*\([^)]*\b(?:${vendorAlternation})\b`, "i"),
];

const forbiddenTokens = [
  "cursor",
  "claude",
  "codex",
  "copilot",
  "gemini",
  "windsurf",
  "cline",
  "graphify",
  "spec-kit",
  "speckit",
  ".cursor",
  "AGENTS.md",
  "CLAUDE.md",
];

/** Short tokens must use word boundaries (`roo` must not match `root`). */
const forbiddenBoundedTokens = ["roo"];

const scannedRoots = [
  "core",
  "manifest",
  "resolution",
  "filesystem",
  "config",
  "agents",
  "adapters",
  "sources",
  "state",
  "projects",
  "skills",
];

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
      for (const token of forbiddenBoundedTokens) {
        if (new RegExp(String.raw`\b${escapeRegExp(token)}\b`, "i").test(text)) {
          hits.push(`${rel}: contains bounded '${token}'`);
        }
      }
    }
  }

  assert.deepEqual(hits, []);
});

test("no vendor-named or custom-agent TypeScript implementations exist", () => {
  const srcRoot = path.join(repoRoot(), "src");
  for (const name of [
    "cursor",
    "claude",
    "codex",
    "copilot",
    "gemini",
    "windsurf",
    "cline",
    "roo",
    "graphify",
    "spec-kit",
    "speckit",
    "test-agent",
    "my-agent",
  ]) {
    assert.equal(fs.existsSync(path.join(srcRoot, "adapters", `${name}.ts`)), false);
    assert.equal(fs.existsSync(path.join(srcRoot, "agents", `${name}.ts`)), false);
    assert.equal(fs.existsSync(path.join(srcRoot, "sources", `${name}.ts`)), false);
    assert.equal(fs.existsSync(path.join(srcRoot, "skills", `${name}.ts`)), false);
  }
});

test("bundled definition locator does not depend on process.cwd()", () => {
  const text = fs.readFileSync(path.join(repoRoot(), "src", "agents", "index.ts"), "utf8");
  assert.equal(text.includes("process.cwd()"), false);
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
