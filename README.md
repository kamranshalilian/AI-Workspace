# AI Workspace

AI Workspace is a **local-first, Git-friendly, tool-agnostic context layer** for software projects and multi-project workspaces.

It gives a project one canonical place for AI knowledge — `.ai/` — and treats agent-specific files such as `.cursor/`, `AGENTS.md`, and `CLAUDE.md` as **adapters** of that layer, not as the source of truth.

**Current status: Phase 4 (sources and context federation).** The globally installed `aiw` CLI can initialize a local `.ai` directory, resolve inheritance, create and register declarative YAML agent definitions, export native files, and register federated sources by reference. Import/sync and workspace `--all` are not implemented.

## Requirements

- Node.js 20 LTS or newer

## Install

AI Workspace is a globally installed CLI. Workspace state stays in the current project under `.ai/`.

```bash
npm install -g ai-workspace
```

```bash
aiw init
aiw status
aiw agent list
```

The binary name is `aiw`. The package name is `ai-workspace`. After global install, the CLI works from any directory and does not require `ai-workspace` in the project's `node_modules`.

### Install from this repository

```bash
npm install
npm run build
npx aiw --help
```

## What AI Workspace is

Developers and coding agents need shared project knowledge: architecture, rules, skills, decisions, workflows, and references to external systems.

Today that knowledge is usually copied into whatever directory a particular agent understands. That makes one vendor the center of the design.

AI Workspace inverts that:

```text
Human / Developer
        │
        ▼
  AI Workspace
        │
      .ai/          ← canonical knowledge and contracts
        │
   Resolution
        │
   ┌────┼────┐
   │    │    │
Cursor Codex Claude  ← adapters / native interfaces
```

`.ai/` is the canonical AI knowledge layer of a project or workspace. Agent-native files are downstream consumers.

## Why `.ai` exists

- One Git-diffable source of truth for AI context.
- The same knowledge can be consumed by multiple agents without duplication.
- Workspace-level context can be inherited by many projects.
- External knowledge systems can be **referenced**, not copied.
- New agents can be added as declarative definitions instead of core releases.

## How this differs from agent-specific directories

| Layer | Role | Examples |
| --- | --- | --- |
| Canonical | Source of truth | `.ai/manifest.yaml`, `.ai/rules/`, `.ai/architecture/` |
| Adapter | Translation | declarative mappings (Phase 2+) |
| Native | Agent-owned interface | `.cursor/rules/`, `AGENTS.md`, `CLAUDE.md` |

If Cursor disappeared tomorrow, the canonical layer would still be valid. A new agent would be added as a definition, not as a rewrite of the core.

## Workspace and project inheritance

Two scopes exist:

- **Workspace** — a parent directory that may contain many projects.
- **Project** — a specific repository or project tree.

Default inheritance:

```text
workspace .ai  +  project .ai  =  effective project context
```

A project may **extend** (default), **replace**, or **disable** inherited context, and may **exclude** specific inherited identities.

Phase 1 implements this in the resolver. Central `--all` management is Phase 6.

See [Scope, inheritance, and resolution](docs/specification/03-scope-inheritance-resolution.md).

## How adapters work

An **agent** is a named consumer. An **adapter** maps canonical resources onto that agent's native files and formats.

Adapters are declarative YAML. The core ships generic format engines (`identity`, `markdown-frontmatter`, `concatenated-markdown`, `reference-index`). It does not contain vendor-named TypeScript branches.

Generated files include an `aiw-provenance` HTML comment. Export will update those managed files and will not overwrite unmanaged native files.

See [Agents and adapters](docs/specification/05-agents-adapters.md).

## How sources work

A **source** is a federated reference to knowledge that stays outside `.ai/`. Registration does not copy, import, or execute anything.

```bash
aiw source add graphify --type directory --path ../.graphify --capabilities read,index
aiw source list
aiw source remove graphify
```

```text
source add    = register a reference in the manifest
source list   = show type, path, capabilities, and resolution status
source remove = unregister the reference
```

The live files remain at `path`. `.ai/sources/` is reserved for a later import snapshot (Phase 5) and is **not** created by these commands.

See [Sources](docs/specification/04-sources.md).

## How to initialize a project

```bash
aiw init
```

Result:

```text
.ai/
└── manifest.yaml
```

No other files are created. `aiw init` does not write `.cursor/`, `AGENTS.md`, or `CLAUDE.md`.

```bash
aiw init --kind workspace
aiw init --name accounting
aiw validate
aiw status
aiw doctor
```

`--json` is supported on these commands.

See [CLI](docs/cli/README.md).

## How to add an agent

Create a definition, enable it, then export native files. These are separate steps:

```bash
aiw agent create my-agent
aiw agent add my-agent
aiw export --agent my-agent
```

```text
create = create definition   (.ai/agents/<id>.yaml only)
add    = enable/register     (manifest only)
export = materialize native output
```

`aiw agent create` writes a valid empty-mapping stub. It does not modify the manifest, enable the agent, or write native files. Edit the YAML, then `aiw agent add` and `aiw export`.

Bundled definition ids currently include `cursor`, `claude`, and `codex`. A project-local file at `.ai/agents/<id>.yaml` shadows a bundled definition with the same id.

```bash
aiw agent add cursor
aiw export
aiw agent list
aiw agent status
aiw export --agent cursor
aiw agent remove cursor
```

`aiw agent add` registers the definition in `.ai/manifest.yaml` only. Removal does not delete native files.

## How to add a source

```bash
aiw source add knowledge --type directory --path ../knowledge --capabilities read,index
```

Only `.ai/manifest.yaml` changes. The referenced tree is not copied.

## Current limitations

- No import, promote, or sync
- No workspace project registry CLI or `--all`
- No executable adapters or plugins
- Only the `generated` integration strategy is implemented
- Source content is not fed into agent export yet
- No MCP, embeddings, cloud, or GUI

## Development

```bash
npm test
npm run build
```

This repository dogfoods itself as `kind: project` under `.ai/`.

## Documentation

| Area | Location |
| --- | --- |
| Specification | [docs/specification/](docs/specification/) |
| Architecture | [docs/architecture/](docs/architecture/) |
| Phase 0 review | [docs/architecture/phase-0-review.md](docs/architecture/phase-0-review.md) |
| CLI | [docs/cli/](docs/cli/) |
| Integrations | [docs/integrations/](docs/integrations/) |
| Open decisions | [docs/architecture/open-decisions.md](docs/architecture/open-decisions.md) |

## License

MIT. See [LICENSE](LICENSE).
