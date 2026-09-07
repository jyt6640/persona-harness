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

## Install Packaged Host Plugins

The npm package also includes immutable, versioned plugin artifacts for
Antigravity, Codex, and Claude Code. This is useful when a user wants the
canonical catalog as a host plugin rather than as project-local adapters
produced by `ph init`.

`ph plugin path` is read-only: it verifies the installed artifact tree against
the catalog before printing a path. It never adds a marketplace, enables a
plugin, or changes any host configuration.

For Codex, explicitly register the package-local marketplace and then add the
plugin through the normal Codex plugin commands:

```bash
codex plugin marketplace add "$(npx ph plugin path codex)"
codex plugin add persona-harness@persona-harness
```

For Antigravity, explicitly install the verified local plugin directory through
its normal CLI. This stages host-owned state, so Persona Harness only prints the
path and never runs the command itself:

```bash
agy plugin install "$(npx ph plugin path antigravity)"
```

For Claude Code, validate the same packaged directory locally, then load it for
the session using Claude Code's supported plugin-directory flag:

```bash
claude plugin validate "$(npx ph plugin path claude)"
claude --plugin-dir "$(npx ph plugin path claude)"
```

Those host commands are intentionally user actions. They may create or update
host-owned marketplace or plugin state, so Persona Harness never invokes them
by inference. Marketplace publication, public-directory acceptance, and live
host skill selection are separate host-governed observations and are not
claimed by successful static validation.

## What Is Shared

Version 1.0.0 also supplies common execution guidance with each selected skill:
carry the user's authorized task through appropriate verification, reuse its
existing approval, explain confusion, and honor cancellation immediately.
Status questions and corrections steer that task instead of resetting it.
This guidance does not alter host permissions or create workflow authority.
See the [Korean Astra migration guide](astra-migration-guide.ko.md) for settings
and prompt examples.

Every generated adapter points to the same Persona-owned catalog. Its
host-facing machine name is `ph-<skill-id>`, while the description and visible
heading begin with `(PH)`. This makes Persona-owned skills recognizable without
using punctuation that can violate a host's skill-name rules. Each adapter also
carries catalog identity, adapter layout, and package version. The catalog can
advise one compact reference, such as `deep-interview`, `grill-me`,
`programming`, `debug`, or `review`; discovery does not load every skill body.
The canonical `deep-interview` guidance can additionally reference the explicit
host-neutral `ph interview` boundary. It returns transient caller-local state
and persists only explicitly approved structured decisions; packaging that
guidance does not run the command or claim a host session did.

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

OpenCode continues to use its documented npm-plugin configuration and the
project-local `.opencode/skills` adapter that `ph init` manages. Its existing
plugin array and host skill settings are preserved; `ph init` adds the
versioned Persona package entry once and never registers a second shared-skill
identity.

## Context And Runtime Boundary

`context.enabled` is explicit and default-off. Static portable adapters do not
enable it. Version 1.1.0 also bundles a read-only
`SessionStart` guidance and `PreToolUse` Context hooks in the Codex and Claude plugins. They run only after the
host's own enablement and trust requirements are satisfied; it never changes
host settings or enable a project's Context configuration.

For a project with no explicit personalization decision, SessionStart offers
first-use guidance: inspect relevant code and approved decisions, ask only
material unresolved questions, and obtain consent before personalization setup.
An existing file with no `context.enabled` decision is not an explicit opt-out.
For that case, guidance asks the agent to inspect and change only that field
after consent, preserving comments and all other settings. Global harness
disablement or explicit `context.enabled: false` suppresses setup guidance.
The separate `scripts/context-setup.mjs` bridge reuses the existing `context
init --enable`, `context preview`, and `philosophy` command implementations.
It is not registered as an automatic hook. The no-overwrite initializer refuses
every existing configuration, including an explicit opt-out; the hook does not
turn that refusal into an overwrite. Rule persistence remains an explicit
approved action through the append-only V1 lifecycle.
Actual consent and the agent's subsequent minimal edit still require live host
observation; local hook tests prove the offered instructions and absence of
automatic writes, not the model's compliance.

The plugin includes the Java programming references, their existing Bash
`skills/programming/scripts/java/check-no-excuse-rules.sh` checker, and the
philosophy persistence reference. The checker is explicitly invoked, not a
hook or replacement for compilation and tests. Resolve it from the loaded
programming skill directory, while project builds run from the consumer root.
Its default-profile textual warnings remain subordinate to approved project
choices; they are not a general architecture proof. Other source-only scaffold
helpers are not included in the portable plugin.

The setup bridge's `--help` is read-only and identifies supported commands and
the installed decision-format reference without requiring bundle inspection.
These resources are available on demand instead of being inserted
wholesale into every model request. SessionStart guidance is classified
separately from selected rules and does not claim a profile was delivered.

The two plugins carry the same self-contained Node runtime. The hook accepts
documented Read/Edit/Write/MultiEdit paths and apply_patch targets, including
Codex's `tool_input.command` shape and move destinations. It does not infer file
targets from shell commands or claim to observe arbitrary tools. Every selected
file is checked, shared rules are deduplicated, and the complete block must fit
the configured budget. An invalid target or overflowing union emits no rule
payload. Missing profiles are reported as missing, not as personal philosophy.

The optional OpenCode adapter accumulates targets until its next messages
transform and re-resolves the current profile then. It suppresses a duplicate
only when the exact synthetic Context block is visible in that model input.
Compaction does not discard pending targets. The portable command hooks have
no retained-message visibility, so they do not suppress later events based on
an assumed successful delivery. This is not a measured token-saving claim.

The runtime's `offered` result means JSON was prepared for host transport, not
that the model received or followed it. In particular, PreToolUse additional
context is read on a subsequent model request, not necessarily before the
already proposed edit executes. See the official [Codex hook contract](https://learn.chatgpt.com/docs/hooks)
and [Claude hook contract](https://code.claude.com/docs/en/hooks). Do not treat
this advisory path as pre-edit enforcement or Finish authority.

Budgets count the complete additional-context string, including its header,
separators and profile notices. Codex's secondary large-output shortening is
disabled for this already bounded hook; the PH maximum remains enforced.
Host-added wrappers, loaded skills and full provider usage still require actual
host measurement. Character counts are not token counts.

Current evidence includes local core/transport tests, npm package installation,
relocated plugin execution with synthetic approved profiles, and Claude Code
2.1.132's successful manifest validation. Maintainer-authored Codex Luna Max
observations cover normal trust approval, first-use consent, saved-rule reuse,
answer-dependent decisions and final rule conformance after resume, compaction
and profile refresh. They are bounded examples, not independent-user UX or
proof of rule knowledge before the first edit. Claude model behavior remains
unobserved; current live validation is Codex-only. Token experiments were
explicitly stopped and are not an acceptance claim.

The current source adds `context scope bind --project <approved-key>` after
explicit checkout consent. Supported hooks and Preview reuse that connection;
another worktree, clone or moved checkout requires a new connection. The
personal-store record contains a checkout digest and scope key, not raw paths.
This has local and relocated-plugin evidence. A bounded Luna Max run applied a
project rule over a different personal default, but also read raw profile and
observer documents; that run does not isolate automatic binding as its cause.
Active SessionStart guidance now exposes the read-only scope/Preview bridge
before editing rather than suggesting that the bridge is only for persistence.
The revised guidance has local/package evidence. A later bounded Luna Max task
observation used scope inspection and task Preview before editing.
Session-local task connection now has a separate explicit resume/end command
and read-only task Preview. A host-namespaced session handle identifies the
connection, not the task: only an explicitly selected active task key can bind.
New sessions do not inherit the last task. Supported hooks reuse that connection;
the model must end it on completion, cancellation or task switch. Local and
relocated-plugin tests do not prove that natural-language lifecycle behavior.
One isolated Luna Max observation completed explicit resume, pre-edit task
Preview, a durable Java regression and matching end, with normal one-time host
write approvals. That observation is not universal lifecycle enforcement.
Explicit project/task selectors still work in Preview. See the
[project connection](personalization-profile-v1.md#checkout-local-project-connection)
and [task connection](personalization-profile-v1.md#session-local-task-connection)
contracts. Neither changes execution or Finish authority.
When scoped rules exist without a supplied identity, Preview and the rule hook
report that those rules were not applied. Same-topic ambiguity remains
fail-closed; the host may clarify and consolidate complementary obligations
only through an approved decision, not a guessed semantic classifier.

The legacy `runtimeInjection` setting remains default-off. In an initialized
OpenCode project, the separate `features.sharedSkillRouting` setting defaults
on and permits one compact advisory skill route; set it to `false` to opt out.
That enabled host route may select `deep-interview` automatically for an
ambiguous product request. The portable `ph interview` CLI remains a separate,
explicit/default-off durable boundary: adapter discovery and catalog reads do
not invoke it by themselves.
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
