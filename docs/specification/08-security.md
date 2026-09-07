# Security

AI Workspace reads trees that may sit next to secrets. Default behavior is refuse, skip, and never execute.

## Built-in exclusions

Applied to:

- canonical knowledge collection
- source indexing
- import inputs

Patterns are matched against POSIX relative paths and against basenames.

Built-in set (v1):

```text
.env
.env.*
*.pem
*.key
*.p12
*.pfx
id_rsa
id_ed25519
*credential*
*credentials*
*secret*
*secrets*
*token*
*tokens*
```

These are **not** claimed to be complete. They are a conservative baseline.

Manifest `policies.exclusions` are **unioned** with this set. v1 cannot remove a built-in pattern.

Skipped files do not appear as resources. Doctor can list skip counts.

## Size and binary

- Default `maxFileBytes`: 1048576
- Binary: NUL byte in the first 8192 bytes → skip
- Symlink targets are evaluated after realpath for exclusion matching

## Trust and execution

Defaults:

```yaml
policies:
  trust:
    executableAdapters: false
    executableSources: false
```

In spec v1 both must be `false`. Setting `true` is a validation error.

Consequences:

- Presence of a source never runs a command
- Agent definitions cannot declare `engine: executable`
- No post-init hooks
- No plugin loader

Future executable behavior requires:

1. Specification change
2. Explicit trust in the **active** manifest
3. Most-restrictive merge along the inheritance chain

## Write boundaries

Export `to` paths must resolve inside the active scope root.

Forbidden targets:

- `.git/**`
- paths outside the active scope root
- canonical `.ai/` knowledge files (adapters must not rewrite canonical resources)

Import writes only under `.ai/sources/<id>/`.

`init` writes only `.ai/manifest.yaml` (and the `.ai/` directory).

## Non-destruction

Never:

- overwrite unmanaged native files
- delete native files on agent remove (v1)
- delete source trees
- rewrite canonical files during export
- promote (semantic convert) without `--promote`

Conflicts exit `3` and report paths.

## Secrets in `.ai/`

Canonical files are intended to be committed. Doctor should warn if an excluded name exists under `.ai/` even though it will be skipped — the file should not be there.

## Local-only

No telemetry requirement. No network calls in Phase 1–3 core paths.

`repository` sources do not fetch remotes in v1.

## Prompt injection / untrusted knowledge

Not fully solvable in a filesystem layer. v1 obligations:

- Do not execute content
- Do not silently merge untrusted source bodies into native agent files until Phase 4 export of sources is specified with the same exclusions
- Phase 1 does not feed sources into adapters

When source export is added, the same exclusions and size/binary checks apply, and the specification must be updated before implementation.
