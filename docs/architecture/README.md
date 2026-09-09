# Architecture

**Status:** Phase 6 implemented. Phase 7A is the Agent Skills architecture gate. Phase 7B adds an optional Skill registry on the manifest.

| Document | Contents |
| --- | --- |
| [System architecture](system.md) | Layers, boundaries, data flow |
| [Agent Skills](agent-skills.md) | Interoperability with `SKILL.md`; canonical `.ai/skills/` |
| [Repository structure](repository.md) | Target tree and module ownership |
| [Phase plan](phase-plan.md) | What lands when |
| [Phase 0 review](phase-0-review.md) | Required review: state, decisions, schema, CLI, tests, plan |
| [Open decisions](open-decisions.md) | Items that need explicit approval |
| [Skill lifecycle](../concepts/skill-lifecycle.md) | Discover…remove; implemented vs planned |
| [Skill registry](../concepts/skill-registry.md) | Manifest `skills:` metadata vs `SKILL.md` |
| [Positioning](../strategy/positioning.md) | Governance layer vs Agent Skills artifact |

## Module boundaries (non-negotiable)

Keep these separate:

```text
Core
Manifest
Resolution
Filesystem
Agent (definition loading, not vendor logic)
Adapter (generic engine)
Source
Skills (Agent Skills parse + Effective Skill Set; not a vendor runtime)
CLI
Config
```

CLI may call core. Core must not import CLI.

Adapters must not import CLI.

Sources must not import adapters.

No module in `src/core` may import a symbol named after a vendor.
