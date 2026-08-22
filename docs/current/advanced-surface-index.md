# Advanced Surface Index

Status: repository-only advanced and dormant-source index. This page is not a
quick-start guide, a package support contract, or evidence that a dormant
surface is supported product functionality.

## Java-First Package Boundary

The active packaged programming reference set is Java:

```text
packages/shared-skills/skills/programming/references/java/
```

The runtime shared-skill router selects the generic programming skill, and the
Role Checklist Relay detail reference points to the Java testing reference. This
index does not change either runtime behavior.

## Removed Dormant References

The former multi-language programming, LSP, workflow-driver, and other dormant
reference trees are not part of the candidate source boundary. They were removed
under the [source provenance audit](../evidence-reviews/2026-08-22-source-provenance-audit.md)
because their source provenance did not provide a redistributable grant for this
repository. Git history remains the historical record; the active source and
package boundary does not retain those paths.

Future advanced reference material must be authored independently or introduced
with a recorded compatible license, required notices, and a deliberate product
scope decision. The Java reference directory remains the only active packaged
programming reference set.

## Preview And Advanced Operations

Role Checklist Relay is an advanced preview/main-session checklist surface:

- `ph bootstrap backend --multi-agent-preview` is the bootstrap exposure. It
  writes the preview guidance and can configure the named role agents.
- `multiAgent` in `.persona/harness.jsonc` is the compatibility config name.
- `ph workflow relay status|next|validate --json` is the explicit operational
  surface and is described as read-only preview output.
- The generated preview guidance names `npx ph workflow relay next --json` as
  the procedure entry. Its detailed historical caveats remain in
  `multiagent-relay-trial-status.md`.
- Host subagent invocation remains optional and host-dependent. This index does
  not claim automatic relay orchestration, a runtime default, or a compatibility
  rename.

Root `ph --help` does not expose this relay surface; P0-3 root CLI discovery
remains unchanged.

Developer MCP, CodeGraph, and LSP bootstrap previews are advanced operations,
not Quick Start prerequisites. The established flags are:

```text
ph bootstrap backend --codegraph-preview
ph bootstrap backend --lsp-preview
ph bootstrap backend --runtime-injection-preview
ph bootstrap backend --no-developer-mcp
```

Their availability handling remains unchanged. Runtime injection remains parked
and opt-in. Root CLI discovery remains the P0-3 public surface; this index does
not change it.

For evidence history and detailed caveats, use:

- `docs/current/multiagent-relay-trial-status.md`
- `docs/current/ci-finish-contract.md`
- `docs/current/ci-evidence-reverification-design.md`
- `docs/current/canonical-docs-index.md`
- `docs/evidence-reviews/2026-08-22-source-provenance-audit.md`

## Retired Source-Only Agent Driver

The former source-only methodology driver was removed with the dormant
reference material. There is no installed or repository-only driver at that
path, and this index makes no claim about its historical behavior.

## Boundaries

This is a discoverability and documentation classification change only. It does
not change product/runtime/default/schema/version/release/publish behavior,
Java rules, package contents, or LEAN state. It makes no support, efficacy,
quality, reliability, token-saving, enforcement, delegation, or certification
claim.
