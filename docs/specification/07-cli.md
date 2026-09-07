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
aiw import --from <agent-id> [--promote]
aiw sync [--agent <id>]
```

### Phase 6 — Workspace federation

```text
aiw project add <path>
aiw project list
aiw project remove <id>
aiw status --all
aiw doctor --all
aiw validate --all
aiw agent enable <id> [--all]
aiw agent disable <id> [--all]
```

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

`--all` (Phase 6): workspace registry, one section per project. Error if active/workspace target is not `kind: workspace`.

### `aiw validate`

Schema + path resolution + cycle detection + definition load.

No suggestions. CI-friendly. Exit `2` on any error.

### `aiw doctor`

`validate` plus:

- missing registered projects
- security exclusion hits that skipped files
- unmanaged native files in known native roots (if agents enabled)
- missing recommended `.gitignore` entries for cache/state
- project extending a non-workspace parent
- unresolved sources
- platform strategy issues

Suggestions are warnings unless they make the snapshot unsafe (then errors).

### `aiw agent add <definition-id>`

1. Resolve definition (project `.ai/agents/`, inherited parents, then bundled package data)
2. Add/merge instance into `agents:`
3. Do **not** write native files

Phase 2 clarification: native materialization is `aiw export`. `agent add` changes only the manifest so add remains non-destructive (acceptance: add does not create agent-native paths).

### `aiw agent remove <id>`

Remove the instance from the manifest. Do not delete native files in Phase 2.

### `aiw agent create <id>`

Write `.ai/agents/<id>.yaml` stub. Fail if the file exists.

### `aiw agent enable` / `disable`

Set `enabled`. `--all` applies to registered projects (Phase 6). Does not by itself export.

### `aiw export`

Write native files for enabled agents (or one agent).

### `aiw source add`

Write `sources:` entry. Do not copy files.

### `aiw project add <path>`

Workspace only. Path relative to workspace root after normalization. Id defaults to normalized basename.

Does not create a project `.ai`. Does not modify the project. Suggests `aiw init` via doctor if missing.

### `aiw import`

Phase 5. Snapshot native artifacts into `.ai/sources/<id>/`. Original remains.

`--promote` also writes canonical resources. Conversion must be explicit and described in command output.

### `aiw sync`

Phase 5. Report only in MVP of this phase: `canonical`, `native`, `both`, `conflict`. No automatic overwrite.

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
