# Architecture overview

AI Workspace is a local-first Context Federation and Governance Layer. Canonical knowledge lives in `.ai/`. Resolution computes an effective snapshot from the active manifest and at most one parent. Agent Skills (`SKILL.md`) is an interoperable artifact under `.ai/skills/`, not a competing format.

This repository is a `kind: project` (single package). Multi-project workspaces use a `kind: workspace` registry and `--all`; this repo itself is not a federated workspace.

Normative documents:

- `docs/specification/`
- `docs/architecture/`
