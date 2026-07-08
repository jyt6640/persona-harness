# Nothing forces the agent to stop at the gate

**Symptom:** the agent claims "done" without running `finish`.

## Reality

Prose is ignorable by design — PH's authority is the gate, not the prose. The
gate is real and returns a non-zero exit with a precise blocker list when the
work is incomplete:

```bash
npx ph workflow finish implement   # exits 1 when reports/evidence are missing
```

Observed blockers include `verification-unknown`, `implementation-report-missing`,
`review-report-missing`, and `evidence-missing`.

## Fix — make the gate the forcing function

1. **Explicit prompt.** Paste the rail steps into your task prompt (the README
   Quick Start lists them) and end with: *"run `npx ph workflow finish implement`;
   if it fails, fix the blocker, do not claim done."*
2. **Wire the gate into your run.** Have your agent runner / session-stop step run
   `npx ph workflow finish implement` and treat a non-zero exit as "not done."

> PH does not yet ship an automatic stop-hook, so this wiring is manual for now.
> This is a known product gap: the gate works, but invoking it is on you.
