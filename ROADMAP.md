# Roadmap

Direction and non-goals for Persona Harness. Claim boundaries live in
[docs/MEASURED-CLAIMS.md](docs/MEASURED-CLAIMS.md); this page is about work
order, not claims.

## Now

- Improve first-run docs and the [Quick Demo](docs/QUICK-DEMO.md).
- Improve the `workflow finish` blocker UX.
- Keep measured claims visible and honest.
- Collect external tester feedback on first-run experience.
- Keep runtime injection default-off.
- Keep Java/Spring backend as the main supported workflow.

## Next

- Harden the TDD evidence gate with more adversarial fixtures.
- Improve public measurement summaries.
- Improve Role Checklist Relay docs.
- Improve troubleshooting and `ph doctor` guidance.

## Later

- Explore role-based subagent orchestration **only if measured**.
- Explore team/project convention capture.
- Explore long-session rail retention.
- Explore broader backend workflow support.

## Not now

These are explicitly out of scope until measurement supports them. See the
[forbidden claims table](docs/MEASURED-CLAIMS.md#forbidden-claims).

- Runtime injection default-on.
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
