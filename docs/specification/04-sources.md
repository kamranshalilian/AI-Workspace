# Sources

Sources are generic, federated references to knowledge that should not have to be copied into `.ai/`.

`.ai` is an index/reference layer. Duplication is a last resort.

Graphify and spec-kit are **examples** that prove the model. They must not appear as special cases in core code.

## Manifest form

```yaml
sources:
  graphify:
    type: directory
    path: ../.graphify
    capabilities: [read, index]
    include: ["**/*"]
    exclude: []
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `type` | enum | yes | `directory`, `file`, `repository`, `generated` |
| `path` | POSIX string | yes | Relative to the declaring scope root, or absolute |
| `capabilities` | string[] | no | Default: `["read"]` |
| `include` | glob[] | no | Default: `["**/*"]` for directory/repository; ignored for `file` |
| `exclude` | glob[] | no | Additional excludes, plus security exclusions |

Source ids follow the `name` pattern.

## v1 types

### `directory`

A directory of files on the local filesystem.

Capabilities typically: `read`, `index`.

### `file`

A single file.

Capabilities typically: `read`.

### `repository`

A **local checkout** of another repository (a directory that is a Git root, or any directory treated as a tree).

v1 does **not** clone remotes, fetch, or update Git state. `path` is local.

Capabilities typically: `read`, `index`.

This type exists so status/doctor can distinguish “another repo” from “a loose folder” and later grow Git-aware behavior without renaming.

### `generated`

A path that some **other** tool produces.

v1 treats this exactly like `directory` or `file` (whichever exists at `path`) for reading. It does **not** run a generator.

If the path is missing, status is `unresolved`. AI Workspace never creates it by executing a command.

## Explicitly not in v1

These names are reserved in documentation only. Using them as `type` is a validation error:

- `command`
- `api`
- `mcp`
- `database`
- `remote`

## Capabilities

Capabilities are declared, not inferred from type beyond the default `["read"]`.

v1 recognized capabilities:

| Capability | Meaning in v1 |
| --- | --- |
| `read` | Files may be opened for resolution/status |
| `index` | Files may be listed and included in status inventories |

Recognized but **not implemented** in v1 (declaration allowed, operations rejected):

| Capability | Future meaning |
| --- | --- |
| `write` | AI Workspace may write into the source |
| `link` | May create a native-interface pointer |
| `import` | May copy a snapshot into `.ai/sources/` |
| `export` | May write canonical content back to the source |
| `sync` | Bidirectional update |

Core must inspect declared capabilities before any operation. An undeclared capability is a hard error for that operation.

Unknown capability strings are validation errors in v1 (closed set).

## Federation rules

- Do not copy source trees into `.ai/` during `init`, `status`, `doctor`, or resolution.
- `aiw source add` writes a manifest entry only.
- Physical import into `.ai/sources/<id>/` is a later **import** operation (Phase 5) and still leaves the original in place.
- Resolution may record source files in the snapshot as `source:<id>:<relativePath>` identities so adapters *could* consume them later. **Phase 4 inventories sources for status/list. It does not feed source files into agent export.** Export of source content and import into `.ai/sources/` are Phase 5.

## Path rules

- Resolved from the declaring scope root.
- May leave the scope root (`..` is allowed). This is required for federation.
- Must not follow a symlink chain that escapes into excluded sensitive files without applying security exclusions to the **resolved** target.
- Windows and POSIX paths on the CLI are normalized to POSIX in the manifest when `source add` writes YAML.

## Graphify and spec-kit

### Graphify (example, not core)

```yaml
sources:
  graphify:
    type: directory
    path: ../.graphify
    capabilities: [read, index]
```

No Graphify parser belongs in core. If a future source adapter understands Graphify structure, it is a definition, not a core module named graphify.

### spec-kit (example, not core)

```yaml
sources:
  spec-kit:
    type: directory
    path: ./specs
    capabilities: [read, index]
```

Same rule.

A user can register any other directory the same way. That is the architectural test.

## `.ai/sources/` directory

Optional on disk.

Used only when an **import** materializes a snapshot:

```text
.ai/sources/<id>/...
```

That snapshot is an imported artifact, not the live federated source. The live source remains at `path`.

Do not create `.ai/sources/` during `init`.
