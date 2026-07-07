# Measured Claims

This is the **canonical claim boundary** for Persona Harness (PH). The README
and [CONTRIBUTING](../CONTRIBUTING.md) summarize and link here; they do not
restate it. If a claim is not on this page with evidence, PH does not make it.

Persona Harness only claims what measurement supports. When a measurement is
negative, PH records it and keeps the feature default-off or parked — it does
not quietly drop the result.

## Claim levels (summary)

A claim may only assert what its evidence supports. Climb in order:

1. Surface exists → 2. PH invokes it in a fixture → 3. PH generates the evidence
(not hand-written) → 4. Adversarial inputs fail honestly → 5. External smoke
reproduces from a fresh tarball/npm → 6. Repeated A/B improves a named scenario
→ 7. Only now may a scoped claim be written.

Full detail and the reject rule live in
[CONTRIBUTING → The Claim Ladder](../CONTRIBUTING.md#the-claim-ladder).

## Supported claims

Each is scoped to bounded local fixtures and is a **completion-integrity**
claim, not an app-quality claim.

### 1. PH blocks missing completion evidence

> PH can block completion when required reports, PH-generated evidence, or real
> test results are missing for explicitly defined workflow gates.

Boundary: this does not prove generated app quality.

### 2. Forged TDD evidence is rejected

> PH ignores a hand-written/forged TDD evidence file in the measured
> completion-integrity fixture; `workflow finish` still exits non-zero.

Boundary: this does not prove full TDD sufficiency.

### 3. Green-only completion is blocked when the TDD rail is enabled

> In the measured completion-integrity fixture, with the TDD rail on, PH blocks
> green-only completion that has no red-first evidence (measured 5/5 vs 5/5
> allowed with it off).

Boundary: PH does not write tests for you and does not prove test quality.

### 4. Compile errors are not accepted as red evidence

> PH does not treat a compile failure as valid red TDD evidence in the measured
> fixture.

Boundary: this is an evidence-integrity claim, not a testing-framework claim.

## Negative / parked

### Runtime injection

Measured in accepted 10-pair local-current OpenCode fixtures. Both PH ON and PH
OFF succeeded 10/10, but PH ON increased provider-token total, read chars, tool
calls, and elapsed time in **all 10 pairs**. See
[`current/injection-value-status.json`](current/injection-value-status.json).

- Allowed: runtime guidance exists as an explicit **default-off, opt-in
  preview**.
- Forbidden: that runtime injection improves generated code quality, saves
  tokens, or improves broad product efficacy.

## Preview / not proven

### Role Checklist Relay

- Allowed: PH includes a Role Checklist Relay preview for role artifacts and
  gate-oriented workflow guidance; role boundaries are report-only/heuristic.
- Forbidden: reliable automatic multi-agent orchestration, production-ready
  delegation, or deterministic role enforcement.

### Workflow loop (Ralph-loop-style continuation)

- Allowed: `ph workflow loop` is an explicit capped fresh-session blocker loop
  command with fixture-scoped evidence. It is **not** a default hook.
- Forbidden: autonomous completion, closure guarantee, broad reliability, or
  token saving.

### CodeGraph / LSP

- Allowed: CodeGraph and LSP wrappers are optional preview integrations that
  report an unavailable status when their external tools are missing.
- Forbidden: default effectiveness, broad navigation benefit, or being a
  required product path.

## Forbidden claims

| Claim | Status | Why |
| :--- | :--- | :--- |
| token saving | forbidden | runtime injection data is negative / not proven |
| generated app quality | forbidden | PH checks rail/evidence, not app quality |
| full TDD framework | forbidden | PH gates evidence, not test sufficiency |
| broad AST/linter enforcement | forbidden | checks are scoped/report/closure surfaces |
| production-ready multi-agent orchestration | forbidden | relay is a checklist preview |
| closure guarantee | forbidden | workflow loop has fixture-scoped evidence only |
| runtime injection benefit | forbidden | measured negative |

## How to add a new claim

1. Add the measurement first.
2. Link the evidence (archive, fixture, or status file).
3. State the scope (which fixture/model/conditions).
4. State the limitation.
5. If it is not supported, keep the claim out of the README.
