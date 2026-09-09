# Agent Skills relationship

This section is additive. It does not replace earlier specification documents.

**AI Workspace does not compete with the Agent Skills format. Agent Skills is treated as an interoperable artifact standard where applicable.**

AI Workspace does not redefine `SKILL.md`, `name`, or `description`. It does not introduce a required proprietary Skill manifest.

## Layers

```text
Agent Skills specification     →  artifact contract
Skill artifact                 →  SKILL.md (+ optional scripts/references/assets)
AI Workspace                   →  canonical collection, inheritance, federation, governance
Agent adapter                  →  native projection (declarative YAML)
```

Vendor Skill runtimes are out of Core. Definitions may name vendors as data. TypeScript must not branch on vendor ids for Skill semantics.

## Canonical collection

`.ai/skills/` is AI Workspace’s canonical Skill collection.

Standard artifact identity:

```text
skills/<skill-id>/SKILL.md
```

`<skill-id>` follows the same portable id rules as agent ids: `^[a-z0-9][a-z0-9._-]*$`, max 64 characters, no `/`.

Optional Agent Skills directories may exist beside `SKILL.md`. They are files, not executables.

Flat markdown under `skills/` remains valid canonical knowledge and is **not** an Agent Skills artifact.

## Effective Skill Set

The Effective Skill Set is the subset of the resolved snapshot whose identities are standard Agent Skills artifacts, after `extend` / `replace` / `disable` / `exclude`.

It is derived deterministically. It is not a Skill execution runtime.

External sources may contain `SKILL.md`. Those files are not in the Effective Skill Set until they exist as canonical resources (explicit import/promote, not registration).

The optional manifest `skills:` map is registry metadata. `enabled: false` removes a Skill from the Effective Skill Set. Unregistered canonical `SKILL.md` files remain effective. See [Skill registry](../concepts/skill-registry.md).

## Metadata

Parse requires Agent Skills `name` and `description`. Unknown frontmatter is preserved and ignored for behavior.

If a version string is present (`metadata.version` or `version`), Core may surface it. Version identity, when shown, is `id@version` using that string. This is not a new versioning standard.

Trust, registry status, and dependencies are AI Workspace governance fields. They are not a replacement Skill format. Spec v1 may include an optional `skills:` map on the manifest as **registry metadata** (enabled flag and optional federated `source` id). That map must not store Skill body, `name`, or `description`.

## Security

Core must not execute Skill scripts, references, or implied tools. See [Security](08-security.md).

## Sync

Phase 5 rules apply to Skill files like any other resource or source snapshot. No silent overwrite. No automatic semantic merge. No LLM merge.
