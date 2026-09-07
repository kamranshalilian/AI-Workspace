# CLI documentation

**Status:** Phase 1 implemented: `init`, `status`, `validate`, `doctor`.

The normative contract is [docs/specification/07-cli.md](../specification/07-cli.md).

## Phase 1 commands

```bash
aiw init [--kind project|workspace] [--name <name>] [--path <dir>] [--force]
aiw status [--path <dir>] [--json]
aiw validate [--path <dir>] [--json]
aiw doctor [--path <dir>] [--json]
```

`aiw init` creates only:

```text
.ai/manifest.yaml
```

It does not create `.cursor/`, `AGENTS.md`, `CLAUDE.md`, or knowledge directories.

## Later phases

Agent, source, import/export/sync, and workspace `--all` commands are defined in the specification and are **not** available yet.
