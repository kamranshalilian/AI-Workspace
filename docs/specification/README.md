# AI Workspace Specification

**Status:** Phase 0 draft. Awaiting review and approval before Phase 1 implementation.

**Spec version described:** `1`

This directory is the normative product contract. Architecture documents explain *why* and *how the codebase will be shaped*. This specification defines *what the system must do*.

If implementation would violate a rule here, stop, update this specification, then continue.

## Documents

| Document | Contents |
| --- | --- |
| [01 — Terminology](01-terminology.md) | Canonical vocabulary |
| [02 — Manifest](02-manifest.md) | `manifest.yaml` schema |
| [03 — Scope, inheritance, resolution](03-scope-inheritance-resolution.md) | Workspace/project model and effective context |
| [04 — Sources](04-sources.md) | Federated knowledge references |
| [05 — Agents and adapters](05-agents-adapters.md) | Declarative agent/adapter model |
| [06 — Filesystem](06-filesystem.md) | Paths, strategies, Git, generated files |
| [07 — CLI](07-cli.md) | `aiw` command contract |
| [08 — Security](08-security.md) | Exclusions, trust, non-execution defaults |
| [09 — Acceptance](09-acceptance.md) | Scenarios A–J and test obligations |

Related:

- [Architecture](../architecture/)
- [Phase 0 review](../architecture/phase-0-review.md)
- [Open decisions](../architecture/open-decisions.md)

## Non-negotiable rules

1. `.ai` is the canonical source of AI project/workspace knowledge.
2. Agent-native files are adapters/consumers, never the center of the design.
3. Core logic must not hard-code named vendors (`cursor`, `claude`, `codex`, `graphify`, `spec-kit`).
4. Inheritance is semantic (manifest/resolution), never uncontrolled filesystem copying.
5. Sources are federated by reference. Copying is opt-in, never required.
6. The system is local-first. No cloud service is required.
7. Behavior that executes code requires explicit trust.
8. User artifacts are never silently overwritten or deleted.
9. Linux, macOS, and Windows are first-class. Symlinks are not assumed.
10. The same repository + manifest + definitions should produce deterministic output whenever practical.

## Architectural test

The specification is valid only if all three answers are **yes**:

1. If Cursor disappeared and a new agent appeared, could AI Workspace support it without modifying the core?
2. If Graphify disappeared and another knowledge system replaced it, could AI Workspace support it without modifying the core?
3. If one workspace contained 20 independent repositories, could they share common AI context while retaining project-specific context?

Proposed answers, and the residual caveats, are recorded in the [Phase 0 review](../architecture/phase-0-review.md).
