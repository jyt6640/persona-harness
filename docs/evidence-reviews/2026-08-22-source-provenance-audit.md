# Source Provenance Audit (2026-08-22)

Status: candidate source-boundary remediation record for #311. This is a
technical provenance inventory, not legal advice or a conclusion about
copyright infringement.

## Method

The machine-readable [audit inventory](2026-08-22-source-provenance-audit.json)
compares every tracked candidate path against the exact Git tree for
[`code-yeongyu/oh-my-openagent`](https://github.com/code-yeongyu/oh-my-openagent)
at `bddfeb521545489860030acf19e82ac47f6db15d` using exact Git blob identity and
same-path matching.

The inventory records 143 candidate paths with exact same-path blob matches.
The raw comparison has 154 pairs because the MIT `ast-grep` license text also
appears at 11 unrelated upstream package-license paths. Those 11 pairs do not
add candidate source paths.

The inspected upstream repository identifies its remaining material under the
Sustainable Use License 1.0. That is not an OSI license and is not treated as a
redistribution grant for this candidate.

## Candidate Disposition

- 132 exact OMO matches are removed before the candidate is frozen.
- The containing dormant source trees are also removed as a precaution, so a
  modified or non-exact file in those trees cannot be mistaken for cleared
  source material.
- The 11 retained exact matches are all within
  `packages/shared-skills/skills/ast-grep/`. They are retained under the
  explicit MIT source marker and license text at that path.

The [source SBOM](2026-08-22-source-sbom.cdx.json) names the retained MIT
component. The root [`NOTICE`](../../NOTICE) repeats its source, revision,
license, retained path, and local source marker. The npm dependency graph
continues to be pinned by `package-lock.json`; this source SBOM covers tracked
vendored source rather than replacing the lockfile.

## Verification

Run the deterministic candidate check from the repository root:

```bash
node scripts/check-source-provenance-audit.mjs
```

It fails closed when the upstream binding, record set, removal set, MIT source
marker, root notice, or source SBOM drifts. It also fails if any path designated
for removal still exists in the candidate tree.

## Remaining Review

This record proves the bounded technical inventory and source disposition. It
does not replace the independent source/license review required by #311, nor
does it decide contest eligibility or organizer policy.
