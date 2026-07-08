# Agent implements directly, no tickets

**Symptom:** you say "just implement it on my existing project" and the agent
edits files immediately instead of working ticket by ticket.

## Why

1. `ph bootstrap backend` creates a plan template but **zero tickets**.
   `ph workflow next` reports `Workflow backlog not found`.
2. `ph workflow split README.md` on a freeform existing-project README produces a
   **malformed backlog** (`no valid ticket rows could be parsed`), because split
   expects structured `## Step N:` sections, not prose.
3. With no ticket, `ph workflow implement` / `next` have nothing to hand the
   agent, so it just edits.

## Fix

Write a short structured requirements file and split that:

```markdown
# Change
## Step 1: Add discountCode field
Add a `discountCode` (String) field to OrderRequest and its DTO.
## Step 2: Add memo field
Add a `memo` (String) field to OrderRequest and its DTO.
```

```bash
npx ph workflow split requirements.md
npx ph workflow next            # now shows a real ticket (step-1)
```

For a tiny change where the ticket ceremony is overkill, skip tickets and rely on
the completion gate instead: enable `enforce.tdd` and run
`npx ph workflow finish implement` (see [enforce-the-gate.md](enforce-the-gate.md)).
