# CLI contract

Binary name: **`aiw`**

Principles:

- Scriptable
- Predictable exit codes
- Human-friendly default output
- Machine-readable `--json` on read-only inspection commands
- Cross-platform
- No vendor-named commands (`aiw cursor` is invalid)

Global flags (all commands):

| Flag | Meaning |
| --- | --- |
| `--path <dir>` | Start discovery from this directory instead of cwd |
| `--json` | JSON on stdout for supported commands; diagnostics on stderr |
| `--quiet` | Errors only |
| `--verbose` | Extra diagnostics on stderr |
| `--help` | Command help |
| `--version` | Package version (`aiw --version`) |

`--json` is required in Phase 1 for `status`, `doctor`, and `validate` so tests and CI do not parse prose.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success |
| `1` | Usage / argument error |
| `2` | Validation or doctor found errors |
| `3` | Conflict / non-destructive refusal |
| `4` | No `.ai` found (and command is not `init`) |
| `5` | I/O or unexpected failure |

Doctor with only warnings is `0`. Doctor with errors is `2`.

## Command phasing

Do not implement the full tree in Phase 1. The table is the v1 product contract.

### Phase 1 — Core

```text
aiw init [--kind project|workspace] [--name <name>] [--path <dir>] [--force]
aiw status
aiw doctor
aiw validate
aiw --help
aiw --version
```

### Phase 2 — Reference adapters

```text
aiw agent add <definition-id> [--no-export]
aiw agent remove <id>
aiw agent list
aiw agent status
aiw export [--agent <id>]
```

### Phase 3 — User-defined agents

```text
aiw agent create <id>
```

### Phase 4 — Sources

```text
aiw source add <id> --type <type> --path <path>
aiw source list
aiw source remove <id>
```

### Phase 5 — Import / sync

```text
aiw import --source <id> [--dry-run]
aiw promote --agent <id> [--dry-run]
aiw sync [--source <id>] [--agent <id>] [--dry-run] [--apply]
```

### Phase 6 — Workspace federation

```text
aiw project add <id> <path>
aiw project list
aiw project remove <id>
aiw status --all
aiw validate --all
aiw doctor --all
aiw export --all
aiw sync --all
```

`--all` iterates the workspace `projects:` registry in lexicographical id order. It does not scan the filesystem. Import and promote remain explicitly scoped (`aiw import --all` and `aiw promote --all` are not provided). `aiw agent enable|disable` is not implemented in Phase 6.

No `aiw workspace` subcommand in v1. A workspace is `kind: workspace` plus `aiw project …` and `--all`.

No `aiw adapter` subcommand in v1. Adapters are part of agent definitions.

## Command semantics

### `aiw init`

Create `.ai/manifest.yaml`.

Defaults:

- `kind`: `project`
- `name`: normalized directory basename; if normalization fails, require `--name`

Fails if `.ai/` exists, unless `--force`.

Does not register the project in a parent workspace. Phase 6 `project add` does that.

Does not invent `extends`. Users add inheritance explicitly (or a later helper may suggest it). Phase 1 stays dumb and safe.

### `aiw status`

Show active scope, inheritance, resource counts by kind, agents, sources, and issue counts.

Does not write files.

`--all`: iterate registered workspace projects independently. Failure in one project does not skip the others. Exit `0` only when every project succeeds; otherwise non-zero. Does not export the workspace `.ai/` as if it were a project.

### `aiw validate`

Schema + path resolution + cycle detection + definition load.

No suggestions. CI-friendly. Exit `2` on any error. `--all` validates the workspace registry, then each registered project independently.

### `aiw doctor`

`validate` plus:

- missing registered projects
- security exclusion hits that skipped files
- unmanaged native files in known native roots (if agents enabled)
- missing recommended `.gitignore` entries for cache/state
- project extending a non-workspace parent
- unresolved sources
- platform strategy issues

Suggestions are warnings unless they make the snapshot unsafe (then errors). `--all` aggregates workspace diagnostics with per-project doctor reports.

### `aiw agent add <definition-id>`

1. Resolve definition (project `.ai/agents/`, inherited parents, then bundled package data)
2. Add/merge instance into `agents:`
3. Do **not** write native files

Phase 2 clarification: native materialization is `aiw export`. `agent add` changes only the manifest so add remains non-destructive (acceptance: add does not create agent-native paths).

### `aiw agent remove <id>`

Remove the instance from the manifest. Do not delete native files in Phase 2.

### `aiw agent create <id>`

Write `.ai/agents/<id>.yaml` with a deterministic, valid empty-mapping stub.

Does **not** modify the manifest, enable/register the agent, generate native files, or export.

```text
create = create definition
add    = enable/register
export = materialize native output
```

Fail if `.ai/agents/<id>.yaml` already exists. Do not overwrite, merge, or modify bundled package definitions.

IDs must be non-empty, portable, and filesystem-safe (`[a-z0-9][a-z0-9._-]*`). Reject path separators, `..`, `.`, and absolute/drive-qualified paths before constructing a filesystem path.

### `aiw agent enable` / `disable`

Not implemented in Phase 6. Use `aiw agent add` / `aiw agent remove` on a single project.

### `aiw export`

Write native files for enabled agents (or one agent). `--all` exports each registered project into that project's own native paths. It does not write workspace-level `.cursor/`, `AGENTS.md`, or `CLAUDE.md`.

### `aiw source add`

Write a `sources:` entry. Do not copy files, create `.ai/sources/`, or execute tools.

```bash
aiw source add <id> --type <type> --path <path> [--capabilities read,index]
```

`--path` is the source path, normalized to POSIX in the manifest. The path need not exist; missing paths are `unresolved`. Duplicate ids fail.

### `aiw source list`

Show registered sources: id, type, path, capabilities, and `resolved` / `unresolved` / `invalid`. `--json` is deterministic.

### `aiw source remove`

Remove the manifest entry only. Do not delete source files or `.ai/sources/<id>`.

### `aiw project add <id> <path>`

Workspace only. Registry-only: writes the workspace manifest. Does not create project `.ai/`, does not modify the target, and does not export or inherit.

The id is the registry identity. The path is stored POSIX-normalized and resolved from the workspace root, even when `--path` is used from another cwd.

### `aiw project list`

Show registered projects: id, declared path, and `resolved` / `unresolved` / `invalid`. `--json` is deterministic (lexicographical id).

### `aiw project remove <id>`

Remove the registry entry only. Do not delete the project directory, `.ai/`, native files, or Git metadata.

### `aiw import`

Snapshot a registered source into `.ai/sources/<id>/`. The live source remains at its declared `path`. Import is not Source→Agent and does not export.

Requires declared capabilities `read`, `index`, and `import`. Security exclusions, include/exclude, and deterministic ordering apply. `--dry-run` reports writes without creating files.

Unmanaged files already under the snapshot destination are not overwritten (exit `3`).

### `aiw promote`

Convert native agent artifacts into canonical `.ai/` resources using a declared reversible mapping. Always explicit. `--dry-run` reports writes without modifying canonical files.

If no reversible mapping exists, or the format is concatenated/reference-index, fail clearly. Do not guess or invoke an LLM.

### `aiw sync`

Compare related representations using last-known content hashes:

| Canonical/snapshot | External/native | State |
| --- | --- | --- |
| unchanged | unchanged | `clean` |
| changed | unchanged | `canonical-changed` |
| unchanged | changed | `external-changed` |
| changed | changed | `conflict` |

Default is report-only. `--apply` writes one-sided non-conflict updates only. `--dry-run` previews those writes. Conflict never overwrites either side. `--all` runs this independently per registered project; each project keeps its own `.ai/state/sync.yaml`.

## Output

Human output is stable enough to read, not guaranteed byte-stable across versions.

`--json` schemas should be versioned with a `"specVersion": 1` field in the payload.

JSON for `status` should include the effective snapshot summary (counts, ids, origins), not full file bodies.

## Naming rules

- Commands are nouns then verbs: `agent add`, `source list`
- Flags are long-form in docs; short flags are optional later
- No hidden aliases required in v1

## Unimplemented until listed phase

Documenting a command here does not authorize implementing it early. Phase gates in [architecture phase plan](../architecture/phase-plan.md) are binding.
