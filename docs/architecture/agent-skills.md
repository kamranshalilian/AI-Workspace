# AI Workspace and Agent Skills

**Status:** Phase 7A architecture gate.

AI Workspace does not compete with or replace Agent Skills. Agent Skills is an external interoperability format. AI Workspace is a local-first management, federation, and governance layer that can consume, catalog, inherit, and project those artifacts.

```text
Agent Skills specification
        ↓
Skill artifact (SKILL.md)

AI Workspace
        ↓
Skill lifecycle / federation / governance

Agent adapter
        ↓
Native agent integration
```

These layers stay separate. Core must not encode Skill semantics as vendor branches.

## Relationship

| Layer | Owns | Must not own |
| --- | --- | --- |
| Agent Skills | Artifact shape: `name`, `description`, `SKILL.md`, optional `scripts/`, `references/`, `assets/` | Workspace inheritance, registries, sync policy |
| AI Workspace | Canonical `.ai/`, resolution, sources, provenance, trust *model*, Effective Skill Set | A forked Skill format |
| Agent adapter | Projection into native files via declarative YAML | Skill parsing or vendor `if` branches in Core |

Product statement:

> AI Workspace is a local-first Context Federation and Governance Layer for AI agents. It provides a canonical workspace model for context, rules, skills, architecture, decisions and external sources, while interoperating with open agent standards such as Agent Skills rather than replacing them.

## Canonical `.ai/skills/`

`.ai/` remains the canonical AI Workspace representation. `.ai/skills/` is the canonical **collection**, not a competing format.

Preferred representation, aligned with Agent Skills:

```text
.ai/skills/<skill-name>/
├── SKILL.md
├── scripts/        # optional; never executed by Core
├── references/     # optional
└── assets/         # optional
```

Resource identity for the standard artifact is POSIX:

```text
skills/<skill-name>/SKILL.md
```

Flat files such as `.ai/skills/notes.md` remain ordinary canonical resources. They are not treated as Agent Skills artifacts.

Do not introduce an AI Workspace Skill Manifest as a replacement for `SKILL.md`. Additional metadata, if required later, must be additive and non-destructive (for example unused frontmatter keys, or a future registry entry that points at the artifact).

## `SKILL.md`

AI Workspace parses the public Agent Skills frontmatter contract:

- required: `name`, `description`
- unknown keys: retained as extras; not interpreted as vendor logic
- optional version: read from `metadata.version` or top-level `version` when present (semver strings, not a new version format)

Core does not redefine those fields. Core does not execute `scripts/` because a Skill declares them.

## Interoperability

A Skill is valid in AI Workspace when it is valid Agent Skills content stored under the canonical collection, or when it is referenced as an external source without being copied.

Projection to agents uses the existing generic adapter path:

```text
Effective Context
        │
        ├── Agent Skills artifacts (SKILL.md and other canonical markdown)
        └── Other formats / adapters
                │
        Cursor / Claude / Codex / other agents (YAML definitions)
```

Export does not grow a Skill-specific engine. Concatenated adapters already consume `**/*.md`, which includes `SKILL.md`. Vendor-specific Skill runtimes stay outside Core.

## Provenance

Every resolved Skill artifact reuses the existing resource provenance:

| Question | Answered by |
| --- | --- |
| Where did this Skill come from? | `originRoot` / `originName` |
| What identity is it? | POSIX `skills/<id>/SKILL.md` |
| What version is it? | optional Agent Skills version string; identity helper `id@version` when known |
| Was it modified? | content `hash` vs last-known sync state (Phase 5) |
| Is it trusted? | Skill trust model (default `untrusted` in Phase 7A; not a sandbox) |
| Is it canonical or projected? | canonical `.ai/` vs adapter output outside `.ai/` |

## Skill registry

Optional `skills:` on `manifest.yaml` is management metadata. It points at a canonical package or a federated source. It does not store Skill body, `name`, or `description`. See [Skill registry](../concepts/skill-registry.md).

## Source federation

A Skill may originate from a generic source (`directory`, `file`, `repository`, `generated`).

```text
source add  →  reference only
import      →  snapshot under .ai/sources/<id>/  (explicit)
promote     →  canonical .ai/skills/…            (explicit, later Skill-aware use)
```

Do not copy a live Skill tree merely because it is registered. Phase 5 conflict rules remain authoritative: no silent overwrite, no automatic semantic merge, no LLM conflict resolution.

## Effective Skill Set

The Effective Skill Set is a deterministic view over the already-resolved snapshot:

```text
workspace skills
+ project skills
+ inherited skills
+ enable/disable/exclude policy
        ↓
Effective Skill Set
```

Inheritance semantics are unchanged: `extend`, `replace`, `disable`, `exclude`. Child identity wins. This is not a runtime Skill executor.

Registered external sources are **not** members of the Effective Skill Set until their artifacts exist as canonical resources.

## Security boundary

Agent Skills may contain executable scripts and references. AI Workspace must be able to *express* trust and policy. Phase 7A records the model only:

```text
trust:     untrusted | reviewed | trusted
policy:    allow/deny scripts, allow/deny network   (not enforced yet)
```

Defaults:

- do not execute a Skill because it is present
- do not execute `scripts/` during parse, resolve, export, import, or Effective Skill Set derivation
- do not implement a sandbox in Phase 7A
- executable adapters/sources remain forbidden in spec v1

See [Skill lifecycle](../concepts/skill-lifecycle.md) and [positioning](../strategy/positioning.md).
