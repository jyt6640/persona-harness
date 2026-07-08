# How to tell the rail is actually active

Run these to see whether the rail is set up, has work, and has a driver on:

```bash
npx ph doctor                       # environment + install state
npx ph workflow check               # current blockers / state
npx ph workflow next                # is there a pending ticket?
grep -i systemConstitution .persona/harness.jsonc   # is the driver on?
```

Interpretation:

- `next` shows no ticket **and** `systemConstitution` is `false` → the agent has
  nothing to follow and nothing reinforcing it. This is the passive-by-default
  state, not a bug. Fix via [no-tickets.md](no-tickets.md) and
  [rail-ignored.md](rail-ignored.md).
- `doctor` reports OpenCode missing → the plugin cannot run; install/configure
  OpenCode first.
