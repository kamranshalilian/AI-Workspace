# AI Workspace

[![npm version](https://img.shields.io/npm/v/@empratur256/ai-workspace.svg)](https://www.npmjs.com/package/@empratur256/ai-workspace)
[![npm downloads](https://img.shields.io/npm/dm/@empratur256/ai-workspace.svg)](https://www.npmjs.com/package/@empratur256/ai-workspace)
[![Node.js](https://img.shields.io/node/v/@empratur256/ai-workspace.svg)](https://www.npmjs.com/package/@empratur256/ai-workspace)
[![License: MIT](https://img.shields.io/npm/l/@empratur256/ai-workspace.svg)](https://github.com/kamranshalilian/AI-Workspace/blob/main/LICENSE)
[![GitHub](https://img.shields.io/badge/GitHub-kamranshalilian%2FAI--Workspace-181717?logo=github)](https://github.com/kamranshalilian/AI-Workspace)

Local-first **Context Federation and Governance Layer** for AI agents, projects, and workspaces.

AI Workspace (`aiw`) gives a repository one canonical place for agent knowledge — `.ai/` — and treats Cursor, Claude, Codex, and custom-agent files as **adapters** of that layer, not as the source of truth. **Agent Skills** (`SKILL.md`) is an interoperable artifact format that AI Workspace can store, inherit, and project. AI Workspace does not replace that format.

**Status: Phase 6 complete; Phase 7A architecture gate.** The public CLI covers init, inheritance, declarative agents, export, federated sources, import, promote, sync, and multi-project `--all`. Phase 7A adds Agent Skills interoperability documentation and types. There is no Skill CLI yet.

Repository: [github.com/kamranshalilian/AI-Workspace](https://github.com/kamranshalilian/AI-Workspace)

## Why this exists

Coding agents each want project context in a different place: `.cursor/`, `CLAUDE.md`, `AGENTS.md`, and more. Teams copy the same rules into every native format. That duplicates knowledge, creates vendor lock-in, and falls apart across an **AI project workspace** with several repositories.

AI Workspace inverts that:

```text
Human / Developer
        │
        ▼
  AI Workspace (.ai/)     ← canonical federation + governance
        │
   Resolution → Effective Context
        │
   ┌────┼────┐
   │    │    │
Cursor Codex Claude       ← generated native interfaces
```

`.ai/` is the Git-diffable source of truth. Native files are projections you can regenerate.

## What you get

- **Canonical `.ai/`** — rules, architecture, skills, decisions, and workflows in one tree
- **Agent Skills** — `.ai/skills/<name>/SKILL.md` as the standard artifact; not a proprietary Skill format
- **Cursor / Claude / Codex context** from the same files, without vendor-specific core code
- **Custom agents** as YAML definitions (`aiw agent create`)
- **Workspace federation** — register projects and run `aiw status --all`, `export --all`, `sync --all`
- **Sources / import / promote / export / sync** — reference external knowledge, snapshot it, and compare related representations without last-write-wins

## Install

Requires Node.js 20 or newer.

```bash
npm install -g @empratur256/ai-workspace
```

The package name is `@empratur256/ai-workspace`. The CLI is `aiw`. After global install it works from any directory; project state stays in that project's `.ai/`.

```bash
aiw --help
aiw --version
```

## Quick start

```bash
cd your-project
aiw init --name my-project
```

Add canonical context (this is the AI developer-tools layer agents will share):

```bash
mkdir -p .ai/rules
echo "Do not commit secrets." > .ai/rules/security.md
```

Enable bundled agents and write native files:

```bash
aiw agent add cursor
aiw agent add claude
aiw agent add codex
aiw export
aiw status
```

That produces Cursor rules, `CLAUDE.md`, and `AGENTS.md` from the same `.ai/rules/security.md`. Edit the canonical file, then `aiw export` again.

```text
create = create an agent definition
add    = register/enable it in the manifest
export = materialize native output
```

## Canonical `.ai/` layout

`aiw init` writes only `manifest.yaml`. Everything else is optional and created by you or by later commands:

```text
.ai/
├── manifest.yaml          # contract (required after init)
├── rules/                 # shared AI context
├── architecture/
├── skills/                 # Agent Skills collection (SKILL.md)
├── decisions/
├── workflows/
├── agents/                # local YAML definitions (optional)
├── sources/               # imported snapshots (after aiw import)
└── state/                 # sync hashes (Git-ignored)
```

Native files live **outside** `.ai/` and are never canonical:

```text
.cursor/rules/             # Cursor context (adapter output)
CLAUDE.md                  # Claude context (adapter output)
AGENTS.md                  # Codex context (adapter output)
```

## Agents without lock-in

Bundled definition ids: `cursor`, `claude`, `codex`. They are YAML data, not TypeScript branches.

```bash
aiw agent list
aiw agent create my-agent
aiw agent add my-agent
aiw export --agent my-agent
aiw agent remove cursor          # unregister only; native files stay
```

A file at `.ai/agents/<id>.yaml` shadows a bundled definition with the same id. If Cursor disappeared tomorrow, `.ai/` would still be valid; a new agent would be another definition, not a core rewrite.

## Sources, import, promote, and sync

A **source** is a federated reference. Registration does not copy, import, or execute anything.

```bash
aiw source add knowledge --type directory --path ./docs --capabilities read,index,import
aiw import --source knowledge
aiw sync --source knowledge
aiw promote --agent cursor
```

| Command | Meaning |
| --- | --- |
| `source add` | Register a path in the manifest |
| `import` | Snapshot Source → `.ai/sources/<id>/` |
| `export` | Canonical `.ai/` → native agent files |
| `promote` | Native artifact → canonical `.ai/` (reversible mappings only) |
| `sync` | State-aware comparison (`clean`, `canonical-changed`, `external-changed`, `conflict`) |

`aiw sync` is report-only unless you pass `--apply`. `--apply` never last-write-wins and never writes into a live source. Concatenated files such as `CLAUDE.md` cannot be promoted.

## Multi-project workspace

A workspace registry is **not** inheritance. Registering a project only means it belongs to this workspace. Inheritance stays explicit via `extends`.

```bash
aiw init --kind workspace --name company-workspace
aiw project add accounting ./accounting
aiw project add wallet ./wallet
aiw project list
aiw status --all
aiw export --all
aiw sync --all
```

```yaml
specVersion: 1
kind: workspace
name: company-workspace

projects:
  accounting:
    path: ./accounting
  wallet:
    path: ./wallet
```

`--all` iterates the registry. It does not scan the filesystem. Each project keeps its own `.ai/` and native files. `export --all` does not export the workspace `.ai/` as if it were a project.

A project inherits workspace context only when its own manifest says so:

```yaml
specVersion: 1
kind: project
name: accounting

extends:
  - path: ../.ai
    mode: extend
```

See the [CLI](https://github.com/kamranshalilian/AI-Workspace/blob/main/docs/cli/README.md) and [scope, inheritance, and resolution](https://github.com/kamranshalilian/AI-Workspace/blob/main/docs/specification/03-scope-inheritance-resolution.md).

## Current status

Phase 6 is complete: specification through workspace federation. Phase 7A documents Agent Skills as an interoperable artifact and adds architecture tests. No Skill marketplace, CLI, or execution engine.

Implemented: `init`, `status`, `validate`, `doctor`, `agent create|add|remove|list|status`, `export`, `source add|list|remove`, `import`, `promote`, `sync`, `project add|list|remove`, and `--all` on status, validate, doctor, export, and sync.

Not in this release: Skill registry CLI, plugins, MCP execution, cloud sync, GUI, automatic project discovery, or `import --all` / `promote --all`.

### Limitations

- Concatenated and reference-index native files cannot be promoted
- `sync --apply` may refresh an imported snapshot; it never writes the live source
- `--all` requires `kind: workspace` (pass `--path` to the workspace root)
- Source content is not fed into agent export
- No executable adapters or plugins
- Skill scripts under `.ai/skills/` are never executed
- No dedicated `aiw skill` commands

## Support

Donations are optional and help fund continued development of AI Workspace.

**USDT** (optional)

```text
0x4430DA48ad0bF37583262966097E7AC76482b83A
```

Issues and discussion: [github.com/kamranshalilian/AI-Workspace/issues](https://github.com/kamranshalilian/AI-Workspace/issues)

## Documentation

| Area | Location |
| --- | --- |
| Specification | [docs/specification/](https://github.com/kamranshalilian/AI-Workspace/tree/main/docs/specification) |
| Architecture | [docs/architecture/](https://github.com/kamranshalilian/AI-Workspace/tree/main/docs/architecture) |
| Agent Skills | [docs/architecture/agent-skills.md](https://github.com/kamranshalilian/AI-Workspace/blob/main/docs/architecture/agent-skills.md) |
| Positioning | [docs/strategy/positioning.md](https://github.com/kamranshalilian/AI-Workspace/blob/main/docs/strategy/positioning.md) |
| CLI | [docs/cli/](https://github.com/kamranshalilian/AI-Workspace/tree/main/docs/cli) |
| Integrations | [docs/integrations/](https://github.com/kamranshalilian/AI-Workspace/tree/main/docs/integrations) |

## Development

```bash
git clone https://github.com/kamranshalilian/AI-Workspace.git
cd AI-Workspace
npm install
npm test
npm run build
```

This repository dogfoods itself as `kind: project` under `.ai/`.

## License

MIT. See [LICENSE](https://github.com/kamranshalilian/AI-Workspace/blob/main/LICENSE).
