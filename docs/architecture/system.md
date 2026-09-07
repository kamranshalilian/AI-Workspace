# System architecture

## Purpose

AI Workspace is a filesystem + manifest + resolution + adapter layer.

It is not a model host, not a cloud service, and not a Cursor plugin.

```text
                    Human / Developer
                           │
                           ▼
                    ┌──────────────┐
                    │ AI Workspace │
                    └───────┬──────┘
                            │
                         .ai/
                            │
             ┌──────────────┼──────────────┐
             │              │              │
          Context         Rules          Skills
             │              │              │
       Architecture     Decisions      Workflows
             │              │              │
          Sources         Roles        Knowledge
             │              │              │
             └──────────────┼──────────────┘
                            │
                     Resolution Layer
                            │
             ┌──────────────┼──────────────┐
             │              │              │
          Cursor          Codex          Claude
          Adapter         Adapter         Adapter
             │              │              │
        .cursor/        AGENTS.md      CLAUDE.md
```

Those three agents are illustrations. The boxes are **instances of Agent**, not subsystems.

## Layering

```text
┌─────────────────────────────────────────────┐
│ CLI (`aiw`)                                 │
├─────────────────────────────────────────────┤
│ Commands: init, status, doctor, agent, …    │
├─────────────────────────────────────────────┤
│ Core                                        │
│  ├─ config/paths                            │
│  ├─ manifest parse + validate               │
│  ├─ filesystem (POSIX identities, globs)    │
│  ├─ security exclusions                     │
│  ├─ resolution (inheritance merge)          │
│  ├─ sources (generic types)                 │
│  ├─ agent definition loader                 │
│  └─ adapter engine + format engines         │
├─────────────────────────────────────────────┤
│ Data                                        │
│  ├─ user manifests and knowledge            │
│  └─ bundled agent definition YAML           │
└─────────────────────────────────────────────┘
```

## Data flow

### Status / validate / doctor

```text
cwd → discover root → parse manifests → resolve snapshot → print
```

Read-only.

### Export

```text
snapshot → load definitions → mappings → format engines →
  non-destructive write of native files
```

### Source add

```text
CLI args → validate type/path → write manifest.sources
```

No copy.

## Extension model (v1)

Configuration-driven, not a plugin ABI.

| Extension | Mechanism |
| --- | --- |
| New agent | YAML definition + `aiw agent add` |
| New source | `type: directory\|file\|repository\|generated` |
| New format | Specification + core format engine (rare) |
| New scope behavior | Specification change |

Do not build a plugin marketplace, dynamic `require()` of user JS, or MCP in v1.

## Why adapters are not core vendor modules

If Cursor-specific code lives in `src/adapters/cursor.ts`, the architectural test fails the moment a fourth agent appears.

Bundled YAML plus a generic engine keeps Cursor as data. The first reference adapter in Phase 2 is still Cursor **from the user's point of view** (`aiw agent add cursor`), but the implementation is “load definition id cursor”.

## Why sources are federated

Copying Graphify, spec-kit, or another repo into `.ai/` creates drift and Git noise. The manifest stores a path and capabilities. The files stay where their tool put them.

## Why inheritance is resolved, not copied

Copying workspace rules into every project makes override/disable impossible to reverse and explodes diffs. Resolution keeps a single workspace copy and a computed snapshot.

## Runtime

- TypeScript, Node.js, ESM
- Strict types
- Schema validation of manifests and definitions
- Deterministic serialization of generated output
- Tests via temporary directories

Library choices are implementation details provided they stay mature and light. Do not introduce a web framework, ORM, or AI SDK.

## Out of scope (all MVP phases)

Cloud sync, hosted service, central database, models, vectors, embeddings, semantic search, MCP server, executable plugin marketplace, remote registry, automatic AI-generated rules, automatic semantic rewriting, GUI.
