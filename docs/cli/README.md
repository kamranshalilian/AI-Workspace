# CLI documentation

**Status:** Specified, not implemented.

The `aiw` binary does not exist yet. This page tracks the intended user-facing CLI. The normative contract is [docs/specification/07-cli.md](../specification/07-cli.md).

## Planned Phase 1

```bash
aiw init
aiw status
aiw doctor
aiw validate
```

`aiw init` is specified to create only:

```text
.ai/manifest.yaml
```

## Later phases

Agent, source, import/export/sync, and workspace `--all` commands are defined in the specification and are **not** available until their phase lands.

Do not copy later-phase examples into tutorials as if they work today.
