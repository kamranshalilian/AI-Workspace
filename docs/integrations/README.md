# Integrations

**Status:** Phase 6 ships bundled **YAML** agent definitions, a generic adapter engine, `aiw agent create`, generic federated **sources**, import, promote, state-aware sync, and registry-driven **workspace federation**. Phase 7A treats **Agent Skills** as an external artifact standard. No vendor-specific TypeScript modules exist.

AI Workspace does not give any vendor or tool a privileged core module.

## Agents

Agents consume `.ai` through **declarative definitions** (YAML) and a generic adapter engine.

Bundled definition data (not Core code):

| Definition id | Native interface (from YAML) | Format engine |
| --- | --- | --- |
| `cursor` | `.cursor/rules/{{stem}}.mdc` | `markdown-frontmatter` |
| `claude` | `CLAUDE.md` | `concatenated-markdown` |
| `codex` | `AGENTS.md` | `concatenated-markdown` |

These paths belong in definition files, not in `if` statements.

Project-local definitions may be created with `aiw agent create <id>` (writes `.ai/agents/<id>.yaml` only) and registered with `aiw agent add <id>`.

See [Agents and adapters](../specification/05-agents-adapters.md).

## Adapter engine

```text
Canonical .ai → Resolution → Agent definition → Adapter engine → Format engine → Native files
```

Format engines are generic: `identity`, `markdown-frontmatter`, `concatenated-markdown`, `reference-index`.

Managed files start with:

```html
<!--
aiw-provenance:
  specVersion: 1
  ...
-->
```

Export updates managed files and refuses to overwrite files that lack this marker.

## Sources

Sources are federated references. `aiw source add|list|remove` registers them in the manifest without copying. `.ai/sources/` is not created until import (Phase 5).

See [Sources](../specification/04-sources.md).

## Workspaces

A workspace is `kind: workspace` plus a `projects:` registry. `--all` iterates that registry. Inheritance still requires explicit `extends` on each project. No vendor- or source-specific federation code exists.

## Agent Skills

Skills are canonical files, preferably `.ai/skills/<id>/SKILL.md`. They are not a Core vendor engine.

- Interoperate with Agent Skills; do not fork `SKILL.md`
- Inherit and exclude Skills like any other resource
- Register an external Skill directory as a generic **source** without copying
- Export remains the generic adapter path
- Never execute Skill `scripts/`

See [Agent Skills architecture](../architecture/agent-skills.md).

## Adding a new integration later

1. Prefer a YAML agent definition or a source entry.
2. If that is impossible, propose a **generic** format engine or source type in the specification.
3. Do not patch core with a vendor-named module.
