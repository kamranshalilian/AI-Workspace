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

## Phase 7 — Ecosystem (only if justified)

Adapter/source registries, templates, community integrations.

Not planned until v1 of Phases 1–6 is real.
