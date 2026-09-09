import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { addSource, listSources } from "../../src/core/source.js";
import { exportAgents } from "../../src/core/export.js";
import { addAgent } from "../../src/core/agent.js";
import { resolveFrom } from "../../src/resolution/index.js";
import {
  effectiveSkillSet,
  isStandardSkillArtifact,
  parseSkillMarkdown,
  parseStandardSkillIdentity,
  skillArtifactIdentity,
  skillVersionIdentity,
  SKILL_OPERATIONS_PLANNED,
  SKILL_OPERATIONS_VIA_EXISTING_MECHANISMS,
} from "../../src/skills/index.js";
import { makeTempDir, repoRoot, rmTempDir, writeFile, writeManifest } from "../helpers.js";

const fixtures = path.join(repoRoot(), "tests", "fixtures", "agent-skills");

function copySkill(name: string, destRoot: string, destRelative = `.ai/skills/${name}`): void {
  fs.cpSync(path.join(fixtures, name), path.join(destRoot, destRelative.split("/").join(path.sep)), {
    recursive: true,
  });
}

test("standard skills/<id>/SKILL.md is valid canonical content", () => {
  const root = makeTempDir("aiw-skill-");
  try {
    writeManifest(root, "specVersion: 1\nkind: project\nname: demo\n");
    copySkill("security-review", root);
    const snapshot = resolveFrom(root);
    assert.equal(
      snapshot.resources.some((item) => item.identity === "skills/security-review/SKILL.md"),
      true,
    );
    assert.equal(isStandardSkillArtifact("skills/security-review/SKILL.md"), true);
    assert.equal(isStandardSkillArtifact("skills/notes.md"), false);
    const artifact = parseSkillMarkdown(
      fs.readFileSync(path.join(root, ".ai", "skills", "security-review", "SKILL.md"), "utf8"),
    );
    assert.equal(artifact.name, "security-review");
    assert.equal(artifact.description.includes("security"), true);
    assert.equal(artifact.version, "1.2.0");
    assert.equal(skillVersionIdentity("security-review", artifact.version), "security-review@1.2.0");
    const set = effectiveSkillSet(snapshot);
    assert.deepEqual(
      set.skills.map((skill) => skill.id),
      ["security-review"],
    );
    assert.equal(set.skills[0]?.provenance.canonical, true);
    assert.equal(set.skills[0]?.trust, "untrusted");
  } finally {
    rmTempDir(root);
  }
});

test("unknown SKILL.md frontmatter is additive and no proprietary sidecar is required", () => {
  const parsed = parseSkillMarkdown(
    [
      "---",
      "name: extra-fields",
      "description: Standard Agent Skills frontmatter plus unused keys.",
      "license: MIT",
      "compatibility: optional-agent-field",
      "---",
      "",
      "Body",
      "",
    ].join("\n"),
  );
  assert.equal(parsed.name, "extra-fields");
  assert.equal(parsed.extras["license"], "MIT");
  assert.equal(fs.existsSync(path.join(repoRoot(), "src", "skills", "manifest.ts")), false);
});

test("inheritance applies to Skills and exclude disables an inherited Skill", () => {
  const workspace = makeTempDir("aiw-skill-ws-");
  const project = path.join(workspace, "accounting");
  try {
    writeManifest(workspace, "specVersion: 1\nkind: workspace\nname: company\n");
    copySkill("security-review", workspace);
    copySkill("payments", workspace);
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
        "    exclude:",
        "      - skills/payments/SKILL.md",
        "",
      ].join("\n"),
    );
    writeFile(
      project,
      ".ai/skills/security-review/SKILL.md",
      [
        "---",
        "name: security-review",
        "description: Project override of the inherited security-review skill.",
        "---",
        "",
        "# Project security review",
        "",
      ].join("\n"),
    );

    const snapshot = resolveFrom(project);
    const set = effectiveSkillSet(snapshot);
    assert.deepEqual(
      set.skills.map((skill) => skill.id),
      ["security-review"],
    );
    assert.equal(set.skills[0]?.provenance.originName, "accounting");
    assert.equal(
      snapshot.resources.some((item) => item.identity === "skills/payments/SKILL.md"),
      false,
    );
    const security = snapshot.resources.find((item) => item.identity === "skills/security-review/SKILL.md");
    assert.equal(security?.originName, "accounting");
    assert.match(fs.readFileSync(security?.absolutePath ?? "", "utf8"), /Project override/);
  } finally {
    rmTempDir(workspace);
  }
});

test("an external Skill source can be registered without copying", () => {
  const root = makeTempDir("aiw-skill-src-");
  try {
    writeManifest(root, "specVersion: 1\nkind: project\nname: demo\n");
    const live = path.join(root, "vendor-skills", "security-review");
    fs.cpSync(path.join(fixtures, "security-review"), live, { recursive: true });
    const added = addSource(root, "security-review-src", "directory", "./vendor-skills/security-review", "read,index");
    assert.equal(added.status, "resolved");
    assert.equal(fs.existsSync(path.join(root, ".ai", "sources")), false);
    const listed = listSources(root);
    const source = listed.sources.find((item) => item.id === "security-review-src");
    assert.equal(source?.status, "resolved");
    assert.equal(
      source?.files.some((file) => file.relativePath === "SKILL.md" || file.identity.endsWith("SKILL.md")),
      true,
    );
    const snapshot = resolveFrom(root);
    assert.equal(effectiveSkillSet(snapshot).skills.length, 0);
  } finally {
    rmTempDir(root);
  }
});

test("Skill provenance is represented from the resolved snapshot", () => {
  const root = makeTempDir("aiw-skill-prov-");
  try {
    writeManifest(root, "specVersion: 1\nkind: project\nname: demo\n");
    copySkill("security-review", root);
    const snapshot = resolveFrom(root);
    const resource = snapshot.resources.find((item) => item.identity === skillArtifactIdentity("security-review"));
    assert.equal(resource?.originName, "demo");
    assert.equal(typeof resource?.hash, "string");
    assert.notEqual(resource?.hash, "");
    const set = effectiveSkillSet(snapshot);
    assert.equal(set.skills[0]?.provenance.originName, "demo");
    assert.equal(set.skills[0]?.provenance.hash, resource?.hash);
    assert.equal(parseStandardSkillIdentity(set.skills[0]?.provenance.identity ?? "")?.id, "security-review");
  } finally {
    rmTempDir(root);
  }
});

test("existing agent export remains functional with canonical Skills present", () => {
  const root = makeTempDir("aiw-skill-export-");
  try {
    writeManifest(root, "specVersion: 1\nkind: project\nname: demo\n");
    writeFile(root, ".ai/rules/security.md", "do not leak secrets\n");
    copySkill("security-review", root);
    addAgent(root, "claude");
    const result = exportAgents(root, "claude");
    assert.equal(result.ok, true);
    const native = fs.readFileSync(path.join(root, "CLAUDE.md"), "utf8");
    assert.match(native, /do not leak secrets/);
    assert.match(native, /security-review/);
  } finally {
    rmTempDir(root);
  }
});

test("Skill scripts are not executed when deriving the effective set", () => {
  const root = makeTempDir("aiw-skill-noexec-");
  try {
    writeManifest(root, "specVersion: 1\nkind: project\nname: demo\n");
    copySkill("security-review", root);
    const script = path.join(root, ".ai", "skills", "security-review", "scripts", "scan.sh");
    const before = fs.readFileSync(script);
    const stamp = path.join(root, "script-ran.marker");
    assert.equal(fs.existsSync(stamp), false);
    const set = effectiveSkillSet(resolveFrom(root));
    assert.equal(set.skills.length, 1);
    assert.equal(fs.existsSync(stamp), false);
    assert.deepEqual(fs.readFileSync(script), before);
  } finally {
    rmTempDir(root);
  }
});

test("dedicated Skill lifecycle CLI is not implied by the Phase 7A model", () => {
  assert.deepEqual([...SKILL_OPERATIONS_PLANNED], ["discover", "trust"]);
  assert.equal(SKILL_OPERATIONS_VIA_EXISTING_MECHANISMS.includes("export"), true);
  assert.equal(SKILL_OPERATIONS_VIA_EXISTING_MECHANISMS.includes("register"), true);
  assert.equal(fs.existsSync(path.join(repoRoot(), "src", "cli", "skill.ts")), false);
});
