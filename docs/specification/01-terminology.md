# Terminology

Words below are normative. Do not use them interchangeably.

## Product and CLI

| Term | Meaning |
| --- | --- |
| **AI Workspace** | The product. A local-first Context Federation and Governance Layer for AI agents, projects, and workspaces. |
| **`aiw`** | The CLI binary. |
| **Specification** | This document set. Manifests declare `specVersion` against it. |
| **Core** | Tool-agnostic libraries: manifest, filesystem, resolution, validation, security. |
| **CLI layer** | User-facing commands. Depends on core. Contains no vendor-specific logic. |

## Scopes

| Term | Meaning |
| --- | --- |
| **Workspace** | A parent directory with `kind: workspace` whose `.ai` may govern many projects. |
| **Project** | A directory with `kind: project` representing one repository or project tree. |
| **Scope** | Either `workspace` or `project`. |
| **Root** | The directory that contains `.ai/`. Also called the **scope root**. |
| **Active root** | The nearest scope root discovered from the current working directory (or an explicit `--path`). |
| **Workspace root** | The root of a `kind: workspace` manifest. |

A workspace root may itself contain knowledge, agents, and sources. It is not a second kind of project. See [scope model](03-scope-inheritance-resolution.md).

## Canonical layer

| Term | Meaning |
| --- | --- |
| **`.ai/`** | Canonical AI Workspace directory at a scope root. |
| **Manifest** | `.ai/manifest.yaml`. Authoritative machine-readable contract for that scope. |
| **Resource** | A canonical knowledge file participating in resolution (rules, architecture, …). |
| **Resource kind** | The first path segment under `.ai/` for a knowledge file, e.g. `rules`. |
| **Resource identity** | `kind` + POSIX relative path, e.g. `rules/security.md`. Unique within a resolved snapshot. |
| **Effective context** | The resolved set of resources, sources, agents, and policies for a scope. |
| **Agent Skills** | External artifact standard (`SKILL.md`, `name`, `description`). Not an AI Workspace format. |
| **Skill artifact** | A standard Agent Skills package, typically `.ai/skills/<id>/SKILL.md`. |
| **Effective Skill Set** | Deterministic Skill subset of effective context after inheritance and registry enablement. Not a runtime. |
| **Skill registry** | Optional `skills:` map on the manifest. Metadata/reference only; not a Skill format. |
| **Skill trust** | Governance label: `untrusted`, `reviewed`, or `trusted`. Does not execute scripts. |

## Inheritance and resolution

| Term | Meaning |
| --- | --- |
| **Extends** | Manifest relationship pointing at a parent `.ai`. |
| **Extend mode** | Union parent and child resources. Same identity: child wins. |
| **Replace mode** | Child knowledge only. Parent resources are not merged. |
| **Disable mode** | No inheritance. Equivalent to omitting a usable parent. |
| **Exclude** | Identities omitted from an otherwise extended parent. |
| **Resolution** | Pure function from filesystem + manifests → effective context. |
| **Chain** | Ordered list of loaded manifests from furthest parent to active child. |

## Agents and adapters

| Term | Meaning |
| --- | --- |
| **Agent** | A named consumer of canonical context (human-configured, not a hardcoded enum). |
| **Agent definition** | Declarative YAML describing capabilities, native paths, and adapter mapping. |
| **Bundled definition** | Agent definition shipped as data with the CLI package. Not TypeScript branches. |
| **Adapter** | Translation from canonical resources to a native agent interface. |
| **Adapter engine** | Core interpreter of declarative mappings (`declarative` in v1). |
| **Format engine** | Generic transformer used by mappings (`identity`, `markdown-frontmatter`, …). |
| **Native interface** | Files/directories an agent already understands (`.cursor/`, `AGENTS.md`, …). |
| **Native artifact** | One file in a native interface. |
| **Provenance** | Metadata recording that a native artifact was generated from a canonical resource. |

## Sources

| Term | Meaning |
| --- | --- |
| **Source** | A named federated reference to knowledge outside canonical files. |
| **Source type** | `directory`, `file`, `repository`, or `generated` in spec v1. |
| **Capability** | Declared operation a source supports (`read`, `index`, …). |
| **Federation** | Referencing external data without copying it into `.ai/`. |

## Import, promote, sync

| Term | Meaning |
| --- | --- |
| **Import** | Bring a native artifact into `.ai` as a **source snapshot**, preserving the original file. |
| **Promote** | Convert an imported or native artifact into a canonical resource. Explicit, never silent. |
| **Export** | Write canonical resources through an adapter into a native interface. |
| **Sync** | Compare canonical and native, report (and later optionally reconcile) divergence. |
| **Unmanaged native file** | A native artifact with no AI Workspace provenance. Must not be overwritten. |
| **Conflict** | Canonical and native both differ from the last known exported state, or native is unmanaged when export is requested. |

## Filesystem and Git

| Term | Meaning |
| --- | --- |
| **Integration strategy** | How an adapter materializes native files: `generated`, `copy`, `reference`, `symlink`, `junction`. |
| **POSIX path** | Forward-slash path stored in manifests and identities. |
| **Generated output** | Adapter-produced native files. Deterministic for a given snapshot. |
| **State** | Local bookkeeping (hashes, last export). Not canonical knowledge. |
| **Cache** | Disposable derived data. Never required for correctness of a clean checkout. |

## Security

| Term | Meaning |
| --- | --- |
| **Exclusion** | Glob/pattern that prevents a file from being ingested or exported. |
| **Trust policy** | Manifest flags that allow otherwise forbidden executable behavior. |
| **Executable behavior** | Running a user- or source-provided command, script, or plugin. |

## Out of scope terms (v1)

Do not implement or document as if they exist:

- Task context
- Remote registry
- Hosted control plane
- Embeddings / vector index
- MCP server
- Executable plugin marketplace
- Proprietary replacement for `SKILL.md`
