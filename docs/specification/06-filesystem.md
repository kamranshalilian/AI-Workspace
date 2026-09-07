# Filesystem contract

Linux, macOS, and Windows are first-class.

## Canonical directory

```text
<scope-root>/.ai/
├── manifest.yaml          # required after init
├── agents/                # optional definition overrides
├── sources/               # optional imported snapshots
├── context/               # optional knowledge
├── rules/
├── skills/
├── roles/
├── architecture/
├── decisions/
├── workflows/
├── cache/                 # disposable, not created by init
└── state/                 # local bookkeeping, not created by init
```

No directory except the parent `.ai/` is required. `init` creates `.ai/manifest.yaml` only.

Implementations may create `cache/` and `state/` on first use.

## Path conventions

| On disk / OS | In manifests, identities, provenance |
| --- | --- |
| Platform paths | POSIX (`/`) |

Rules:

- CLI arguments may use `\` on Windows; writers normalize to POSIX in YAML.
- Resolution uses Node platform APIs (`path` / `fs`) after converting POSIX → native.
- Identities always POSIX.
- Comparisons of real paths use `fs.realpath` when the path exists.

## Well-known kinds vs reserved

Knowledge (optional): `context`, `rules`, `skills`, `roles`, `architecture`, `decisions`, `workflows`, plus any extra included kinds.

Reserved: `manifest.yaml`, `agents/`, `sources/`, `state/`, `cache/`.

## Integration strategies

See [Agents and adapters](05-agents-adapters.md). Default portable strategy is `generated`.

Symlinks and junctions are opt-in and must fail clearly when unsupported.

## Generated and native files

Adapters write **outside** `.ai/` into native locations declared by the definition.

Canonical files remain the source of truth.

Determinism:

- Same snapshot + same definition + same strategy → same native bytes
- UTF-8
- Newlines in generated files: `\n`
- Resource order for concatenation: `kind` then `identity` (POSIX lexicographic)
- YAML frontmatter serialization: sorted keys, 2-space indent, no extra wrapping

## State and cache

```text
.ai/state/     # last export hashes, optional
.ai/cache/     # disposable
```

Neither is required for a clean checkout to resolve or to regenerate native files from canonical content.

**Git:** doctor recommends ignoring `/.ai/cache/` and `/.ai/state/` in the repository `.gitignore`. `init` does not write a `.gitignore` (keeps Scenario A: only `manifest.yaml`).

## Git

AI Workspace is Git-first.

**Should normally be versioned:**

- `.ai/manifest.yaml`
- canonical knowledge files
- `.ai/agents/*.yaml`
- imported snapshots under `.ai/sources/` if the team wants them shared

**Should normally not be versioned:**

- `.ai/cache/`
- `.ai/state/`

**Native generated files** (`.cursor/rules/*.mdc`, `AGENTS.md`, `CLAUDE.md`):

Default policy proposal: **commit them**. Teams without `aiw` still get agent-native files. Generation must be deterministic to avoid noisy diffs.

Alternative: gitignore generated natives and require `aiw export` locally. See [open decisions](../architecture/open-decisions.md).

Do not store machine-local absolute paths in versioned files.

## Cross-platform semantics

Commands must produce **semantically equivalent** snapshots and generated content on Linux and Windows:

- Same identities
- Same hashes of canonical files (hashes are of bytes; checkout line-ending conversion can break this — doctor recommends `.gitattributes` `*.md text eol=lf` under `.ai/` and generated markdown)

Proposal: recommend in doctor:

```text
.ai/** text eol=lf
```

Scenario J is **semantic** equivalence (identities, merge results, generated text with `\n`), not identical raw bytes if Git has already converted a working tree.

## File safety

- Do not follow directory traversal beyond explicit `extends` / `source.path` / native `to` templates
- `projects[].path` must stay inside the workspace root
- Mapping `to` templates must not resolve outside the **active scope root** in v1 (native files live in the project/workspace being exported)
- Refuse to export into `.git/`
- Apply [security exclusions](08-security.md) to canonical files, source trees, and import sources
- Skip binaries (NUL in first 8 KiB)
- Skip files larger than `policies.maxFileBytes`

## Init filesystem behavior

`aiw init` in an empty project:

1. If `.ai/` exists → fail unless `--force` (non-destructive default)
2. Create `.ai/`
3. Write `manifest.yaml`
4. Do not create knowledge directories, agents, sources, cache, or state

`--force` may overwrite `manifest.yaml` only when it is missing required fields or the user confirmed; Phase 1 `--force` overwrites `manifest.yaml` and still does not delete other files. Document this as dangerous.

## Tests

Filesystem tests use temporary directories only. They must not touch the developer's home directory or this repository's real `.ai/` except as a fixture copy.

Cross-platform tests should cover:

- POSIX path storage
- Windows-style CLI input normalization (can be simulated on Linux)
- `generated` strategy
- refused symlink fallback
