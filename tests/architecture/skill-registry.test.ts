import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { parseAndValidateManifest } from "../../src/manifest/index.js";
import { resolveFrom } from "../../src/resolution/index.js";
import {
  assertValidSkillId,
  effectiveSkillSet,
  isValidSkillId,
  skillRegistry,
  skillVersionIdentity,
} from "../../src/skills/index.js";
import { makeTempDir, repoRoot, rmTempDir, writeFile, writeManifest } from "../helpers.js";

const fixtures = path.join(repoRoot(), "tests", "fixtures", "agent-skills");

function copySkill(name: string, destRoot: string, destRelative = `.ai/skills/${name}`): void {
  fs.cpSync(path.join(fixtures, name), path.join(destRoot, destRelative.split("/").join(path.sep)), {
    recursive: true,
  });
}

function writeCodeReview(root: string, extraFrontmatter = ""): void {
  writeFile(
    root,
    ".ai/skills/code-review/SKILL.md",
    [
      "---",
      "name: code-review",
      "description: Review code for defects.",
      extraFrontmatter,
      "---",
      "",
      "# Code review",
      "",
    ].join("\n"),
  );
}

test("A — registry entry plus SKILL.md resolves", () => {
  const root = makeTempDir("aiw-reg-a-");
  try {
    writeManifest(
      root,
      [
        "specVersion: 1",
        "kind: project",
        "name: demo",
        "skills:",
        "  code-review: {}",
        "",
      ].join("\n"),
    );
    writeCodeReview(root);
    const snapshot = resolveFrom(root);
    assert.equal(snapshot.skills.length, 1);
    assert.equal(snapshot.skills[0]?.id, "code-review");
    assert.equal(snapshot.skills[0]?.enabled, true);
    const registry = skillRegistry(snapshot);
    assert.equal(registry.entries.length, 1);
    assert.equal(registry.entries[0]?.status, "resolved");
    assert.equal(registry.entries[0]?.artifactName, "code-review");
    assert.deepEqual(
      effectiveSkillSet(snapshot).skills.map((skill) => skill.id),
      ["code-review"],
    );
  } finally {
    rmTempDir(root);
  }
});

test("B — missing artifact is missing and does not crash siblings", () => {
  const root = makeTempDir("aiw-reg-b-");
  try {
    writeManifest(
      root,
      [
        "specVersion: 1",
        "kind: project",
        "name: demo",
        "skills:",
        "  code-review: {}",
        "  absent-skill: {}",
        "",
      ].join("\n"),
    );
    writeCodeReview(root);
    const registry = skillRegistry(resolveFrom(root));
    const byId = Object.fromEntries(registry.entries.map((entry) => [entry.id, entry.status]));
    assert.equal(byId["code-review"], "resolved");
    assert.equal(byId["absent-skill"], "missing");
  } finally {
    rmTempDir(root);
  }
});

test("C — invalid SKILL.md is invalid and is not executed", () => {
  const root = makeTempDir("aiw-reg-c-");
  try {
    writeManifest(
      root,
      [
        "specVersion: 1",
        "kind: project",
        "name: demo",
        "skills:",
        "  code-review: {}",
        "  broken: {}",
        "",
      ].join("\n"),
    );
    writeCodeReview(root);
    writeFile(root, ".ai/skills/broken/SKILL.md", "not a skill\n");
    writeFile(root, ".ai/skills/broken/scripts/boom.sh", "echo ran > ../../script-ran.marker\n");
    const snapshot = resolveFrom(root);
    const registry = skillRegistry(snapshot);
    const broken = registry.entries.find((entry) => entry.id === "broken");
    const ok = registry.entries.find((entry) => entry.id === "code-review");
    assert.equal(ok?.status, "resolved");
    assert.equal(broken?.status, "invalid");
    assert.equal(effectiveSkillSet(snapshot).skills.map((skill) => skill.id).join(","), "code-review");
    assert.equal(fs.existsSync(path.join(root, "script-ran.marker")), false);
  } finally {
    rmTempDir(root);
  }
});

test("D — disabled registry entry is omitted from the Effective Skill Set", () => {
  const root = makeTempDir("aiw-reg-d-");
  try {
    writeManifest(
      root,
      [
        "specVersion: 1",
        "kind: project",
        "name: demo",
        "skills:",
        "  code-review:",
        "    enabled: false",
        "",
      ].join("\n"),
    );
    writeCodeReview(root);
    const snapshot = resolveFrom(root);
    assert.equal(skillRegistry(snapshot).entries[0]?.status, "disabled");
    assert.deepEqual(effectiveSkillSet(snapshot).skills, []);
    assert.equal(
      snapshot.resources.some((item) => item.identity === "skills/code-review/SKILL.md"),
      true,
    );
  } finally {
    rmTempDir(root);
  }
});

test("E — workspace Skill registry entry is inherited", () => {
  const workspace = makeTempDir("aiw-reg-e-");
  const project = path.join(workspace, "accounting");
  try {
    writeManifest(
      workspace,
      [
        "specVersion: 1",
        "kind: workspace",
        "name: company",
        "skills:",
        "  code-review: {}",
        "",
      ].join("\n"),
    );
    writeCodeReview(workspace);
    fs.mkdirSync(project, { recursive: true });
    writeManifest(
      project,
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
    const snapshot = resolveFrom(project);
    const entry = skillRegistry(snapshot).entries[0];
    assert.equal(entry?.id, "code-review");
    assert.equal(entry?.status, "resolved");
    assert.equal(entry?.originKind, "inherited");
    assert.equal(entry?.originName, "company");
    assert.equal(effectiveSkillSet(snapshot).skills[0]?.provenance.kind, "inherited");
  } finally {
    rmTempDir(workspace);
  }
});

test("F — project can disable an inherited Skill via registry child-wins", () => {
  const workspace = makeTempDir("aiw-reg-f-");
  const project = path.join(workspace, "accounting");
  try {
    writeManifest(
      workspace,
      [
        "specVersion: 1",
        "kind: workspace",
        "name: company",
        "skills:",
        "  code-review: {}",
        "",
      ].join("\n"),
    );
    writeCodeReview(workspace);
    fs.mkdirSync(project, { recursive: true });
    writeManifest(
      project,
      [
        "specVersion: 1",
        "kind: project",
        "name: accounting",
        "extends:",
        "  - path: ../.ai",
        "    mode: extend",
        "skills:",
        "  code-review:",
        "    enabled: false",
        "",
      ].join("\n"),
    );
    const snapshot = resolveFrom(project);
    assert.equal(skillRegistry(snapshot).entries[0]?.status, "disabled");
    assert.equal(skillRegistry(snapshot).entries[0]?.originName, "accounting");
    assert.deepEqual(effectiveSkillSet(snapshot).skills, []);
  } finally {
    rmTempDir(workspace);
  }
});

test("G — federated Skill is not copied into .ai/skills", () => {
  const root = makeTempDir("aiw-reg-g-");
  try {
    const live = path.join(root, "vendor-skills", "code-review");
    fs.mkdirSync(live, { recursive: true });
    fs.copyFileSync(path.join(fixtures, "payments", "SKILL.md"), path.join(live, "SKILL.md"));
    writeManifest(
      root,
      [
        "specVersion: 1",
        "kind: project",
        "name: demo",
        "sources:",
        "  vendor-code-review:",
        "    type: directory",
        "    path: ./vendor-skills/code-review",
        "    capabilities:",
        "      - read",
        "      - index",
        "skills:",
        "  code-review:",
        "    source: vendor-code-review",
        "",
      ].join("\n"),
    );
    const snapshot = resolveFrom(root);
    const registry = skillRegistry(snapshot);
    assert.equal(registry.entries[0]?.status, "resolved");
    assert.equal(registry.entries[0]?.originKind, "external");
    assert.equal(registry.entries[0]?.source.type, "federated");
    assert.deepEqual(effectiveSkillSet(snapshot).skills, []);
    assert.equal(fs.existsSync(path.join(root, ".ai", "skills")), false);
  } finally {
    rmTempDir(root);
  }
});

test("H — Effective Skill provenance is deterministic", () => {
  const root = makeTempDir("aiw-reg-h-");
  try {
    writeManifest(
      root,
      "specVersion: 1\nkind: project\nname: demo\nskills:\n  code-review: {}\n",
    );
    writeCodeReview(root, "metadata:\n  version: 1.2.0");
    const snapshot = resolveFrom(root);
    const skill = effectiveSkillSet(snapshot).skills[0];
    const entry = skillRegistry(snapshot).entries[0];
    assert.equal(skill?.provenance.originName, "demo");
    assert.equal(skill?.provenance.kind, "canonical");
    assert.equal(typeof skill?.provenance.hash, "string");
    assert.notEqual(skill?.provenance.hash, "");
    assert.equal(entry?.provenance?.hash, skill?.provenance.hash);
  } finally {
    rmTempDir(root);
  }
});

test("I — version identity is id@version only when the artifact has a version", () => {
  const root = makeTempDir("aiw-reg-i-");
  try {
    writeManifest(
      root,
      [
        "specVersion: 1",
        "kind: project",
        "name: demo",
        "skills:",
        "  code-review: {}",
        "  payments: {}",
        "",
      ].join("\n"),
    );
    writeCodeReview(root, "metadata:\n  version: 1.2.0");
    copySkill("payments", root);
    const registry = skillRegistry(resolveFrom(root));
    const review = registry.entries.find((entry) => entry.id === "code-review");
    const payments = registry.entries.find((entry) => entry.id === "payments");
    assert.equal(review?.versionIdentity, "code-review@1.2.0");
    assert.equal(skillVersionIdentity("code-review", review?.version), "code-review@1.2.0");
    assert.equal(payments?.version, undefined);
    assert.equal(payments?.versionIdentity, "payments");
  } finally {
    rmTempDir(root);
  }
});

test("J — registry interpretation does not execute Skill scripts", () => {
  const root = makeTempDir("aiw-reg-j-");
  try {
    writeManifest(
      root,
      "specVersion: 1\nkind: project\nname: demo\nskills:\n  security-review: {}\n",
    );
    copySkill("security-review", root);
    const stamp = path.join(root, "script-ran.marker");
    const script = path.join(root, ".ai", "skills", "security-review", "scripts", "scan.sh");
    const before = fs.readFileSync(script);
    skillRegistry(resolveFrom(root));
    assert.equal(fs.existsSync(stamp), false);
    assert.deepEqual(fs.readFileSync(script), before);
  } finally {
    rmTempDir(root);
  }
});

test("K — registry resolution is deterministic", () => {
  const root = makeTempDir("aiw-reg-k-");
  try {
    writeManifest(
      root,
      [
        "specVersion: 1",
        "kind: project",
        "name: demo",
        "skills:",
        "  payments: {}",
        "  code-review: {}",
        "",
      ].join("\n"),
    );
    writeCodeReview(root);
    copySkill("payments", root);
    const first = JSON.stringify(skillRegistry(resolveFrom(root)));
    const second = JSON.stringify(skillRegistry(resolveFrom(root)));
    assert.equal(first, second);
    assert.deepEqual(
      skillRegistry(resolveFrom(root)).entries.map((entry) => entry.id),
      ["code-review", "payments"],
    );
  } finally {
    rmTempDir(root);
  }
});

test("registry metadata is not a replacement for SKILL.md", () => {
  const withBody = parseAndValidateManifest(
    [
      "specVersion: 1",
      "kind: project",
      "name: demo",
      "skills:",
      "  code-review:",
      "    description: duplicated body",
      "",
    ].join("\n"),
  );
  assert.equal(withBody.ok, false);
  assert.equal(fs.existsSync(path.join(repoRoot(), "src", "skills", "manifest.ts")), false);
  assert.equal(fs.existsSync(path.join(repoRoot(), ".ai", "skills-registry.yaml")), false);
});

test("Skill ids reject path traversal and unsafe forms", () => {
  for (const id of ["../evil", "../../foo", "/foo", "C:\\foo", "..", ".", "foo/bar"]) {
    assert.equal(isValidSkillId(id), false, id);
    assert.throws(() => assertValidSkillId(id));
  }
  assert.equal(isValidSkillId("code-review"), true);
  const result = parseAndValidateManifest(
    "specVersion: 1\nkind: project\nname: demo\nskills:\n  ../evil: {}\n",
  );
  assert.equal(result.ok, false);
});
