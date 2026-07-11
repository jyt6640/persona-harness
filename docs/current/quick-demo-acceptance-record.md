# Item 24 QUICK-DEMO Acceptance Record

Status: accepted on exact implementation main

## Accepted Main

Item 24 accepts the public QUICK-DEMO gate-flow record at:

```text
d45625953286032cc543036f83dae82ff0fad4ae
merge: integrate quick demo gate flow
```

Candidate and replay QA passed. Candidate and replay External package checks
passed. Post-integration QA and post-integration External also passed on exact
main `d456259`.

## Provenance

The accepted replay is:

```text
12cf823c498c8a9402e2ec83652e821cbbf3e78c
merge: replay quick demo on current main
```

Exact implementation main `d45625953286032cc543036f83dae82ff0fad4ae` has
these parents:

```text
7a4c027aa935305c7a1a946f3883188570690cd5
12cf823c498c8a9402e2ec83652e821cbbf3e78c
```

The replay includes the Unit B public-entry package correction. That correction
makes the README Quick Demo target available in the npm package; it does not
alter the gate contract below.

## Accepted Three-Beat Contract

1. **Prepare:** in a throwaway backend workspace, `ph init` and
   `ph bootstrap backend` prepare the profile, accepted plan, and workflow
   templates needed by `ph go`. Default `runtimeInjection` remains false; no
   host hook is required.
2. **Observe a legitimate block:** in that prepared workspace,
   `npx ph workflow finish implement` exits `1` and renders exactly one
   prioritized plaintext `Next action` plus, when applicable, one phased
   plaintext `Next command`. An uninitialized directory is not this gate
   demonstration: finish exits `0` with setup guidance and creates no
   `.persona`.
3. **Enter one concrete goal:** `npx ph go "Add a task creation endpoint."`
   exits `0`, captures the goal, selects the current ticket, and prints the
   existing implementation rail. The final gate remains the same plaintext
   finish command.

For structured diagnostic closure state, the companion command is:

```text
npx ph workflow closure next --json
```

It is not a `finish --json` result. `workflow finish implement --json` is
rejected nonzero; no `finish --json` surface is accepted by this record.

## Exact-Main Evidence

Canonical QA: PASS on the candidate/replay and again on exact main `d456259`.

External: PASS through the post-integration fresh local-current tarball package
smoke at:

```text
/tmp/persona-harness-external-archives/item24-quick-demo-main-package-smoke-d456259-20260711T063556Z
```

| Fact | Value |
| --- | --- |
| Target main | `d45625953286032cc543036f83dae82ff0fad4ae` |
| Package | `persona-harness@0.6.0` |
| Evidence source | Fresh local-current tarball; registry not used |
| SHA-1 | `dbafcde52e0c3a381d03a737d39fb52b7c9dac16` |
| SHA-256 | `bc7f59974d888d61485b5dd592e752723af0ae09407c467b07432bf417cee9d7` |
| Entry count | `699` |

The archive records package inclusion for `docs/QUICK-DEMO.md`,
`docs/START-HERE.md`, `docs/MEASURED-CLAIMS.md`, and the Item 21 acceptance
record; the packaged README Quick Demo target resolves, and all 23 relative
links in installed `docs/current/README.md` resolve. It also records successful
init/bootstrap with `runtimeInjection=false`, the prepared plaintext finish
shape, exact `ph go` success, plaintext-finish/closure-next blocker agreement,
rejected finish JSON, and uninitialized finish setup guidance without
`.persona` creation.

This final record follows the established current-acceptance-record package
policy and adds its own Markdown path to the package manifest. That docs entry
is separate from the accepted Item 24 implementation package surface.

## Boundaries

This record documents the observed public setup, blocked-finish, and goal-entry
surfaces only. It does not promise automatic implementation or completion,
generated-app certification, app quality, efficacy, token saving, or broad
reliability.

No runtime/default, hook requirement, schema/evidence-schema, version, release,
publish, tag, `latest`, `next`, or Item 25 change is accepted here.
