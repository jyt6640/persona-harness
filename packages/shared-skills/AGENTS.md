# Persona Shared Skills

`catalog.json` is the only current Persona-owned shared-skill contract. It
defines the portable core, explicit optional overlays, their mutability, and
their handoffs. The root npm package ships only the catalog entries declared
in its `files` policy; it does not inject full skill bodies into a host.

OpenCode and other hosts may advise or route to a catalog entry. They do not
create plans, workflow state, tickets, branches, files, or agents unless a
user explicitly chooses a later procedure.

Legacy directories outside `catalog.json` are nonoperative source history.
They are neither routed nor packaged and must not be represented as Persona
skills or host capabilities.
