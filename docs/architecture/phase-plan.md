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

## Phase 3 — User-defined agents

- `aiw agent create`
- documented stub definition
- tests that a new id works without new TypeScript

## Phase 4 — Sources

- generic source model
- CLI source add/list/remove
- prove with Graphify-shaped and spec-kit-shaped **fixtures** (directories), not special parsers

## Phase 5 — Synchronization

- import (non-destructive)
- export already exists; add conflict classification
- `sync` report-only
- optional `--promote` with explicit conversion

## Phase 6 — Workspace federation

- `projects:` registry CLI
- `--all` commands
- `agent enable/disable --all`
- inheritance remains the Phase 1 resolver; this phase is management UX

## Phase 7 — Ecosystem (only if justified)

Adapter/source registries, templates, community integrations.

Not planned until v1 of Phases 1–6 is real.
