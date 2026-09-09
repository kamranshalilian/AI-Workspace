# Skill registry

**Status:** Phase 7B. Manifest metadata only. No Skill CLI.

The Skill registry answers *which Skills are declared* in a scope. It does not replace Agent Skills, and it does not own Skill bodies.

```text
SKILL.md          →  canonical artifact
skills: in manifest →  metadata / reference
Effective Skill Set →  what is actually effective after resolution
```

## Why it exists

Agent Skills describes a package on disk. It does not catalog which Skills a workspace has enabled, whether an artifact is missing, or that a project disabled an inherited Skill.

The registry is that catalog. It lives in `.ai/manifest.yaml` next to `agents:`, `sources:`, and `projects:`. There is no `.ai/registry.yaml` or `.ai/skills-registry.yaml`.

## Schema

```yaml
skills:
  code-review: {}
  security-review:
    enabled: false
  vendor-review:
    source: vendor-code-review
```

| Field | Type | Default | Meaning |
| --- | --- | --- | --- |
| *(map key)* | Skill id | required | Registry identity. Same portable id rules as agent ids. Maps to `.ai/skills/<id>/SKILL.md` when canonical. |
| `enabled` | boolean | `true` | Child-wins like `agents.enabled`. |
| `source` | source id | omitted | Federated reference. Omitted means canonical. |

There is no `description`, `body`, `name`, `version`, `author`, or marketplace field. Those either belong to `SKILL.md` or to a future phase.

Omitted `skills:` is an empty registry. Canonical `SKILL.md` files still participate in the Effective Skill Set (the registry is additive).

## Registry vs `SKILL.md`

The registry never duplicates Skill content. Parse still requires Agent Skills `name` and `description` on the artifact.

Two identities are preserved, not collapsed:

| Identity | Source |
| --- | --- |
| Registry id | Manifest map key / directory name |
| Agent Skills `name` | `SKILL.md` frontmatter |

They usually match. Core does not rewrite the artifact if they differ. There is no third identity.

## Registry vs Effective Skill Set

| | Registry | Effective Skill Set |
| --- | --- | --- |
| Question | What is declared/known? | What is actually effective? |
| Includes disabled | yes (`status: disabled`) | no |
| Includes missing | yes (`status: missing`) | no |
| Includes invalid | yes (`status: invalid`) | no |
| Includes unregistered canonical `SKILL.md` | no | yes (additive) |
| Includes federated-only Skills | yes | no (not copied into `.ai/skills/`) |

## Identity

Skill ids are filesystem-independent registry keys. Invalid: `../evil`, `/foo`, `C:\foo`, `.`, `..`. A valid id maps safely to `.ai/skills/<id>/SKILL.md`.

## Lifecycle statuses

After interpretation against the resolved snapshot:

```text
resolved   declared, enabled, artifact exists and parses
missing    declared, enabled, artifact or source not found
invalid    declared, enabled, SKILL.md fails Agent Skills parse, or source id is unknown
disabled   declared with enabled: false
```

One invalid Skill does not prevent siblings from resolving. Scripts are never executed.

## Provenance

Reuse existing origin/hash data. Derived `originKind`:

| Kind | Meaning |
| --- | --- |
| `canonical` | Declared and originating in the active scope’s `.ai/` |
| `inherited` | Same artifact/declaration from a parent scope |
| `external` | Registry `source:` points at a federated source |

This is not a second provenance system. `canonical: true` still means “lives under some `.ai/`”, including inherited Skills.

## Version metadata

Version is read from the artifact (`metadata.version` or `version`) when present. Display form is `id@version`. No version remains `id`. The registry does not pin, compare, install, or upgrade versions.

## Inheritance

There is no Skill-specific inheritance engine. `skills:` merges like `agents:` using the existing chain:

- `extend`: union, same id → child wins
- `replace` / `disable`: parent registry is not merged
- resource `exclude` still omits `skills/<id>/SKILL.md` from the snapshot

## External Skills

```yaml
sources:
  vendor-code-review:
    type: directory
    path: ./vendor-skills/code-review
    capabilities: [read, index]
skills:
  code-review:
    source: vendor-code-review
```

Registration does not import, copy, or create `.ai/skills/`. Import remains Phase 5 and explicit.

## Security

Registry presence is not execution permission. `scripts/` are never run. `policies.trust.executableAdapters` and `executableSources` remain `false`.
