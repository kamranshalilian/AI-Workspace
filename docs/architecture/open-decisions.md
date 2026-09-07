# Open decisions

These items need explicit approval (or an explicit “use the proposed default”).

Phase 1 must not start until the Phase 0 review is approved. Defaults below are what will be implemented if you accept the review as-is, except **license**, which must be chosen.

## Must choose

### License

No license file yet.

Options: MIT, Apache-2.0, or another license you specify.

**No default will be committed without your choice.**

## Proposed defaults (approve or change)

### 1. Single parent only

`extends` is 0 or 1 entry. No diamond inheritance in v1.

### 2. Sources are inherited

In `extend` mode, parent `sources` merge into the child (child id wins). Paths resolve from the declaring root.

### 3. Generated native files are committed

Adapters default to `strategy: generated`. Teams are expected to commit `.cursor/rules`, `AGENTS.md`, `CLAUDE.md` so clones work without `aiw`.

### 4. Bundle three YAML definitions

Ship `cursor`, `claude`, and `codex` as package **data**. Core still has no vendor branches.

### 5. Init writes only `manifest.yaml`

Matches Scenario A. Cache/state gitignore is a doctor suggestion, not an init file.

### 6. `projects[].path` cannot leave the workspace

No `..` in registry paths in v1.

### 7. Missing parent is an error

A clone of a project without its workspace fails resolution until `extends` is disabled or the workspace is present.

### 8. Node.js

Require Node 20 LTS or newer.

### 9. Package name

Publish/name the package `ai-workspace` with binary `aiw`.

### 10. Test runner

Use `node:test` plus TypeScript compilation (or `tsx`) rather than a heavy framework.

### 11. Executable adapters omitted

v1 schema rejects `engine: executable` and `trust.*: true`.

### 12. No user-global config

No `~/.config/ai-workspace` in v1. Project and workspace only.

### 13. Promote is Phase 5 and always explicit

No silent markdown conversion from `.mdc` to `.md`.

### 14. Workspace is not a project

`kind` is one value. The AI Workspace repo itself should eventually use `kind: workspace` or `kind: project` — recommendation: **`project` until examples of multi-repo exist, then this repo stays `project`** because it is a single package. Dogfood as `kind: project`.

Reconsider if you want this repository to demonstrate workspace layout internally via `examples/multi-project` only.

## Residual architectural caveat (not a vote)

A **new format family** that cannot be expressed with `identity`, `markdown-frontmatter`, `concatenated-markdown`, or `reference-index` requires a specification change and a core format engine. That is the only honest exception to “no core change for a new agent.”
