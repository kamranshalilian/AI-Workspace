# Skill lifecycle

**Status:** Phase 7A model. Dedicated Skill CLI is **not** implemented.

The conceptual lifecycle is:

```text
discover → register → validate → trust → install/import → enable → export/project → update → disable → remove
```

AI Workspace does not execute Skills as a runtime. Lifecycle here means governance of artifacts that happen to be Agent Skills.

## Operations

| Operation | Meaning | Phase 7A |
| --- | --- | --- |
| **discover** | Find candidate Skill trees (canonical, source, or later indexes) | **Planned.** No automatic filesystem discovery. Resolution only sees files already under included kinds or registered sources. |
| **register** | Record a Skill in the workspace/project catalog | **Phase 7B.** Optional `skills:` map in `manifest.yaml`. No `aiw skill add`. |
| **validate** | Confirm the artifact is parseable Agent Skills content (`name`, `description`) without executing it | **Library.** `parseSkillMarkdown` / registry status `invalid`. No `aiw skill validate`. |
| **trust** | Assign `untrusted` / `reviewed` / `trusted` and later script/network policy | **Planned.** Derived records default to `untrusted`. No policy engine, no sandbox. |
| **enable** | Include the Skill in the Effective Skill Set | Canonical `SKILL.md` that survives resolution, unless registry `enabled: false`. |
| **disable** | Keep a Skill out of the Effective Skill Set | Registry `enabled: false`, `exclude` of the resource identity, or `mode: disable`. |
| **import** | Snapshot an external Skill source without making it canonical | **Existing mechanism.** `aiw import --source <id>` writes `.ai/sources/<id>/`. It does not install into `.ai/skills/`. |
| **project / export** | Materialize Skill content into native agent files | **Existing mechanism.** `aiw export` uses declarative adapters. No Skill-specific exporter. |
| **update** | Refresh canonical or imported bytes | **Existing mechanism.** Edit `.ai/skills/…` or re-import / `sync`. No automatic live-source overwrite. |
| **remove** | Drop a Skill from the collection or catalog | **Existing mechanism** for files (delete the tree). Catalog removal is planned with register. |

`install` in the product sense (dependency installation) is **not** approved. Dependency *types* exist so graphs such as `wallet-development → evm, security-review, postgres` can be represented later. Phase 7A always records `dependencies: []`.

## Implemented vs planned (summary)

**Represented (types + parse + registry + Effective Skill Set):**

```text
register (manifest skills:)
validate (parse / registry status)
enable / disable (resolution + registry enabled)
import / export / update / remove (via existing generic commands)
provenance (via resolved resources)
trust default (untrusted)
```

**Planned; do not treat as shipped:**

```text
discover
trust assignment and policy enforcement
dependency installation
Skill-specific CLI
marketplace / cloud registry
```

## Enable / disable with inheritance

Skills participate in the existing inheritance model. They are resources whose identity is `skills/<id>/SKILL.md`.

```text
Workspace
    ├── Skill A   (skills/a/SKILL.md)
    └── Skill B   (skills/b/SKILL.md)
            ▼
Project
    ├── Skill C
    └── exclude: skills/b/SKILL.md
            ▼
Effective Skill Set
    ├── A
    └── C
```

Same identity: child wins. `mode: replace` drops parent knowledge. `mode: disable` inherits nothing.

## Trust and execution

Presence in the lifecycle never implies execution.

| Allowed in Phase 7A | Forbidden |
| --- | --- |
| Store `scripts/` as files | Run those scripts |
| Default trust `untrusted` | Promote trust because frontmatter says so |
| Refuse executable adapters (existing) | Skill sandbox, network allowlists |

## Determinism

No LLM-based composition or merge in Core. Effective Skill Set order is POSIX identity of Skill ids. Invalid `SKILL.md` fails parse for that artifact; Core does not rewrite the file.
