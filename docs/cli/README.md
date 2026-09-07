# CLI documentation

**Status:** Phase 2 implemented: `init`, `status`, `validate`, `doctor`, `agent add|remove|list|status`, `export`.

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

## Phase 2 commands

```bash
aiw agent add <id>
aiw agent remove <id>
aiw agent list
aiw agent status
aiw export [--agent <id>]
```

`agent add` writes the manifest only. Native files are created or updated by `export`.

Generated outputs are marked with an `aiw-provenance` header. Unmanaged native files are left untouched; export then exits with code `3`.

## Later phases

`agent create`, source commands, import/export-sync, and workspace `--all` are **not** available yet.
