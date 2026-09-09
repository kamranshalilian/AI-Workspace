# Phase plan

Implementation follows this sequence. A later phase must not be started as production code until the previous phase's acceptance tests pass, unless a documented exception is approved.

## Phase 0 — Specification (complete)

Delivered as documents under `docs/specification/` and `docs/architecture/`.

Approved 2026-09-07.

## Phase 1 — Core

Implement:

- `.ai/` + `manifest.yaml`
- parse/validate
- filesystem helpers
- scope discovery
- resolution (including extend/replace/disable against fixtures)
- security exclusions
- CLI: `init`, `status`, `doctor`, `validate`

Not in Phase 1: agents export, sources CLI, `--all`, import/sync.

## Phase 2 — Agent adapters

- definition loader + bundled YAML (if approved)
- declarative adapter engine
- format engines
- CLI agent add/remove/list/status + export
- first *reference* definition: Cursor-shaped rules mapping

Cursor is the first definition, not a core subsystem.

Phase 2 implemented the generic adapter engine, four format engines, bundled YAML definitions, agent CLI, and export.

## Phase 3 — User-defined agents

- `aiw agent create`
- documented stub definition
- tests that a new id works without new TypeScript

Phase 3 implemented `aiw agent create`, empty-mapping stubs, ID safety, local shadowing of bundled definitions, and global-install packaging tests.

## Phase 4 — Sources

- generic source model
- CLI source add/list/remove
- prove with Graphify-shaped and spec-kit-shaped **fixtures** (directories), not special parsers

Phase 4 implemented generic directory/file/repository/generated sources, capability enforcement, inventory with security exclusions, and `aiw source add|list|remove`. Graphify and spec-kit appear only as test fixtures.

## Phase 5 — Synchronization

- import (non-destructive Source → `.ai/sources/<id>/`)
- promote (explicit native → canonical, reversible mappings only)
- export already exists; sync classifies four-state change
- `sync` report-only by default; `--apply` writes one-sided non-conflict updates only

Phase 5 implemented generic import, promote, deterministic state identity in `.ai/state/sync.yaml`, and conflict detection. Graphify and spec-kit remain fixtures.

## Phase 6 — Workspace federation

- `projects:` registry CLI (`aiw project add|list|remove`)
- `--all` for status, validate, doctor, export, and sync
- registry-driven isolation; inheritance remains the Phase 1 resolver

Phase 6 implemented workspace federation. `aiw agent enable|disable` was listed in the original phase sketch and is **not** implemented.

## Phase 7A — Strategic repositioning (architecture gate)

Documentation, types, fixtures, and architecture tests only.

- Agent Skills is an external artifact standard (`SKILL.md`)
- `.ai/skills/` is the canonical collection, not a competing format
- Effective Skill Set is derived from existing resolution
- No Skill CLI, marketplace, sandbox, or Skill registry persistence

See [agent-skills.md](agent-skills.md), [skill-lifecycle.md](../concepts/skill-lifecycle.md), [positioning.md](../strategy/positioning.md), and [specification 10](../specification/10-agent-skills.md).

## Phase 7B — Skill registry (this gate)

Optional `skills:` map on `manifest.yaml`. Interpretation is library-level (`skillRegistry`). No Skill CLI, no copy, no execution, no version resolver.

See [skill-registry.md](../concepts/skill-registry.md).

## Phase 7 — later implementation (not started)

Only after 7A is approved. Suggested order; each step needs its own approval:

1. **7C** — persist trust/policy without executing scripts
2. **7D** — explicit import/promote of standard Skill trees from sources (reuse Phase 5; no auto-copy)
3. **7E** — version pin/compare only if a later gate proves it is required (still no installer)
4. **7F** — dependency *model* validation (still no installer)

Still out of scope: marketplace, cloud registry, MCP, embeddings, LLM merge, Skill VM, vendor Skill engines.

## Phase 8

Not started. Do not begin Phase 8 from this gate.
