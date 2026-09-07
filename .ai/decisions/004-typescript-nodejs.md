# ADR-004 — Why TypeScript/Node.js

## Status

Accepted

## Context

The CLI must run on Linux, macOS, and Windows with a portable filesystem API and strict types.

## Decision

Implement AI Workspace in TypeScript on Node.js 20 LTS+, distributed as ESM, with `aiw` as the binary.

## Consequences

- Use Node `path`/`fs` rather than POSIX-only assumptions
- Tests run with `node:test`
- No extra web framework
