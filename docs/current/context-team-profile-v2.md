# Team Profile V2

Status: current source boundary. Team Profile V2 is repository-local,
read-only configuration. It does not enable host delivery or runtime injection.

## Purpose

Team Profile V2 keeps project-shareable conventions separate from a person's
local philosophy store. It produces an explicit team layer for the pure Context
resolver; it does not read a personal store, choose a host adapter, or invoke a
workflow.

## File and schema

Store the v2 document at:

```text
.persona/team-profile.jsonc
```

The required schema version is `persona-context-team-profile.2`.
JSONC comments are accepted; after comments are removed, the document must be
valid JSON. Unknown fields and unsupported schema versions are rejected.

```jsonc
{
  "schemaVersion": "persona-context-team-profile.2",
  "teamKey": "platform",
  "rules": [
    {
      "id": "team-boundaries",
      "topic": "architecture",
      "text": "Keep module boundaries explicit.",
      "status": "active",
      "relevance": {
        "fileRoles": ["service"],
        "languages": ["typescript"],
        "skillIds": ["programming"]
      }
    }
  ]
}
```

`id`, `topic`, `text`, and `status` are required for every rule. `relevance`
is optional and may contain only `fileRoles`, `languages`, and `skillIds`.
The loader bounds a profile to 64 rules, text to 600 characters, identifiers to
120 characters, and each selector list to 16 unique identifiers.

## Compatibility

The existing v1 document remains unchanged at:

```text
.persona/team-profile.json
```

Its schema is `persona-team-profile.v1`. The v1 and v2 loaders are separate:
a v1 document is never upgraded, copied, or silently interpreted as v2.

## Safety and resolution

The v2 loader rejects, rather than rewrites, malformed or unsafe shared text.
This includes control characters, credential-shaped values, private absolute
paths, external URLs, remote-fetch or shell/process instructions, authority or
security-weakening instructions, and personal-preference-shaped content. It
also rejects duplicate rule IDs and two active rules at the same topic.

`toTeamContextLayerV2` converts a valid document to explicit `teamContracts`
for the pure resolver. The resolver keeps its fixed precedence:

```text
product invariants > task > project > team > personal > language > common
```

The loader never opens a personal store and does not call the resolver by
itself. Missing, malformed, unreadable, or symlinked files return only fixed
diagnostics without creating project state or reflecting the rejected content.

## Current limits

This boundary adds no public CLI command, preview, explain, doctor expansion,
OpenCode adapter or hook delivery, runtime default-on change, workflow/evidence
or authority behavior, network/process action, profile sync, release claim, or
product-effectiveness claim. Package acceptance, protected hosted checks, and
external validation remain separate decisions.
