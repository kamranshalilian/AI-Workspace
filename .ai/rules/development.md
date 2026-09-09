# Development rules

- `.ai` is canonical. Do not treat agent-native files as the source of truth.
- Do not add vendor-named branches in `src/core`, `src/manifest`, `src/resolution`, `src/filesystem`, `src/config`, or `src/skills`.
- Do not redefine `SKILL.md`. Treat Agent Skills as an external artifact standard.
- Do not execute commands because a source, adapter, or Skill exists.
- Phase gates are binding: do not implement the next phase without explicit approval.
- If implementation would change an architectural rule, update the specification first.
