---
name: programming
description: Use for a clear scoped implementation request; inspect local conventions and verify only the requested change.
persona-skill: core
mutability: advisory
handoff: tdd
---

# Programming Discipline

Treat a clear implementation or fix request as authorization for that scoped
work. Read the project profile, approved decisions, and nearby code first.
Implement and verify the requested behavior without asking the user to repeat
approval. Add a focused regression for a behavioral change; for a reversible
copy or configuration edit, validate the affected surface without inventing a
test that only matches prose. Required project gates still apply. Do not infer
a project stack from this package's Node metadata or grant extra permissions
from skill activation.

Before the first affected edit, check whether a still-unresolved choice could
change permissions, an external contract, data loss or recovery, concurrency,
or duplicate-request behavior. Use only risks relevant to this task. Read facts
from code and reuse applicable approved decisions; do not start a fixed product
interview or require `grill-me` to perform this check. Ask one material question
with evidence, a recommendation and its tradeoff when the code cannot answer it.
Small reversible changes with settled intent need no question. Explain confusion
and honor cancellation without replacing it with another interview question.

Connect applicable approved philosophy to the edit and its verification: identify
the affected code boundary and a test or review condition, then inspect the diff
and results. Report any unresolved contradiction or unavailable profile; do not
claim personalization merely because a skill or context block was delivered.

Verification is complete only after the command exits and its result is checked;
a success message from a still-running REPL is not a completed test. Prefer the
project's non-interactive test command. If a check leaves a process running, use
the host's supported controls to finish or stop that check and confirm its state
before reporting completion. Do not stop unrelated user processes or describe
an interrupted check as passing. Retain a focused, rerunnable regression for a
behavioral change instead of relying only on an interactive transcript.

The packaged language overlay is `references/java/` for Java/Spring projects.
Other language references are not a packaged Persona contract and must not be
claimed as available guidance.
