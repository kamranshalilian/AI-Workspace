# Manifest

The manifest is the authoritative machine-readable contract for a scope.

**Path:** `<scope-root>/.ai/manifest.yaml`

No other file under `.ai/` overrides the manifest. Directories that exist but are not included are inert.

`init` creates this file and nothing else.

## Encoding

- UTF-8
- YAML 1.2, JSON-compatible subset
- No custom tags, no merge keys, no duplicate keys
- Byte order mark is stripped if present
- Comments are allowed and preserved only in the source file; parsers must not require them

Manifests store **POSIX paths** (forward slashes), even on Windows.

## Top-level schema (specVersion 1)

```yaml
specVersion: 1
kind: project
name: accounting
description: "Optional human description"

extends:
  - path: ../.ai
    mode: extend
    exclude: []

context:
  include:
    - context/**
    - rules/**
    - skills/**
    - roles/**
    - architecture/**
    - decisions/**
    - workflows/**
  exclude: []

sources: {}

agents: {}

projects: {}

policies: {}
```

Unknown top-level keys are **errors**. This is a contract, not an open bag of annotations. Forward-compatible extension happens by raising `specVersion`.

Unknown keys *inside* `policies` vendor extensions are also errors in v1. Keep the schema closed.

## Field reference

### `specVersion` (required)

Integer. Currently only `1` is valid.

A higher or unknown version is a hard validation error. Do not attempt partial reads.

### `kind` (required)

Enum:

- `project`
- `workspace`

### `name` (required)

Stable identifier.

- Pattern: `^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$` (1–64 chars)
- Used in status output, workspace registries, and logs
- Not required to match the directory name, but `init` defaults to the directory basename normalized to this pattern

### `description` (optional)

String. Informational only. Not interpreted.

### `extends` (optional)

Array of parent references. **v1 allows 0 or 1 entry.** Multiple parents are a validation error (no diamond inheritance in v1).

Each entry:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `path` | POSIX string | yes | Path to the parent `.ai` directory or to the parent scope root. See resolution rules below. |
| `mode` | enum | no | `extend` (default), `replace`, `disable` |
| `exclude` | string[] | no | Resource identities to omit when `mode` is `extend`. Example: `rules/legacy.md` |

`path` is resolved from the **scope root** (the directory containing `.ai/`), not from `.ai/` itself.

Accepted forms:

- `../.ai` — parent `.ai` directory
- `..` — parent scope root (implementation appends `/.ai`)

After resolution, the parent must contain `manifest.yaml`. Otherwise validation fails.

`mode: disable` ignores `path` for resource merge. Implementations may still record the declared path in status for diagnostics, but must not load parent resources, agents, sources, or policies.

Cycle detection is mandatory. A repeated real path in the chain is an error.

### `context` (optional)

Controls which files under `.ai/` become resources.

| Field | Type | Default |
| --- | --- | --- |
| `include` | glob[] | See default includes |
| `exclude` | glob[] | `[]` |

Globs are relative to `.ai/`. Use `/` separators.

**Default include** if `context` is omitted or `include` is omitted:

```text
context/**
rules/**
skills/**
roles/**
architecture/**
decisions/**
workflows/**
```

These are **well-known kinds**. They are optional on disk. Missing directories are not errors.

**Reserved names** (never knowledge resources, even if included):

```text
manifest.yaml
agents/
sources/
state/
cache/
```

If `include` mentions a reserved path, validation fails.

A glob may include additional top-level kinds (for example `playbooks/**`). Unknown kinds are allowed. The well-known list is a convention, not a closed enum.

`exclude` is applied after `include`. Security exclusions are applied after that.

### `sources` (optional)

Map of source id → source object. Ids follow the same pattern as `name`.

See [Sources](04-sources.md).

Empty map or omitted means no sources.

### `agents` (optional)

Map of agent instance id → agent instance object.

```yaml
agents:
  cursor:
    enabled: true
    definition: cursor
    adapter:
      strategy: generated
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `enabled` | boolean | no | Default `true` |
| `definition` | string | no | Definition id. Defaults to the map key. |
| `adapter.strategy` | enum | no | Overrides the definition default strategy |

See [Agents and adapters](05-agents-adapters.md).

This block **enables** agents. It does not embed the full adapter implementation.

### `projects` (optional, workspace only)

Map of project id → registration.

```yaml
projects:
  accounting:
    path: ./accounting
  wallet:
    path: ./wallet
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `path` | POSIX string | yes | Path relative to the workspace root |

Rules:

- Valid only when `kind: workspace`. Presence on a project manifest is an error.
- Registration does **not** modify the project.
- `path` must not escape the workspace root via `..` in v1. All registered projects are descendants of the workspace root.
- Duplicate paths are errors.
- Missing directories are doctor warnings, not parse errors.

This is the only v1 discovery mechanism for `* --all` commands. No unbounded filesystem scan.

### `policies` (optional)

```yaml
policies:
  exclusions:
    - ".env"
    - ".env.*"
  maxFileBytes: 1048576
  trust:
    executableAdapters: false
    executableSources: false
```

| Field | Type | Default |
| --- | --- | --- |
| `exclusions` | string[] | built-in defaults (unioned, not replaced) |
| `maxFileBytes` | integer | `1048576` (1 MiB) |
| `trust.executableAdapters` | boolean | `false` |
| `trust.executableSources` | boolean | `false` |

User-provided `exclusions` are **added** to built-in defaults. To be documented: v1 has no way to remove a built-in exclusion. That is intentional.

`trust` values of `true` are reserved. In spec v1, `true` is a validation error because no executable engines are implemented. The fields exist so later versions do not rewrite the schema.

## Minimal valid manifests

Project:

```yaml
specVersion: 1
kind: project
name: accounting
```

Workspace:

```yaml
specVersion: 1
kind: workspace
name: company-workspace
```

## `init` generated manifest

`aiw init` writes a project manifest with `specVersion`, `kind`, and `name` only.

`aiw init --kind workspace` writes the workspace equivalent.

No `extends`, `context`, `agents`, `sources`, `projects`, or `policies` blocks are emitted unless the user passes explicit flags defined by the CLI contract.

## Validation summary

A manifest is invalid if any of the following hold:

- Missing required fields
- `specVersion` ≠ 1
- `kind` not in enum
- `name` fails pattern
- `extends` has more than one entry
- `extends.path` cannot be resolved to a directory containing `manifest.yaml` (unless `mode: disable`)
- `projects` present on `kind: project`
- Registered project path escapes workspace root
- Reserved paths in `context.include`
- Duplicate keys
- `trust.*: true` in spec v1
- Agent, source, or project ids fail the name pattern

Validation is strict. Warnings belong to `doctor`, not to parse success.
