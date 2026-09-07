# Architecture

**Status:** Phase 0 approved. Phase 1 core is implemented.

| Document | Contents |
| --- | --- |
| [System architecture](system.md) | Layers, boundaries, data flow |
| [Repository structure](repository.md) | Target tree and module ownership |
| [Phase plan](phase-plan.md) | What lands when |
| [Phase 0 review](phase-0-review.md) | Required review: state, decisions, schema, CLI, tests, plan |
| [Open decisions](open-decisions.md) | Items that need explicit approval |

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
CLI
Config
```

CLI may call core. Core must not import CLI.

Adapters must not import CLI.

Sources must not import adapters.

No module in `src/core` may import a symbol named after a vendor.
