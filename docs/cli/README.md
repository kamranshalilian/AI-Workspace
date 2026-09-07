# CLI documentation

**Status:** Phase 4 implemented: `init`, `status`, `validate`, `doctor`, `agent create|add|remove|list|status`, `export`, `source add|list|remove`.

The normative contract is [docs/specification/07-cli.md](../specification/07-cli.md).

Install globally. Workspace state remains local:

```bash
npm install -g ai-workspace
aiw init
aiw status
aiw agent list
aiw source list
```

`.ai/` is created in the current workspace/project. Global install does not create `~/.ai/` or other user-global project state.

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

## Phase 3 commands

```bash
aiw agent create <id>
```

Writes `.ai/agents/<id>.yaml` with a valid empty-mapping stub. Does not modify the manifest, enable the agent, or export native files.

```text
create = create definition
add    = enable/register
export = materialize native output
```

The id must be a portable filesystem-safe token matching `[a-z0-9][a-z0-9._-]*`. Path separators, `..`, and absolute paths are rejected. An existing `.ai/agents/<id>.yaml` is never overwritten.

## Phase 4 commands

```bash
aiw source add <id> --type <type> --path <path> [--capabilities read,index]
aiw source list [--json]
aiw source remove <id>
```

```text
Source registration ≠ import
Source registration ≠ copy
Source registration ≠ execution
```

`--path` on `source add` is the federated source path (POSIX-normalized in the manifest). Discovery starts from the current working directory. Types: `directory`, `file`, `repository`, `generated`. Missing source paths register successfully and appear as `unresolved`.

## Later phases

Import/export-sync and workspace `--all` are **not** available yet.
