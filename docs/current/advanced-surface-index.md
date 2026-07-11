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

## Dormant Source References

The following programming reference directories remain in repository source to
preserve their internal paths and history. They are advanced/dormant source
material, not part of the Java-first front-door or current npm package:

```text
packages/shared-skills/skills/programming/references/go/
packages/shared-skills/skills/programming/references/python/
packages/shared-skills/skills/programming/references/rust/
packages/shared-skills/skills/programming/references/rust-ub/
packages/shared-skills/skills/programming/references/typescript/
```

The related multi-language LSP setup tree remains source-only advanced material:

```text
packages/shared-skills/skills/lsp-setup/references/
```

No reference content is deleted or moved by this index. The current package
allowlist includes the Java reference directory and excludes the dormant
programming and LSP reference trees. Do not add these paths to npm package
contents merely to make them easier to discover.

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

## Source-Only Agent Driver

`packages/shared-skills/skills/advanced/superpowers-driver/SKILL.md` is a
repository-only manual driver for compatible coding agents. In a prepared
project it directs an agent to `npx ph go "<concrete implementation goal>"`,
the emitted rail, plaintext `npx ph workflow finish implement`, and
`npx ph workflow closure next --json` only as structured guidance.

The driver is not selected by the runtime router, is not packaged, and does not
create a hook, default, auto-spawn path, or host-specific enforcement. It cannot
verify reports, weaken PH closure/check/finish gates, auto-finish work, or
certify generated applications.

## Boundaries

This is a discoverability and documentation classification change only. It does
not change product/runtime/default/schema/version/release/publish behavior,
Java rules, package contents, or LEAN state. It makes no support, efficacy,
quality, reliability, token-saving, enforcement, delegation, or certification
claim.
