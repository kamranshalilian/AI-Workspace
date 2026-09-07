# Repository structure

This is the **target** layout. Phase 0 only adds documentation. Do not create empty `src/` trees until Phase 1.

```text
AI-Workspace/
├── .ai/                          # dogfood; not in Phase 0
├── src/
│   ├── core/
│   ├── cli/
│   ├── manifest/
│   ├── resolution/
│   ├── agents/                   # definition loading
│   ├── adapters/                 # generic engine + format engines
│   ├── sources/
│   ├── filesystem/
│   └── config/
├── definitions/
│   └── agents/                   # bundled YAML (data)
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── filesystem/
│   ├── cross-platform/
│   └── fixtures/
├── docs/
│   ├── specification/
│   ├── architecture/
│   ├── integrations/
│   └── cli/
├── examples/
│   ├── single-project/
│   └── multi-project/
├── package.json
├── tsconfig.json
├── README.md
├── LICENSE
└── CONTRIBUTING.md
```

## Module ownership

| Path | Owns | Must not own |
| --- | --- | --- |
| `src/manifest` | Parse, types, schema validate | FS writes, adapters |
| `src/filesystem` | Path normalize, glob, read, atomic write | Merge policy |
| `src/config` | Constants, default exclusions, spec version | Vendor names as behavior |
| `src/resolution` | Chain, merge, snapshot | Native file generation |
| `src/sources` | Source types, capability checks | Agent mappings |
| `src/agents` | Definition search and parse | `if cursor` |
| `src/adapters` | Mapping interpreter, format engines | CLI |
| `src/core` | Facade composing the above | `process.argv` |
| `src/cli` | argv, output, exit codes | Schema rules duplicated ad hoc |

Exact folder nesting (`core/` wrapping others vs siblings) may be adjusted in Phase 1 as long as import rules hold.

## Package

Proposed:

- npm name: `ai-workspace` (see open decisions)
- `bin.aiw` → compiled CLI entry
- `"type": "module"`
- `engines.node`: see open decisions
- TypeScript `strict` + `moduleResolution: NodeNext`

## Dogfooding

After schema approval, this repository gets `kind: workspace` or `kind: project` `.ai/` describing its own architecture, rules, and decisions (ADR-style files under `.ai/decisions/` as specified).

Phase 0 does **not** create `.ai/` yet, because the schema is not approved.

ADR topics already identified (to write when dogfooding starts):

- ADR-001 — Why `.ai` is canonical
- ADR-002 — Why adapters are separate from core
- ADR-003 — Why sources are federated rather than copied
- ADR-004 — Why TypeScript/Node.js
- ADR-005 — Why workspace/project inheritance exists
