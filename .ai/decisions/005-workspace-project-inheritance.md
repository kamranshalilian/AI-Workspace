# ADR-005 — Why workspace/project inheritance exists

## Status

Accepted

## Context

Organizations keep shared rules next to many repositories. Copying those rules into each project makes override and disable irreversible.

## Decision

A child manifest may `extend` a single parent `.ai`. Resolution merges semantically (`extend` / `replace` / `disable`). Files are not copied between trees.

## Consequences

- Missing parents are errors
- Cycles are errors
- A project cloned without its workspace must change `extends` explicitly
