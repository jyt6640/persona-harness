---
name: ast-grep
description: Use only when the user explicitly requests AST-aware search or rewrite and the tool is available.
persona-skill: optional-extension
mutability: advisory
handoff: review
---

# AST-Grep Overlay

Use only when `ast-grep` is available and explicitly requested. Keep structural
queries scoped, inspect matches before rewriting, and validate the changed
behavior. Do not claim the tool exists on an unsupported host.
