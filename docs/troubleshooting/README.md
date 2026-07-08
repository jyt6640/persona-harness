# Troubleshooting

Practical fixes for common first-run problems, especially when attaching Persona
Harness to an **existing** Java/Spring project in an OpenCode TUI session. One
file per problem — add a new file here as new issues are found.

## Why the agent "ignores" the rail (shared root cause)

Persona Harness ships **gate-first and passive by default**. After
`ph bootstrap backend`, every model-facing driver is off:

```
features.runtimeInjection   : false
enforce.systemConstitution  : false
enforce.executeVerification : false
enforce.tdd                 : false
```

The only instruction telling the agent to use the rail lives in `AGENTS.md`,
which is passive prose an agent can ignore. The **finish gate works** (it exits
non-zero and lists blockers), but nothing *invokes* it for you. To make the
agent follow the workflow you must turn on a driver and/or force the gate.

## Index

| Symptom | Fix |
| :--- | :--- |
| Agent implements directly, no tickets | [no-tickets.md](no-tickets.md) |
| Agent ignores the rail / skips `ph bearshell` / says "no enforced rule" | [rail-ignored.md](rail-ignored.md) |
| Nothing forces the agent to stop at the gate | [enforce-the-gate.md](enforce-the-gate.md) |
| Profile not set up on an existing project | [existing-project-profile.md](existing-project-profile.md) |
| `split` left the workflow stuck | [split-recovery.md](split-recovery.md) |
| How to tell the rail is actually active | [check-rail-active.md](check-rail-active.md) |

See also: [Quick Demo](../QUICK-DEMO.md) · [Start Here](../START-HERE.md) ·
[Measured Claims](../MEASURED-CLAIMS.md) · [SECURITY](../../SECURITY.md).
