---
name: ph-lsp-setup
description: "(PH) Use only when the user explicitly requests language-server setup or diagnostics."
license: "Apache-2.0"
compatibility: "Claude Code"
metadata:
  persona-harness/canonical-skill: lsp-setup
  persona-harness/display-name: "(PH) LSP Setup Overlay"
  persona-harness/adapter-layout: claude
  persona-harness/adapter-version: 0.11.0
  opencode/autoinvoke: "false"
---

# (PH) LSP Setup Overlay

This adapter exposes the canonical Persona Harness skill to this host only. Discovery alone does not authorize workflow, shell, network, GitHub, authority, evidence, or external actions.

# LSP Setup Overlay

Use only on explicit request. Configure or inspect a language server within the
existing project toolchain, report available diagnostics, and do not invent a
host/editor capability that is unavailable.
