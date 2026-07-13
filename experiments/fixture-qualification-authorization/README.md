# Fixture Qualification Authorization

This is a source-only, deterministic design for a future read-only fixture
qualification operation. It is authorization-only and explicitly
non-executing. It does not inspect a candidate, run `ph`, create a checkout or
mirror, write a project, create a journal/result artifact, use the network,
start a child process, or grant workflow-finish authority.

`authorization.json` binds synthetic candidate identity, policy, future
invocation-owned roots, deferred source-before/source-after facts, and the
required future evidence chain. `authorization-transcript.json` is a planned
read-only sequence with no executed commands. `negative-states.json` keeps
absent, foreign, corrupt, pre-existing, escaping, and symlink states as
explicit rejection cases.

`canonical-lock.json` binds all authorization semantics, IDs/order, payload
bytes, transcript steps, and negative paths. `validate.mjs --validate` and
`evaluate.mjs --evaluate` are read-only and fail closed on drift. The pristine
decision remains:

```text
qualificationOperationAllowed: false
qualificationAllowed: false
executionAllowed: false
commandsExecuted: 0
artifactsCreated: 0
telemetryEvents: 0
```

No source inspection, qualification, execution, ticket/go/implementation/
verification/finish, telemetry, efficacy, adoption, reliability, security,
Stable, GA, or latest claim is made here. The material is package-excluded.
