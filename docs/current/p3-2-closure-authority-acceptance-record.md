# P3-2 Closure Authority Candidate

Status: candidate branch only; QA and External re-gate required.

This P3-2 unit changes `workflow finish implement` so a finish PASS cannot come
from unsigned project-local evidence. Until a future trusted authority path is
implemented, an otherwise passable workflow stops with
`trusted-authority-required`.

## Boundary

The following remain readable for diagnostics and troubleshooting, but are not
finish authority:

- `bearshell` output or workflow report text such as `BUILD SUCCESSFUL`;
- local JUnit XML and TDD JSON;
- `generatedBy` markers;
- self-computed artifact or snapshot digests;
- arbitrary command, source-head, or exit values;
- stale or different attempt IDs;
- missing external attestation.

No receipt schema, migration, signature/OIDC verification, fixed-command
runner, zero-test enforcement, or semantic TDD matcher is implemented here.
Those are separate P3-3/P3-4/P3-5 units. This candidate therefore intentionally
blocks pre-P3 finish flows until a legitimate authority path exists.

## Regression Evidence

The security-green tests copy the canonical P3-1 synthetic payloads into
disposable projects and prove:

- finish exits nonzero;
- no `Finish status: PASS` or final-answer success wording is emitted;
- the blocker is `trusted-authority-required`;
- closure `next --json` exposes the same authority boundary;
- legacy escape variants remain diagnostic-only.

No real project, attendance fixture, registry, network service, or user evidence
was used. This record makes no mitigation, stable/GA, `latest`, reliability,
efficacy, token-saving, or closure-guarantee claim beyond the tested local
behavior.
