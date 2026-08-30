# Top-level Intent Router

The router activates at most one compact Persona catalog reference for a turn.
An explicit `/persona <skill-id>` command wins. A malformed or unavailable
command fails closed rather than falling back to another skill.

Clear direct debug, review, refactor, Git, and implementation requests bypass
product discovery. An ambiguous new-product request starts `deep-interview`
with one question, recommendation, and tradeoff. An ambiguous brownfield
request starts code-first discovery. `skip`, `defer`, and `stop` suppress a new
interview start.

An active interview releases when the user naturally stops it, defers the
whole discovery task, or switches to bounded feedback/dogfooding work. That
suppression persists until the explicit `/persona deep-interview` command. A
clarification holds the current question rather than advancing to an adjacent
decision. The compact `[Persona Harness Skill Route]` notice appears only for
an actual skill selection; stop and clarification are control responses, not
new activations.

The adapter supplies only the selected reference, safe first action, and
handoff. It does not inject a full skill body or catalog, create workflow state,
or run a command. The full portable contract is [Persona Shared Skills
Core](persona-shared-skills-core.md).
