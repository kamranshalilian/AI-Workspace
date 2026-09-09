# Positioning

**Status:** Phase 7A strategic repositioning.

## Statement

AI Workspace is a **local-first Context Federation and Governance Layer** for AI agents, projects, and workspaces.

It is not an Agent Skills host, marketplace, or vendor runtime.

```text
Agent Skills
    =
artifact / interoperability format

AI Workspace
    =
management / federation / governance layer
```

More fully:

> AI Workspace is a local-first Context Federation and Governance Layer for AI agents. It provides a canonical workspace model for context, rules, skills, architecture, decisions and external sources, while interoperating with open agent standards such as Agent Skills rather than replacing them.

Do not overclaim. This release does not discover, install, execute, or rank Skills. It documents the split, represents standard `SKILL.md` as canonical content, and derives an Effective Skill Set from existing resolution.

## What Agent Skills already solves

Agent Skills (the public `SKILL.md` model) already gives ecosystems a shared **artifact**:

- directory-shaped Skill packages
- required `name` and `description`
- optional `scripts/`, `references/`, `assets/`
- a format Claude, Codex, Cursor, Copilot, and others can consume or emit

AI Workspace must not fork that contract.

## What Agent Skills does not solve

These gaps are the product moat. They are **documented** in Phase 7A; most are not implemented as runtime.

### A. Skill registry

Workspace/project catalog:

```text
id, name, version, source, provenance, status, trust
```

Agent Skills describes a package on disk. It does not catalog which Skills a company workspace has enabled.

### B. Skill versioning

Deterministic identity such as `security-review@1.2.0`. Reuse ordinary version strings (semver when present). Do not invent a parallel version format.

### C. Skill dependencies

Model graphs (`wallet-development` depends on `evm`, `security-review`, `postgres`). Do not install dependencies until explicitly approved.

### D. Skill composition

Deterministic Effective Context:

```text
Project Context + Rules + Architecture + Skills + Sources
        ↓
Effective Context
        ↓
Effective Skill Set (Skill subset)
```

No LLM composition in Core.

### E. Workspace inheritance

Agent Skills has no workspace→project `extend` / `replace` / `disable` / `exclude`. AI Workspace already does. Skills must keep using that model.

### F. Source federation

A Skill can live in an external directory or repository. Registration must not copy. Source-of-truth stays with the source until import/promote.

### G. Skill lifecycle

Discover, register, validate, trust, import, enable, export, update, disable, remove — as governance, not as a Skill VM. See [skill-lifecycle.md](../concepts/skill-lifecycle.md).

### H. Trust / security

Scripts in a Skill are untrusted by default. Policy concepts (`allow scripts`, `deny network`) belong here. Phase 7A does not sandbox or execute.

### I. Conflict / synchronization

Phase 5 remains authoritative. Never silently overwrite. Never automatic semantic merge. Never LLM conflict resolution.

## Independent value

AI Workspace creates value **around** Agent Skills, not instead of them:

1. Canonical `.ai/` for all knowledge kinds, not only Skills
2. Explicit inheritance across workspace and project
3. Generic source federation
4. Declarative agent adapters (projection without Core vendor branches)
5. Import / promote / export / state-aware sync
6. Future Skill registry, trust, and dependency *models* that Agent Skills does not attempt

## What this phase must not become

Marketplace, cloud registry, MCP server, embeddings, Skill execution engine, proprietary `SKILL.md` replacement, user-global `.ai`, automatic discovery, workspace nesting, or Phase 8.

## Roadmap implication

Ship the governance layer incrementally. Keep Agent Skills as the artifact. Keep adapters generic. See the Phase 7 implementation notes in [phase-plan.md](../architecture/phase-plan.md).
