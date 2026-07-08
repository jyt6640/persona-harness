# `split` left the workflow stuck

**Symptom:** after a bad first split, a second split refuses with
`refused to overwrite existing workflow state`, and `ph workflow next` reports a
malformed backlog.

## Why

A `split` on a freeform README can write a malformed `backlog.md`. That file then
blocks re-splitting (split will not overwrite existing workflow state), so the
workflow is stuck between "no valid tickets" and "cannot regenerate."

## Fix

Clear the workflow ticket state intentionally, then re-split from a structured
requirements file (see [no-tickets.md](no-tickets.md)):

```bash
rm -f .persona/workflow/backlog.md
rm -rf .persona/workflow/work/*
npx ph workflow split requirements.md
npx ph workflow next
```
