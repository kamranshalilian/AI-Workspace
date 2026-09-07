# Architecture overview

AI Workspace is a local-first context layer. Canonical knowledge lives in `.ai/`. Resolution computes an effective snapshot from the active manifest and at most one parent.

This repository is a `kind: project` (single package). Multi-project workspaces are specified and resolved in core, and will get CLI `--all` management in Phase 6.

Normative documents:

- `docs/specification/`
- `docs/architecture/`
