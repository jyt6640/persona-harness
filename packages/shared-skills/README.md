# Persona Shared Skills

This package-internal bundle is the portable Persona Harness skill core. Its
authoritative index is [`catalog.json`](./catalog.json).

Core sequence: `deep-interview` -> `technical-intake` -> `plan` -> optional
`ralplan` -> `tdd` -> `implementation` -> `review`. `programming`, `debug`,
`refactor`, and `git` provide bounded supporting guidance. `frontend`,
`visual-qa`, `ast-grep`, and `lsp-setup` are explicit optional overlays.
`philosophy-refinement` is a separate explicit-only core procedure; it never
starts from ordinary chat, code inspection, a direct implementation request, or
one-off code preference.
`grill-me` is a separate conversation-only decision stress test. It can start
automatically only when a concrete decision, design, or plan is paired with a
pressure-test signal such as assumptions, alternatives, risks, or trade-offs.

An explicit `/persona <skill-id>` command wins routing. Otherwise clear direct
work uses its matching supporting skill. An enabled host routing layer may
select `deep-interview` for an ambiguous product request only after its own
initialized-project and request predicates pass; catalog discovery alone never
starts it. The durable `ph interview` CLI is separately explicit/default-off.
`grill-me` does not replace
`deep-interview`, `ralplan`, code review, debugging, or direct implementation.
Hosts activate one compact catalog reference only; they do not load full bodies
or the catalog, or advance workflow state automatically. The only bundled
language reference is Java. Anything outside the catalog is nonoperative source
history, not a shipped Persona capability.

When loaded as an OpenCode plugin, Persona Harness registers this packaged
skills directory with OpenCode's native skill loader. The host can therefore
discover the catalog without a consumer-specific absolute path. Registration is
not activation: it does not inject every skill body, run a command, or advance
workflow state.

Each bundled `SKILL.md` has the short `name` and `description` frontmatter that
OpenCode uses to advertise a native skill. A description is only a compact
selection hint. It does not prove that a particular session selected the skill,
loaded its full body, or ran a command. `ph doctor` reports local package
metadata and Persona's optional automatic advisory-route configuration
separately, and leaves adapter reachability, current host-native selection, and
host route delivery as `UNOBSERVED` unless the host itself provides evidence.

## Project-local host layouts

`npx ph init` materializes this catalog as regular, manifest-owned adapters in
each supported host layout:

| Host | Adapter path |
| --- | --- |
| Codex and Antigravity | `.agents/skills/persona-harness-<skill-id>/SKILL.md` |
| Claude Code | `.claude/skills/persona-harness-claude-<skill-id>/SKILL.md` |
| OpenCode | `.opencode/skills/persona-harness-opencode-<skill-id>/SKILL.md` |

Init may refresh only an unchanged Persona-owned adapter. User-owned, modified,
or symlinked targets fail closed rather than being overwritten. The adapters
make the catalog discoverable but do not enable Context, legacy runtime
injection, workflow commands, shell, network, authority, or completion state.
The generated OpenCode-native path is the only one eligible for OpenCode
automatic discovery, preventing duplicate candidates from the other compatible
layouts. See [Portable Host Adapters](../../docs/current/portable-host-adapters.md)
for the full upgrade and host-evidence boundary.

## Portable Contract

The root package exposes `persona-portable-skill-contract.1` through its
`./portable-skill` subpath. It turns the existing selected catalog entry into a
metadata-only capsule with versioned input/output schemas and required host
capabilities. Capsules contain no prompt, model output, credential, source
content, or absolute path.

Codex, OpenCode, Claude Code, and Antigravity adapters consume the same capsule.
If a host lacks a required capability, the adapter returns the bounded
`unsupported-capability` result and never falls back to another host's
semantics. The capability list must be an explicit valid array; absent,
malformed, or unknown entries are unsupported. The existing selector and
`runtimeInjection` default remain unchanged. `sharedSkillRouting` controls a
separate compact OpenCode advisory route and does not enable runtime context.
