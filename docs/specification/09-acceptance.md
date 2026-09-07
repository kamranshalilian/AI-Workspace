# Acceptance criteria and tests

The architecture is acceptable only if scenarios A–J remain possible. Tests must not depend on a developer’s real machine layout. Use temporary directories and fixtures.

## Scenarios

### A — Init

```bash
aiw init
```

Result:

```text
.ai/
└── manifest.yaml
```

No other files or directories are required.

### B — Canonical knowledge consumed by an adapter

Adding `.ai/rules/security.md` allows an enabled agent adapter to consume it (Phase 2 export).

### C — Two agents, one canonical copy

Cursor and Claude (or any two definitions) consume the same `.ai/rules/security.md`. Canonical knowledge is not duplicated.

### D — Workspace inheritance

Workspace contains `accounting`, `wallet`, `frontend`. Each extending project sees workspace context plus its own.

### E — Override / replace

A project can replace inherited knowledge (`mode: replace`, or same-identity file in `extend` mode).

### F — Disable inheritance

A project can set `mode: disable` (or omit `extends`) and see only local context.

### G — Graphify as a source

Graphify is registered as a generic `directory` source. Core TypeScript does not mention Graphify.

### H — User-defined agent

`aiw agent create` writes `.ai/agents/<id>.yaml`. After the user edits mappings, `aiw agent add` + `aiw export` register a new agent without modifying core.

### I — Import is non-destructive

Native artifacts can be imported into `.ai/sources/…` without deleting or silently converting the original.

### J — Cross-platform semantics

Linux and Windows produce semantically equivalent resolution and generated output.

## Test obligations by concept

| Concept | Phase | Notes |
| --- | --- | --- |
| Manifest parse | 1 | Valid, invalid, unknown keys, duplicate keys |
| Manifest validation | 1 | kinds, names, reserved includes, trust flags |
| Scope detection | 1 | nearest `.ai`, none found → exit 4 |
| Workspace discovery | 6 | `--all` uses registry only |
| Project discovery | 6 | `project add/list`, missing path warning |
| Inheritance extend | 6 (unit in 1 if fixtures allow) | union + child-wins |
| Replace | 6 | parent resources absent |
| Disable | 6 | no parent merge |
| Resolution | 1 | snapshot identities, hashes, origins |
| Cycles | 1 | error |
| Missing parent | 1 | error for extend/replace |
| Source loading | 4 | directory/file, unresolved, no copy |
| Agent discovery | 2 | search order: local, parent, bundled |
| Adapter validation | 2 | mapping collisions, unknown engine |
| Filesystem ops | 1–2 | temp dirs, POSIX identities |
| Cross-platform paths | 1 | `\` normalization, generated `\n` |
| Conflict detection | 5 | unmanaged native, hash mismatch |
| Security exclusions | 1 | `.env`, key patterns skipped |
| CLI behavior | 1+ | exit codes, `--json`, init shape |

Phase 1 must already test merge helpers with **in-memory / fixture parent+child trees**, even if workspace CLI (`--all`) waits until Phase 6. Inheritance is a core resolution feature; delaying tests until Phase 6 is too late.

## Fixture rules

- Tests create temp directories
- No access to `~/.cursor`, real credentials, or the host workspace except copied fixtures
- Windows-specific strategies may be skipped on non-Windows with an explicit skip reason; path semantics tests must still run everywhere

## Architectural tests (manual review)

Before implementation of a phase is declared done, re-ask:

1. Could a new agent be supported without modifying core? (YAML + existing format engines)
2. Could a new knowledge directory be a source without modifying core?
3. Could 20 registered projects inherit workspace context?

If a pull request adds `if (id === "cursor")` or `if (id === "graphify")` to core, it fails this specification.
