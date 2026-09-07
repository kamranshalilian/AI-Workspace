# CLI documentation

**Status:** Phase 5 implemented: `init`, `status`, `validate`, `doctor`, `agent create|add|remove|list|status`, `export`, `source add|list|remove`, `import`, `promote`, `sync`.

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

## Phase 5 commands

```bash
aiw import --source <id> [--dry-run] [--json]
aiw promote --agent <id> [--dry-run] [--json]
aiw sync [--source <id>] [--agent <id>] [--dry-run] [--apply] [--json]
```

```text
import  = Source → .ai/sources/<id>/ snapshot
promote = native agent artifact → canonical .ai/ resource
export  = canonical → native (Phase 2, unchanged)
sync    = state-aware comparison of already-related representations
```

Import requires the source to declare `read`, `index`, and `import`. It never executes the source, never deletes it, and never exports afterward.

Promote requires a declared reversible mapping (`identity` or `markdown-frontmatter`). Concatenated and reference-index formats fail clearly.

`aiw sync` is report-only unless `--apply` is passed. `--apply` writes only one-sided non-conflict updates: it may refresh an imported snapshot from a live source, or refresh a managed native file from canonical content. It never writes into a live source, never auto-promotes, never overwrites unmanaged files, and never merges conflicts.

Four-state model:

```text
clean
canonical-changed
external-changed
conflict
```

Conflict exit code is `3`. Both sides are preserved.

Last-known hashes live in `.ai/state/sync.yaml` (Git-ignored). Imported file provenance lives in `.ai/sources/<id>/.aiw-import.yaml`.

## Later phases

Workspace `--all` and project registry commands are **not** available yet.
