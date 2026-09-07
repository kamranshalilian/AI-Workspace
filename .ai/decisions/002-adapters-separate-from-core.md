# ADR-002 — Why adapters are separate from core

## Status

Accepted

## Context

Hard-coding named agents in core (`if agent === …`) requires a release for every new tool and fails the architectural test.

## Decision

Core implements generic manifest, filesystem, resolution, and (later) declarative adapter engines. Agent behavior lives in definition data, not TypeScript branches.

## Consequences

- New agents can be added as YAML
- A new format family still needs a generic engine and a spec change
- Tests forbid vendor names in core modules
