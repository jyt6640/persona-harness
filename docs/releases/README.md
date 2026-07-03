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

- [`v0.6.0-rc.1`](v0.6.0-rc.1/README.md): prerelease `next` registry smoke,
  Stage 1-14 package-runtime facts, and current post-rc1 measurement pointers.
