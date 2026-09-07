# Phase 0 — Specification Review

**Date:** 2026-09-07  
**Repository:** `AI-Workspace`  
**Status:** Draft, awaiting approval. No production code has been written.

This is the required gate before Phase 1.

---

## 1. Current repository state

Inspected `/home/Kamran/Documents/AI-Workspace`.

| Item | Finding |
| --- | --- |
| Git | Initialized, branch `main`, **no commits** |
| Remote | `git@github.com:kamranshalilian/AI-Workspace.git` (empty) |
| Source | None (`package.json`, `src/`, tests: absent) |
| `.ai/` | Absent |
| README | Absent before this phase; added as Phase 0 product docs |
| Existing spec | None; this review and `docs/specification/` are the first contract |

The working tree before Phase 0 was an empty Git repository. There is no legacy Cursor-centered design to unwind. That is an advantage: the architecture can be agent-agnostic from the first line of code.

Phase 0 added **documentation only** (README + `docs/**`). It did not add TypeScript, a CLI, or `.ai/`.

---

## 2. Proposed architecture

**Canonical layer:** `.ai/` + `manifest.yaml`  
**Computation:** resolution snapshot (inheritance, excludes, security)  
**Downstream:** declarative agent definitions → generic adapter/format engines → native files  
**Federation:** sources as typed path references, not copies  
**Control plane (later):** workspace `projects:` registry for `--all`

```text
.ai (canonical)
   │
   ├─ Manifest
   ├─ Knowledge resources
   ├─ Source references
   └─ Agent instances
          │
          ▼
   Resolution (effective snapshot)
          │
          ▼
   Adapter engine (generic)
          │
          ▼
   Native interfaces (per definition)
```

Layers stay separate: Core, Manifest, Resolution, Filesystem, Agent loader, Adapter engine, Source, CLI.

Cursor is the first **bundled definition** (if approved), not the center of the design.

Normative detail: [system architecture](system.md) and the [specification](../specification/).

---

## 3. Identified ambiguities

These were present in the master prompt and are now given proposed answers. See [open decisions](open-decisions.md) for the approval list.

| Ambiguity | Tension | Proposed resolution |
| --- | --- | --- |
| Auto-discover parent vs explicit `extends` | Convenience vs clone/determinism | Explicit `extends` only |
| Multiple parents | Power vs diamond merges | Single parent in v1 |
| File-level vs scope-level override | Spec lists extend, override, disable | `extend` (child-wins per identity) + `replace` + `disable` + `exclude` |
| Do sources inherit? | Shared Graphify vs surprising paths | Inherit in `extend` mode |
| Commit generated native files? | Works without `aiw` vs Git noise | Commit; deterministic bytes |
| Bundled Cursor/Claude/Codex | Looks like hardcoding vs useful UX | Bundle **YAML data**, never TS branches |
| `kind: workspace` on a single-package repo | Dogfood vs honesty | Dogfood this repo as `project`; workspace shown in examples |
| Init extra files | Doctor needs gitignore vs Scenario A | Manifest only |
| Concatenated `AGENTS.md` round-trip | Import vs promote | Import as snapshot; promote explicit and limited |
| `repository` source | Clone vs local-first | Local path only; no fetch |
| Executable adapters | Extensibility vs security | Forbidden in v1 |
| Global user config | Shared personal agents vs Git-first | None in v1 |
| Walking the filesystem for projects | Magic vs safety | Registry only; doctor may *suggest* immediate children |
| Missing workspace when project cloned alone | Fail vs silent isolate | Fail validation |

---

## 4. Risks

| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| Format engines become vendor dumps | Breaks the architectural test | Closed v1 engine list; new engines need spec changes and must be generic |
| Generated files fight hand-edited `.cursor` | Data loss or constant conflicts | Unmanaged files never overwritten; exit 3 |
| Line endings / Git autocrlf | Hashes and Scenario J | Doctor recommends `.ai/** eol=lf`; hashes are of working-tree bytes |
| `extends: ../.ai` breaks solo clones | False “empty context” or hard fail | Hard fail; document workflows |
| Exclusion list is incomplete | Secrets ingested | Configurable union; skip binaries/size; doctor warnings |
| Scope creep into MCP/embeddings | Unships the filesystem MVP | Phase plan + “what not to build” |
| Bundled definitions mistaken for core | Future PRs add `src/adapters/cursor.ts` | Test: grep core for vendor behavior; definitions live under `definitions/` |
| Windows junction/symlink | Non-portable repos | Default `generated`; no silent fallback |
| Inheritance implemented as copy | Unreversible override | Spec forbids copy; tests use two trees |
| Promote too early | Silent semantic conversion | Phase 5 + explicit flag |

---

## 5. Decisions that need to be made

**You must choose:** license.

**You should confirm or replace the defaults** in [open decisions](open-decisions.md): single parent, source inheritance, committing generated natives, bundled YAML ids, init shape, Node 20, package name `ai-workspace`, no executable adapters, dogfood as `project`.

**Already decided in the specification (not reopened unless you object):**

- `.ai` is canonical; agents are downstream
- No vendor `if` in core
- Declarative adapters first; no plugin ABI in v1
- Federation by reference
- Semantic inheritance
- Local-first, Git-first
- Non-destructive writes
- Linux/macOS/Windows first-class without assuming symlinks
- Task context, cloud, embeddings, MCP, GUI: out of scope

---

## 6. Final proposed manifest schema

Normative: [Manifest](../specification/02-manifest.md).

Compact form:

```yaml
specVersion: 1
kind: project                 # or workspace
name: accounting
description: "optional"

extends:                      # 0 or 1 entry
  - path: ../.ai              # from scope root
    mode: extend              # extend | replace | disable
    exclude:
      - rules/legacy.md

context:
  include:                    # default: well-known kinds
    - context/**
    - rules/**
    - skills/**
    - roles/**
    - architecture/**
    - decisions/**
    - workflows/**
  exclude: []

sources:
  graphify:
    type: directory           # directory | file | repository | generated
    path: ../.graphify
    capabilities: [read, index]

agents:
  cursor:
    enabled: true
    definition: cursor
    adapter:
      strategy: generated     # generated | copy | reference | symlink | junction

projects:                     # workspace only
  accounting:
    path: ./accounting

policies:
  exclusions: []              # unioned with built-ins
  maxFileBytes: 1048576
  trust:
    executableAdapters: false
    executableSources: false
```

Agent definitions are separate YAML (`kind: agent-definition`), not inlined as executable logic. See [agents and adapters](../specification/05-agents-adapters.md).

---

## 7. Final proposed CLI surface

Binary: `aiw`

**Phase 1:** `init`, `status`, `doctor`, `validate`, `--help`, `--version`  
**Phase 2:** `agent add|remove|list|status`, `export`  
**Phase 3:** `agent create`  
**Phase 4:** `source add|list|remove`  
**Phase 5:** `import`, `sync`  
**Phase 6:** `project add|list|remove`, `--all`, `agent enable|disable`

Global: `--path`, `--json` (inspection commands), `--quiet`, `--verbose`.

No `aiw cursor`. No `aiw adapter`. No `aiw workspace` noun in v1.

Normative: [CLI contract](../specification/07-cli.md).

---

## 8. Final proposed repository structure

See [repository structure](repository.md).

Phase 1 first code additions should be approximately:

```text
package.json
tsconfig.json
src/cli/
src/manifest/
src/filesystem/
src/config/
src/resolution/
src/core/
tests/unit/
tests/fixtures/
```

`definitions/agents/` arrives in Phase 2. `examples/` can arrive when CLI exists. `.ai/` dogfood after schema approval, recommended at the start of Phase 1 so the project uses its own manifest even before agents exist.

---

## 9. Acceptance tests

Scenarios A–J and the concept matrix are normative in [acceptance](../specification/09-acceptance.md).

Phase 1 minimum:

- parse/validate manifests
- init creates only `manifest.yaml`
- nearest-root discovery; exit 4 when missing
- resolution extend/replace/disable with temp fixtures
- child-wins identity merge; exclude list
- cycle error; missing parent error
- security exclusions skip `.env` and key-like names
- `--json` status/doctor/validate
- POSIX identities; `\` normalization helper

Later phases add agent export non-destruction, source federation without copy, import snapshot, `--all` registry.

---

## 10. Implementation plan

1. **Wait for approval** of this review and open decisions (especially license).
2. **Phase 1:** package skeleton, schema types, parser, discovery, resolver, init/status/doctor/validate, unit+temp-dir tests. Optionally create this repo’s `.ai/manifest.yaml` and start ADRs.
3. **Phase 2:** definition loader, four format engines, export, bundled YAML, Scenario B/C tests.
4. **Phase 3:** `agent create`, Scenario H test (new id, zero core edits).
5. **Phase 4:** sources, Graphify/spec-kit *fixtures*, Scenario G.
6. **Phase 5:** import/sync/conflicts, Scenario I.
7. **Phase 6:** registry and `--all`, Scenarios D–F as CLI as well as resolver tests.

If an implementation choice would change a rule above: stop, patch the specification, then continue.

---

## Architectural test (declared answers)

**If Cursor disappeared and a new agent appeared, could AI Workspace support it without modifying the core?**  
**YES**, by adding a YAML definition that uses existing format engines. **Caveat:** a genuinely new *format family* needs a generic engine + spec bump.

**If Graphify disappeared and another knowledge system replaced it, could AI Workspace support it without modifying the core?**  
**YES**, as a `directory` / `file` / `repository` / `generated` source.

**If one workspace contained 20 independent repositories, could they share common AI context while retaining project-specific context?**  
**YES**, via workspace `.ai` + per-project `.ai` + `extend`/`replace`/`disable` + `projects:` registry.

---

## Stop

Phase 0 is complete as a **draft for review**.

Do not start Phase 1 production implementation until this specification is approved.
