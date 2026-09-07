# AI Workspace

AI Workspace is a **local-first, Git-friendly, tool-agnostic context layer** for software projects and multi-project workspaces.

It gives a project one canonical place for AI knowledge — `.ai/` — and treats agent-specific files such as `.cursor/`, `AGENTS.md`, and `CLAUDE.md` as **adapters** of that layer, not as the source of truth.

**Current status: Phase 0 (specification). No CLI or runtime is implemented yet.**

The CLI name will be `aiw`. Do not expect `aiw` commands to work until Phase 1 is implemented.

## What AI Workspace is

Developers and coding agents need shared project knowledge: architecture, rules, skills, decisions, workflows, and references to external systems.

Today that knowledge is usually copied into whatever directory a particular agent understands. That makes Cursor, Codex, Claude, or any other tool the center of the design.

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
- External knowledge systems (Graphify, spec-kit, another repo, generated docs) can be **referenced**, not copied.
- New agents can be added as declarative definitions instead of core releases.

## How this differs from agent-specific directories

| Layer | Role | Examples |
| --- | --- | --- |
| Canonical | Source of truth | `.ai/manifest.yaml`, `.ai/rules/`, `.ai/architecture/` |
| Adapter | Translation | declarative mappings, format engines |
| Native | Agent-owned interface | `.cursor/rules/`, `AGENTS.md`, `CLAUDE.md` |

AI Workspace does not replace the native files an agent already understands. It produces or references them from canonical content.

If Cursor disappeared tomorrow, the canonical layer would still be valid. A new agent would be added as a definition, not as a rewrite of the core.

## Workspace and project inheritance

Two scopes exist:

- **Workspace** — a parent directory that may contain many projects.
- **Project** — a specific repository or project tree.

Default inheritance:

```text
workspace .ai  +  project .ai  =  effective project context
```

Inheritance is a resolution-layer concept. It is not implemented by copying files from the workspace into each project.

A project may:

- **extend** workspace context (default)
- **replace** inherited knowledge with its own
- **disable** inheritance entirely
- **exclude** specific inherited resources

See [Scope, inheritance, and resolution](docs/specification/03-scope-inheritance-resolution.md).

## How adapters work

An **agent** is a named consumer. An **adapter** maps canonical resources onto that agent's native files and formats.

Adapters are declarative YAML. The core ships generic format engines (`identity`, `markdown-frontmatter`, `concatenated-markdown`, `reference-index`). It does not contain `if agent === "cursor"` logic.

See [Agents and adapters](docs/specification/05-agents-adapters.md).

## How sources work

A **source** is a federated reference to knowledge that should not have to live inside `.ai/`.

Example:

```yaml
sources:
  graphify:
    type: directory
    path: ../.graphify
    capabilities: [read]
```

Graphify and spec-kit are examples of sources. They are not core subsystems.

See [Sources](docs/specification/04-sources.md).

## How to initialize a project

Specified, not yet implemented:

```bash
aiw init
```

Planned result:

```text
.ai/
└── manifest.yaml
```

See [CLI contract](docs/specification/07-cli.md).

## How to add an agent

Specified, not yet implemented:

```bash
aiw agent add cursor
```

This will register a declarative agent definition and, by default, export canonical knowledge to the agent's native interface — without deleting unmanaged native files.

## How to add a source

Specified, not yet implemented:

```bash
aiw source add graphify --type directory --path ../.graphify
```

## Current limitations

- Phase 0 only: specification and architecture documents exist.
- No `aiw` binary, no manifest parser, no resolution engine.
- No adapters, sources, import, export, or sync.
- No dogfooding `.ai/` directory yet. That lands when the schema is approved and Phase 1 begins.
- Task-specific context, executable plugins, cloud sync, embeddings, MCP, and GUIs are explicitly out of scope for the MVP.

## Documentation

| Area | Location |
| --- | --- |
| Specification | [docs/specification/](docs/specification/) |
| Architecture | [docs/architecture/](docs/architecture/) |
| Phase 0 review | [docs/architecture/phase-0-review.md](docs/architecture/phase-0-review.md) |
| CLI (planned) | [docs/cli/](docs/cli/) |
| Integrations (planned) | [docs/integrations/](docs/integrations/) |
| Open decisions | [docs/architecture/open-decisions.md](docs/architecture/open-decisions.md) |

## License

License is an open decision. See [open decisions](docs/architecture/open-decisions.md).
