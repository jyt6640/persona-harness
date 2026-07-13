# Roadmap

Direction and non-goals for Persona Harness. Claim boundaries live in
[docs/MEASURED-CLAIMS.md](docs/MEASURED-CLAIMS.md); this page is about work
order, not claims.

## Now

- P3 integrity program first: Stable/GA and npm `latest` movement are NO-GO
  until P3 closes. See
  [docs/current/p3-integrity-roadmap.md](docs/current/p3-integrity-roadmap.md).
- Keep measured claims visible and honest, including the 2026-07-12 local
  production-audit negative result.
- Retain completed P2 source-only evidence and bundles on hold; do not use
  further P2 work as product/release evidence until P3 permits resumption.
- Keep runtime injection default-off.
- Keep Java/Spring backend as the main supported workflow.

## Next

- P3-1 adversarial regression fixture harness.
- P3-2 closure authority policy with no unsigned project-artifact fallback.
- P3-3 attempt/receipt/attestation schema and migration.
- P3-4 fresh fixed-command runner, including nonzero test-count enforcement.
- P3-5 semantic TDD red-to-green chain.
- P3-6 config/path/walker safety.
- P3-7 safe init upgrade.
- P3-8 CI/publish/release-ref restrictions.
- P3-9 RC3 validation and P2-resumption decision.

## Later

- Explore role-based subagent orchestration **only if measured**.
- Explore team/project convention capture.
- Explore long-session rail retention.
- Explore broader backend workflow support.

## Not now

These are explicitly out of scope until measurement supports them. See the
[forbidden claims table](docs/MEASURED-CLAIMS.md#forbidden-claims).

- Runtime injection default-on.
- Stable/GA or npm `latest` movement before P3 closes.
- Strong completion-integrity or anti-forgery claims before P3 closes.
- Token-saving claims.
- Generated app quality certification.
- Full TDD / test-sufficiency claims.
- Broad AST/linter enforcement.
- Production-ready multi-agent orchestration.
- Frontend / infra productization.
- Deterministic role enforcement claims.
- CodeGraph / LSP default-effectiveness claims.

## Roadmap rule

A feature may exist as a preview before it becomes a product claim. A product
claim requires measurement. A negative measurement keeps the feature parked,
downgraded, or removed.
