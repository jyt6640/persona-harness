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

The packaged language overlay is `references/java/` for Java/Spring projects.
Other language references are not a packaged Persona contract and must not be
claimed as available guidance.
