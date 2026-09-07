# Development rules

- `.ai` is canonical. Do not treat agent-native files as the source of truth.
- Do not add vendor-named branches in `src/core`, `src/manifest`, `src/resolution`, `src/filesystem`, or `src/config`.
- Do not execute commands because a source or adapter exists.
- Phase gates are binding: do not implement the next phase without explicit approval.
- If implementation would change an architectural rule, update the specification first.
