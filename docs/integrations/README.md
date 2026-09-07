# Integrations

**Status:** Architectural policy. No runtime integrations are implemented.

AI Workspace does not give any vendor or tool a privileged core module.

## Agents

Agents consume `.ai` through **declarative definitions** (YAML) and a generic adapter engine.

Illustrative native interfaces:

| Agent (example) | Typical native interface |
| --- | --- |
| Cursor | `.cursor/rules/` |
| Codex | `AGENTS.md` |
| Claude | `CLAUDE.md` |

These paths belong in definition files, not in `if` statements.

User-defined agents: add YAML, then `aiw agent add` / `aiw agent create` once those commands exist.

See [Agents and adapters](../specification/05-agents-adapters.md).

## Sources

Sources are federated references.

| Tool (example) | How it should appear |
| --- | --- |
| Graphify | `type: directory` (or `generated`) pointing at `.graphify` |
| spec-kit | `type: directory` pointing at its spec tree |
| Another repository | `type: repository` + local path |
| Generated docs | `type: generated` + path to output |

No Graphify parser and no spec-kit parser belong in core.

See [Sources](../specification/04-sources.md).

## Adding a new integration later

1. Prefer a YAML agent definition or a source entry.
2. If that is impossible, propose a **generic** format engine or source type in the specification.
3. Do not patch core with a vendor-named module.
