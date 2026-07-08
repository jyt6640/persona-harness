# Profile is not set up on an existing project

**Symptom:** attaching to an existing codebase in a TUI leaves
`.persona/project-profile.jsonc` mostly empty; the agent has no stack context.

## Why

`ph bootstrap backend` writes a profile **template**. It does not auto-detect an
existing project's stack, and the intake interview is awkward inside a TUI, so
the profile often stays empty. An empty profile also weakens the constitution
guard, which expects the profile to have been read before implementation.

## Fix

- Edit `.persona/project-profile.jsonc` directly: state the build tool, package
  layout, and framework so the rail and constitution have real context.
- Confirm `.persona/workflow/plan.md` reflects the actual project before asking
  the agent to implement.
