# v0.7.0-rc.2 Release Candidate Capsule

This is the durable release capsule for the prepared `0.7.0-rc.2` candidate.
It complements the workflow-compatible release notes in
[`docs/current/release/v0.7.0-rc.2-release-notes.md`](../../current/release/v0.7.0-rc.2-release-notes.md).

## Release State

- Intended package metadata: `persona-harness@0.7.0-rc.2`.
- Exact release-prep base: `4ed9653b1d9c02a673b340d72d6d42ae3b674e2b`.
- Current published registry baseline: `latest=0.6.0`, `next=0.7.0-rc.1`.
- This candidate is not published, tagged, registry-verified, or a GitHub
  prerelease.
- Post-publish registry, tag, and fresh-install facts are intentionally
  deferred until after QA release GO and the trusted publish workflow.

## Durable Records

- [`release-facts.md`](release-facts.md): pre-publish provenance, intended
  channel, P1 scope, and package boundary.
- [`measurements.md`](measurements.md): scoped P1 observations and their claim
  limits.

## Candidate Summary

The candidate collects P1 default-path work after the published
`0.7.0-rc.1`: default audit and doctor reachability, bounded project attach,
default-off entry steering, and public platform-support honesty.

## Boundaries

`runtimeInjection` remains false. No `finish --json`, default/schema/evidence-
schema movement, Windows or Codex support certification, token-saving,
efficacy, app-quality, security, broad reliability, or broad-enforcement claim
is included.
