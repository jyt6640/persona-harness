# Persona Shared Skills

This package-internal bundle is the portable Persona Harness skill core. Its
authoritative index is [`catalog.json`](./catalog.json).

Core sequence: `deep-interview` -> `technical-intake` -> `plan` -> optional
`ralplan` -> `tdd` -> `implementation` -> `review`. `programming`, `debug`,
`refactor`, and `git` provide bounded supporting guidance. `frontend`,
`visual-qa`, `ast-grep`, and `lsp-setup` are explicit optional overlays.

Hosts may route to these entries but do not load their full bodies or advance
workflow state automatically. The only bundled language reference is Java.
Anything outside the catalog is nonoperative source history, not a shipped
Persona capability.
