# ADR-001 — Why `.ai` is canonical

## Status

Accepted

## Context

Coding agents each have native files (for example agent-specific directories or root markdown files). If those files are treated as the source of truth, every new agent duplicates knowledge and the project becomes vendor-centered.

## Decision

`.ai/` is the canonical AI knowledge and contract layer. Agent-native files are adapters/consumers of that layer.

## Consequences

- One Git-diffable source of knowledge
- Multiple agents can consume the same resources
- Core must not treat any vendor path as canonical
