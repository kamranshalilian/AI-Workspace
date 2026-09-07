# Agents and adapters

Agents are generic consumers. Adapters translate canonical `.ai` resources into native agent interfaces.

The core must not contain vendor branches such as `if (agent === "cursor")`.

A new agent must be addable as configuration. A new knowledge tool must be addable as a source. Neither requires a core TypeScript change **unless a new generic format engine is needed**.

## Separation

```text
Canonical .ai
     │
     ▼
 Adapter engine (generic, in core)
     │
     ▼
Native agent files
```

| Piece | Where it lives | Changes when |
| --- | --- | --- |
| Agent instance | `manifest.yaml` `agents:` | User enables/disables an agent |
| Agent definition | YAML data file | User or bundled definition describes native layout |
| Adapter engine | Core | Rare; interprets mappings |
| Format engine | Core | Rare; new generic transform |

## Agent instance (manifest)

```yaml
agents:
  cursor:
    enabled: true
    definition: cursor
    adapter:
      strategy: generated
```

The instance id (`cursor` above) is local to the scope. It usually matches the definition id.

## Agent definition

Definitions are **data**.

### Search order

When resolving `definition: <id>`:

1. `<active-root>/.ai/agents/<id>.yaml`
2. Each inherited parent `.ai/agents/<id>.yaml` (nearest child wins if multiple exist — actually: used definition is the one found for the instance origin; if child instance is original, search child then parent)
3. Bundled package data: `definitions/agents/<id>.yaml`

Practical rule: **first match in [active `.ai/agents/`, then each parent `.ai/agents/` from child to parent, then bundled]**.

Users override bundled definitions by placing a file at `.ai/agents/<id>.yaml`.

### Definition schema

```yaml
specVersion: 1
kind: agent-definition
id: cursor
name: Cursor
capabilities:
  - context
  - rules
native:
  roots:
    - .cursor
  files: []
adapter:
  engine: declarative
  strategy: generated
  mappings:
    - fromKind: rules
      from: "**/*.md"
      to: ".cursor/rules/{{stem}}.mdc"
      format: markdown-frontmatter
      frontmatter:
        description: "{{stem}}"
      provenance: header
```

| Field | Required | Notes |
| --- | --- | --- |
| `specVersion` | yes | `1` |
| `kind` | yes | `agent-definition` |
| `id` | yes | Name pattern; should match filename stem |
| `name` | yes | Display name |
| `capabilities` | no | Closed v1 set: `context`, `rules`, `skills` |
| `native.roots` | no | Directories that belong to the agent |
| `native.files` | no | Individual native files (`AGENTS.md`) |
| `adapter.engine` | yes | v1: only `declarative` |
| `adapter.strategy` | no | Default `generated` |
| `adapter.mappings` | yes | At least one mapping for a useful definition |

`engine: executable` is invalid in spec v1.

Unknown `kind` or `engine` is a validation error.

## Mapping object

| Field | Type | Description |
| --- | --- | --- |
| `fromKind` | string or `*` | Resource kind filter |
| `from` | glob | Relative to that kind directory |
| `to` | POSIX template | Output path relative to **active scope root** |
| `format` | enum | Format engine id |
| `frontmatter` | map | For `markdown-frontmatter` |
| `order` | enum | For `concatenated-markdown`: `identity`, `kind-then-name` |
| `wrap.heading` | string | Template prepended per file in concatenated output |
| `wrap.separator` | string | Default `"\n\n"` |
| `provenance` | enum | `header`, `none` |

Templates may use:

- `{{identity}}` — `rules/security.md`
- `{{kind}}` — `rules`
- `{{relativePath}}` — `security.md`
- `{{stem}}` — `security`
- `{{name}}` — definition or resource stem (definition files should use `{{stem}}` for files)

If `to` collides across mappings, later mappings in the definition file win only if they target the same concatenated file; two identity mappings writing the same output path with `identity`/`markdown-frontmatter` is a definition validation error.

## Format engines (generic)

v1 engines:

| Id | Behavior |
| --- | --- |
| `identity` | Write source bytes to `to`. Text only after security checks. |
| `markdown-frontmatter` | YAML frontmatter from mapping + source body |
| `concatenated-markdown` | Merge matching resources into one markdown file |
| `reference-index` | Write a markdown list of identities and relative paths; no body copy |

These engines are intentionally small. They must stay vendor-neutral.

If a future agent cannot be expressed with them, options are:

1. Add a new **generic** format engine (specification change + core change), or
2. Later: trusted executable adapter (not v1)

Option 1 is acceptable when the transform is reusable. Option 1 is **not** acceptable if the engine is secretly `cursor-mdc-v3`. Prefer parameters on existing engines.

## Integration strategies

Declared on the definition and overridable per instance.

| Strategy | Behavior | Portability |
| --- | --- | --- |
| `generated` | Write files with provenance. **Default.** | High |
| `copy` | Byte copy without provenance header unless requested | High |
| `reference` | Write a reference-index or path list, not full content | High |
| `symlink` | File symlink where the OS supports it | Linux/macOS common; Windows optional |
| `junction` | Directory junction (Windows) | Windows |

Rules:

- Do not assume symlink support.
- If `symlink` or `junction` is requested and unsupported, fail that agent export with a clear error. Do not silently fall back (silent fallback is non-deterministic across machines). Doctor may suggest changing strategy to `generated`.
- Prefer `generated` in bundled definitions.

## Provenance

For `strategy: generated` and `provenance: header`, prepend a header the format allows.

Markdown / `.mdc`:

```markdown
<!--
aiw-provenance:
  specVersion: 1
  identity: rules/security.md
  hash: sha256:<hex>
-->
```

The hash is of the **canonical source bytes**, not of the generated file.

If the native format cannot comment, v1 mappings must set `provenance: none` and rely on local state. Bundled concatenated files (`AGENTS.md`, `CLAUDE.md`) still use an HTML comment at the top of the generated file describing the set of identities.

Unmanaged files: any native path that exists, is targeted by export, and lacks valid provenance is **unmanaged**. Export must not overwrite it.

## Non-destructive export

For each target path:

1. If missing → write
2. If exists with matching provenance hash of current canonical → rewrite (idempotent)
3. If exists with provenance but content/hash diverges from canonical → **conflict** (native edited or canonical edited; Phase 5 classifies)
4. If exists without provenance → **conflict** (unmanaged). Do not overwrite.

Phase 2 may implement 1–2 and treat 3–4 as errors. Phase 5 classifies canonical-only vs native-only vs both-changed.

Never delete native files on `agent remove` unless the user passes an explicit flag (not in Phase 2). Removing an agent disables future export; leftover generated files remain.

## Import vs promote

### Import

```text
Source → .ai/sources/<id>/ snapshot
```

The live source remains an external source of truth. Importing does not transfer ownership and does not export to agents.

### Promote

```text
Native agent artifact → canonical .ai/ resource
```

Promotion is always explicit (`aiw promote --agent <id>`). It uses only a declared reversible format mapping (`identity` or `markdown-frontmatter`). Concatenated and reference-index outputs fail clearly.

Never implied by import. Never inferred by an LLM.

## User-defined agents

```bash
aiw agent create my-agent
```

Writes `.ai/agents/my-agent.yaml` with a valid declarative stub (`engine: declarative`, `mappings: []`) and does not modify core or the manifest.

Empty mappings are valid so the user can create the definition first and edit the YAML afterward. Export with no applicable mappings is a no-op.

```bash
aiw agent add my-agent
aiw export --agent my-agent
```

Registers the instance in the manifest, then materializes native files if mappings match.

That satisfies: no AI Workspace release is required to add an agent, provided existing format engines suffice.

## Bundled definitions (data, not code)

The CLI package may ship YAML definitions for common agents so `aiw agent add cursor` is useful on day one.

Bundled definitions are **examples of the contract**, not privileged core modules. They can be removed from the package without changing core logic.

Proposed bundled ids (approval requested):

- `cursor` — `.cursor/rules/{{stem}}.mdc` via `markdown-frontmatter`
- `claude` — `CLAUDE.md` via `concatenated-markdown`
- `codex` — `AGENTS.md` via `concatenated-markdown`

These prove two families:

- many files in an agent directory
- one concatenated file at the scope root

If bundling is rejected, users copy examples from `docs/integrations/` instead. Core remains the same.

## Lifecycle operations

Conceptual operations: discover, init, enable, disable, import, export, sync, validate, doctor, status.

v1 CLI exposes a subset. See [CLI](07-cli.md).

Internal operations not necessarily commands:

- **discover** — definition search order
- **validate** — definition + instance schema
- **export** — adapter write
- **enable/disable** — `enabled` flag

## What must never land in core TypeScript

- Agent name enums used for behavior
- Hard-coded native paths (`.cursor`, `CLAUDE.md`) except inside bundled **YAML**
- Graphify- or spec-kit-specific parsers
- Silent semantic rewriting of rule text
