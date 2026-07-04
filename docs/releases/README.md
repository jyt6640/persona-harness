# Versioned Release Docs

Versioned release docs preserve facts that should not drift as `docs/current/`
changes during roadmap work.

## Policy

- Put durable release facts, registry smoke summaries, measurement summaries,
  and caveats under `docs/releases/v<version>/`.
- Keep `docs/current/` as a small working pointer area for active decisions,
  status indexes, and files that maintenance checks still read directly.
- Keep `docs/current/release/v<version>-release-notes.md` as the release-note
  source used by release operations. A versioned release capsule may link to
  that file and summarize it, but should not silently replace it.
- Prefer append-only correction, summary, or migration pointers over deleting
  old status files. Delete historical files only after checking repo policy and
  tests.
- Registry evidence is recorded only after registry gitHead/shasum, tag, and
  External smoke verification. Local-current evidence remains local-current
  evidence until a future publish covers the target commit.

## Releases

- [Package version index](package-index.md): chronological package/version
  timeline from undocumented early rows through the current `0.6.0-rc.2`
  prerelease.
- [`v0.6.0-rc.2`](v0.6.0-rc.2/README.md): current prerelease `next` registry
  smoke capsule. `latest` remains `0.5.0` and `alpha` remains
  `0.3.9-alpha.8`.
- [`v0.6.0-rc.1`](v0.6.0-rc.1/README.md): prerelease `next` registry smoke,
  Stage 1-14 package-runtime facts, and current post-rc1 measurement pointers.

## Inventory Relationship

The full docs inventory lives at
[`docs/current/docs-inventory.md`](../current/docs-inventory.md). Files marked
as version-specific but still located under `docs/current/` are compatibility
records. Summarize them into a version capsule before moving them.
