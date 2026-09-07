# ADR-003 — Why sources are federated rather than copied

## Status

Accepted

## Context

External knowledge trees (generated docs, other checkouts, tool output directories) go stale if copied into `.ai/`.

## Decision

Sources are named references with a type, path, and capabilities. Resolution records them; Phase 1 does not copy or execute them.

## Consequences

- No duplication on `init` / `status` / `doctor`
- Missing source paths are unresolved (doctor fails, validate does not)
- Executable generation is forbidden in v1
