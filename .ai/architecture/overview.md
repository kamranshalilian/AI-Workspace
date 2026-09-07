# Architecture overview

AI Workspace is a local-first context layer. Canonical knowledge lives in `.ai/`. Resolution computes an effective snapshot from the active manifest and at most one parent.

This repository is a `kind: project` (single package). Multi-project workspaces use a `kind: workspace` registry and `--all`; this repo itself is not a federated workspace.

Normative documents:

- `docs/specification/`
- `docs/architecture/`
