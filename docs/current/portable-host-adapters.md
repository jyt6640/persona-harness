# Portable Host Adapters

## Purpose

Starting with Persona Harness 0.9.0, the canonical shared-skill catalog is
discoverable in four agent hosts without a Persona-specific launch command:

- Codex
- Claude Code
- OpenCode
- Antigravity

This is a **static adapter installation** boundary. It gives each host regular
project-local `SKILL.md` files with the same catalog metadata and skill body. It
does not prove that a running host session selected a skill, loaded it, or
followed its guidance.

## Install In Any Supported Host Project

From the project root:

```bash
npm install -D persona-harness
npx ph init
npx ph doctor
```

`ph init` materializes the current canonical catalog in all of the following
host discovery layouts:

| Host | Generated adapter path |
| --- | --- |
| Codex and Antigravity | `.agents/skills/persona-harness-<skill-id>/SKILL.md` |
| Claude Code | `.claude/skills/persona-harness-claude-<skill-id>/SKILL.md` |
| OpenCode | `.opencode/skills/persona-harness-opencode-<skill-id>/SKILL.md` |

Use your host's normal project-skill discovery mechanism after initialization.
Persona Harness does not add a host-specific launch command or turn static
discovery into a claim that the host selected a skill in the current session.

When an already installed host integration sees a relevant Persona request in a
project without `.persona`, it may show a single `(PH) Setup` recommendation.
That recommendation is advisory: it cannot write configuration, invoke a
command, or start a workflow. Only a later explicit acceptance may authorize
the existing `npx ph init` command. It still does not imply `bootstrap`,
`attach`, workflow, Git, or network work.

## What Is Shared

Every generated adapter points to the same Persona-owned catalog. Its
host-facing machine name is `ph-<skill-id>`, while the description and visible
heading begin with `(PH)`. This makes Persona-owned skills recognizable without
using punctuation that can violate a host's skill-name rules. Each adapter also
carries catalog identity, adapter layout, and package version. The catalog can
advise one compact reference, such as `deep-interview`, `grill-me`,
`programming`, `debug`, or `review`; discovery does not load every skill body.

The adapter does not, merely by being discovered:

- run shell commands;
- create or advance workflow state;
- use network, GitHub, evidence, or authority surfaces;
- grant verification or Finish authority; or
- enable Context or legacy runtime injection.

The shared-skill routing and handoff contract is defined in
[Persona Shared Skills Core](persona-shared-skills-core.md).

## Ownership And Safe Re-runs

The init manifest records every generated adapter path and digest. `ph init`
may retain or refresh an unchanged Persona-owned adapter on a later run. It
does not adopt neighboring user skills.

Before any write, `ph init` checks each generated path as a no-follow regular
file. It fails closed without a partial write when it encounters a user-owned,
modified, missing-ownership, ambiguous, or symlinked target. In a clean
checkout without an init manifest, only a byte-identical adapter can be
re-owned.

If an adapter is intentionally customized, preserve it as user-owned and do
not expect `ph init` to replace it. Resolve the ownership collision deliberately
instead of deleting or forcing files just to make initialization pass.

## OpenCode Duplicate Prevention

OpenCode can discover all three conventional project skill directories. The
generated `.agents` and `.claude` adapters therefore declare
`opencode/autoinvoke: "false"`; only the `.opencode` adapter declares
`opencode/autoinvoke: "true"`. This leaves one native OpenCode candidate per
canonical skill while preserving Codex, Antigravity, and Claude Code discovery.

The existing optional OpenCode plugin registration remains separate from static
adapter materialization. It may expose OpenCode-specific advisory behavior, but
it does not change other hosts' semantics.

## Context And Runtime Boundary

`context.enabled` is explicit and default-off. Static portable adapters do not
enable it. Context delivery is currently implemented only by the optional
OpenCode adapter, and even there a local configuration or package check cannot
prove a live session received a Context block.

The legacy `runtimeInjection` setting remains default-off. In an initialized
OpenCode project, the separate `features.sharedSkillRouting` setting defaults
on and permits one compact advisory skill route; set it to `false` to opt out.
Here, initialized means that `ph init` created its regular managed manifest.
A Context-only or partial `.persona` directory is deliberately not treated as
initialized, so it cannot infer an interview or another automatic skill route.
That route does not deliver rule/profile context, create project state, run a
command, or advance a workflow. Portable adapters otherwise make skills
discoverable; they do not silently enable runtime hooks, pre-tool enforcement,
completion enforcement, session persistence, or automatic adapter updates on a
host that lacks those controls.

## Updating A Project

Upgrade the package through your normal npm workflow, then re-run init from the
same project root:

```bash
npm install -D persona-harness@latest
npx ph init
npx ph doctor
```

The later init can refresh only unchanged Persona-owned adapters. It will not
overwrite custom files or follow symlinks. The optional `ph update enable`
feature is an OpenCode plugin-pin update path; it does not automatically refresh
the portable adapter layouts. A new host session is still required for a host to
pick up any updated project-local skill files.

## What `ph doctor` Can Verify

`ph doctor` can report installed-package metadata, local integration files,
ownership diagnostics, and configured Persona routes. It cannot inspect a live
Codex, Claude Code, OpenCode, or Antigravity session. Treat host-native skill
selection, activation notices, and delivery as host evidence, not as something
proved by package installation alone.

## Capability And Claim Boundary

The versioned portable contract records per-host capability states as
`supported`, `emulated`, or `unavailable`. It derives portable versus enforced
assurance from that validated manifest rather than from a host name. A project
that requires enforced assurance blocks if the host cannot supply the required
control.

This does not claim uniform runtime hooks or enforcement across hosts. It is a
safe, host-neutral starting point for the same Persona skill catalog, while live
host behavior remains a separately observable boundary.
