# Open decisions

Phase 0 was approved on 2026-09-07. The following decisions are **accepted** and implemented in Phase 1 (where they apply).

## License

MIT.

## Accepted defaults

1. Single parent only (`extends` is 0 or 1 entry).
2. Sources are inherited in `extend` mode; paths resolve from the declaring root.
3. Generated native files will be committed by default (adapter work is Phase 2).
4. Bundle `cursor`, `claude`, and `codex` as YAML **data**. Core still has no vendor branches.
5. `aiw init` writes only `manifest.yaml`.
6. `projects[].path` may leave the workspace (`../accounting` or absolute). Identity stays the registry key; paths resolve from the workspace root.
7. Missing parent is an error.
8. Node.js 20 LTS or newer.
9. Package name `ai-workspace`, binary `aiw`.
10. Test runner: `node:test`.
11. Executable adapters omitted; `trust.*: true` is invalid in v1.
12. No user-global config.
13. Promote is Phase 5 and always explicit.
14. This repository dogfoods as `kind: project`.
15. Agent Skills (`SKILL.md`) is an external interoperable artifact. AI Workspace does not replace it. Phase 7A is documentation, types, and architecture tests only.

## Residual architectural caveat

A new format family that cannot be expressed with the generic engines requires a specification change and a core format engine. That is the only honest exception to “no core change for a new agent.”
