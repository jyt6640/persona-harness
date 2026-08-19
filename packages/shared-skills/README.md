# Persona Shared Skills

This package-internal bundle is the portable Persona Harness skill core. Its
authoritative index is [`catalog.json`](./catalog.json).

Core sequence: `deep-interview` -> `technical-intake` -> `plan` -> optional
`ralplan` -> `tdd` -> `implementation` -> `review`. `programming`, `debug`,
`refactor`, and `git` provide bounded supporting guidance. `frontend`,
`visual-qa`, `ast-grep`, and `lsp-setup` are explicit optional overlays.
`philosophy-refinement` is a separate explicit-only core procedure; it never
starts from ordinary chat or code inspection.

An explicit `/persona <skill-id>` command wins routing. Otherwise clear direct
work uses its matching supporting skill, while ambiguous product requests start
`deep-interview` with one safe action. Hosts activate one compact catalog
reference only; they do not load full bodies or the catalog, or advance
workflow state automatically. The only bundled language reference is Java.
Anything outside the catalog is nonoperative source history, not a shipped
Persona capability.

## Portable Contract

The root package exposes `persona-portable-skill-contract.1` through its
`./portable-skill` subpath. It turns the existing selected catalog entry into a
metadata-only capsule with versioned input/output schemas and required host
capabilities. Capsules contain no prompt, model output, credential, source
content, or absolute path.

Codex, OpenCode, Claude Code, and Antigravity adapters consume the same capsule.
If a host lacks a required capability, the adapter returns the bounded
`unsupported-capability` result and never falls back to another host's
semantics. The existing selector and `runtimeInjection` default remain
unchanged.
