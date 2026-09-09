# Scope, inheritance, and resolution

## Scope model

AI Workspace has two scopes.

### Workspace

A directory whose `.ai/manifest.yaml` has `kind: workspace`.

Typical layout:

```text
workspace/
├── .ai/
│   └── manifest.yaml
├── accounting/
│   └── .ai/
├── wallet/
│   └── .ai/
└── frontend/
    └── .ai/
```

The workspace may contain canonical knowledge that projects inherit. It may also register projects for central commands.

### Project

A directory whose `.ai/manifest.yaml` has `kind: project`.

Typical layout:

```text
accounting/
├── .ai/
│   └── manifest.yaml
└── src/
```

### What v1 does and does not include

MVP effective context:

```text
workspace context + project context + agent integration
```

**Not in v1:** task-specific context.

A workspace is not also a project. If the workspace root is itself a code repository (dogfooding AI Workspace), `kind: workspace` is correct: that repository's `.ai` is workspace-scoped knowledge.

## Discovery

From a starting directory (cwd or `--path`):

1. Walk upward, directory by directory.
2. The first directory containing `.ai/manifest.yaml` is the **active root**.
3. Stop. Do not keep walking for the active command unless a workspace operation requires it.

If none is found, commands other than `init` fail with exit code `4`.

To target the enclosing workspace from inside a project:

- Prefer running from the workspace root, or
- Pass `--path` to the workspace root (for example `aiw status --all --path /workspace`).

`--all` and `aiw project …` require the active scope to be `kind: workspace`. They do not keep walking from a project `.ai/` up to a parent workspace.

v1 Phase 1 commands operate on the active root only.

## Inheritance is semantic

Never implement inheritance by copying parent files into a child `.ai/`.

The child manifest **declares** a parent. Resolution **computes** an effective snapshot. Child files remain in the child; parent files remain in the parent.

## Extends modes

Given a child with:

```yaml
extends:
  - path: ../.ai
    mode: extend
    exclude:
      - rules/legacy.md
```

### `extend` (default)

1. Resolve and load the parent chain.
2. Merge knowledge resources, sources, agents, and policies as specified below.
3. Omit identities listed in `exclude`.

Same resource identity: **child wins**.

### `replace`

Parent resources, sources, and agents are **not** merged.

The parent path is still validated (unless later relaxed). Status may show `inheritance: replace`.

Use this when a project is in the workspace for management (`projects:` registry) but must not inherit knowledge.

### `disable`

No parent load. No merge. Status shows `inheritance: disable`.

Use this when a project must be fully isolated even if a parent `.ai` exists on disk.

Omitting `extends` is equivalent to disable for merge purposes, with no declared parent.

## Merge rules

Walk the chain from furthest parent to active child. Apply child last.

### Resources

Identity = `kind` + `/` + POSIX path relative to that kind directory.

Example: `.ai/rules/security.md` → `rules/security.md`.

| Situation | Result |
| --- | --- |
| Only parent has identity | Included, origin = parent |
| Only child has identity | Included, origin = child |
| Both have identity | Child file used (`extend`) |
| Parent identity listed in child `exclude` | Omitted |
| File matches security/context exclude | Omitted |
| File exceeds `maxFileBytes` | Omitted from snapshot; doctor warning |
| File is binary (NUL in first 8 KiB) | Omitted from snapshot; doctor warning |

`replace` and `disable` skip parent resources entirely.

### Skills

Skills are resources. Standard Agent Skills artifacts use identity `skills/<id>/SKILL.md`.

They follow the same table as resources. The **Effective Skill Set** is that subset after merge, minus registry `enabled: false`. It is not a second resolver and not a Skill runtime.

The optional `skills:` manifest map is merged like `agents:` (child-wins). That merge uses the same chain; it is not a parallel inheritance engine. See [Skill registry](../concepts/skill-registry.md) and [Agent Skills](10-agent-skills.md).

### Sources

**Proposed default (needs approval):** sources **are inherited** in `extend` mode.

- Same source id: child object replaces parent object entirely.
- Paths in a source are resolved against the **declaring** scope root, then stored as absolute resolved paths in the snapshot.
- `replace` / `disable`: parent sources are not inherited.

Rationale: a workspace-level Graphify or shared docs directory should be available to every extending project without copying the declaration.

If a source path is missing, resolution succeeds and the snapshot records the source as `unresolved`. Doctor fails.

### Agents

Inherited in `extend` mode.

- Same instance id: child object replaces parent object.
- Child may disable an inherited agent:

```yaml
agents:
  cursor:
    enabled: false
    definition: cursor
```

- `replace` / `disable`: parent agents are not inherited.

Adapter export still happens in the **active** scope root (the project), not in the workspace, unless the command is targeting the workspace itself.

### Policies

- `exclusions`: union of the chain, plus built-in defaults. More patterns = safer.
- `maxFileBytes`: minimum (most restrictive) along the chain.
- `trust.*`: any `false` wins. In v1 all values are `false`.

## Resolution algorithm

Pure function. No writes. No network. No command execution.

```text
resolve(startDir) → EffectiveSnapshot
```

1. Discover `activeRoot` and read its manifest. Validate.
2. Build `chain`:
   - If no extends or mode `disable`: `[active]`
   - If mode `replace`: `[active]` (parent not merged; optional diagnostic load is allowed but must not affect resources)
   - If mode `extend`: recursively load parent, detect cycles, then `parentChain + [active]`
3. For each manifest in chain order, collect included files under that `.ai/`.
4. Apply excludes, security exclusions, size and binary checks.
5. Merge resources, sources, agents, policies using the rules above.
6. Return the snapshot.

The snapshot is the only input later phases need for export, status, and doctor.

## Effective snapshot (logical shape)

Not a required on-disk format. Implementations may use equivalent TypeScript types.

```text
EffectiveSnapshot
  specVersion: 1
  active:
    kind, name, root, manifestPath
  chain:
    - { kind, name, root, mode }
  resources:
    - { identity, kind, relativePath, absolutePath, originRoot, hash }
  sources:
    - { id, type, declaredPath, resolvedPath, originRoot, capabilities, status }
  agents:
    - { id, definitionId, enabled, strategy, definitionPath, originRoot }
  policies:
    exclusions[], maxFileBytes, trust
  issues:
    - { severity, code, message, path? }
```

`hash` is SHA-256 of raw file bytes. Used later for sync detection.

## Workspace registration vs inheritance

These are independent.

| Project state | Registered in workspace `projects:` | Child `extends` workspace |
| --- | --- | --- |
| Fully federated | yes | extend |
| Managed, isolated knowledge | yes | replace or disable, or no extends |
| Inherits, not centrally listed | no | extend |
| Isolated and unknown to workspace | no | no extends |

`--all` commands use **registration only**. They do not scan the filesystem for unregistered projects.

## Cloning a project alone

If a project manifest contains `extends.path: ../.ai` and that path does not exist (cloned without the workspace), **resolution fails validation**.

That is intentional: the manifest asked for a parent. Silent isolation would hide missing context.

Workflows:

- Clone the workspace, or
- Change `mode` to `disable` / remove `extends` in that clone, or
- Later (not v1): optional `extends.optional: true`

Do not auto-skip missing parents in v1.

## Cycle and boundary rules

- Real-path cycle → error
- Parent manifest `kind` may be `workspace` or `project`. v1 does not require the parent to be a workspace. A project may extend another project. This supports nested repos. Doctor warns if a project extends another project rather than a workspace, because that is unusual.
- `extends.path` may use `..`. Source paths may use `..`. Registered `projects[].path` may use `..` or an absolute path; identity remains the registry key, and paths are resolved from the workspace root.
