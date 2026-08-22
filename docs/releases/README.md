# Versioned Release Docs

This directory preserves version facts that must not drift while current
planning changes. It is a history and evidence catalog, not live registry
state or release authorization.

## Start Here

- [Package/version index](package-index.md) is the chronological version map.
- [Release operations](../current/release/README.md) is the current operator
  entrypoint, including live lookup links and immutable-tag policy.
- Versioned release notes record each release's own immutable facts. They do
  not establish the current npm dist-tag or GitHub Release after later
  publication.
- Historical prerelease channels remain in the
  [package/version index](package-index.md).

## Policy

- Put durable release facts, registry smoke summaries, measurement summaries,
  and caveats under `docs/releases/v<version>/` when a capsule is required.
- Keep `docs/current/` small: it should point to active decisions and release
  operations, not repeat every historical result.
- Keep `docs/current/release/v<version>-release-notes.md` as the source used by
  release operations. A capsule may summarize that file but must not silently
  replace it.
- Registry evidence is recorded only after the required registry, tag, and
  independent verification boundaries complete. A local or source fact never
  becomes registry evidence by being linked here.

## Existing Capsules

- [`v0.7.0-rc.3`](v0.7.0-rc.3/README.md): published npm `next` candidate with
  matching registry, tag, GitHub prerelease, and workflow provenance.
- [`v0.7.0` release notes](../current/release/v0.7.0-release-notes.md):
  published stable-release record; no separate capsule is retained here.
- [`v0.6.0`](v0.6.0/README.md): earlier stable registry-smoke capsule.
- Earlier release-candidate capsules remain listed in
  [package-index.md](package-index.md).

## Inventory Relationship

The exhaustive classification of all documents, including retained compatibility
files still under `docs/current/`, lives in
[`docs/current/docs-inventory.md`](../current/docs-inventory.md). Files marked
historical there remain history even when they are package-visible.
