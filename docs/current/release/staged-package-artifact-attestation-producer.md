# Staged Package Artifact Attestation Producer

This is the controlled producer for staged-package provenance. The shipped
`ph dev staged-package-provenance` verifier can consume only its independently
fetched GitHub/Sigstore attestations. It does not change the local
`ph dev staged-package` caller-fact boundary, authorize promotion, publish a
package, create a Git tag, move a dist-tag, or affect Finish or closure
authority.

## Controlled Future Run

After a separately approved prerelease has been staged under `staging` or a
separately approved later move uses `next`, an operator may dispatch the
protected-main workflow with exactly:

- one fixed channel: `staging` or `next`;
- one strict SemVer version already selected by that channel.

The workflow rejects all other repository, ref, event, workflow, runner,
package, registry, source, and tag values. It fetches the fixed npm registry
metadata and exact `.tgz` itself, rejects redirects and bounded-input failures,
and writes only a fixed temporary CI artifact directory.

The GitHub artifact attestation subject is the downloaded `package.tgz`, never
the predicate JSON. The fixed
`staged-package-artifact-binding.1` predicate records the selected fixed
channel, package/version, registry `gitHead`, npm SHA-1/SRI, tarball SHA-256,
packed manifest, protected-main source identity, canonical workflow/run
identity, timestamps, nonce, and deferred `v<version>` tag expectation.

## Producer Boundary

The predicate is explicitly producer-only diagnostic data:

- `authorityEligible` is `false`;
- `tagState` is `deferred`;
- only the fixed-policy online verifier may consume it after independently
  fetching and hashing the selected registry tarball;
- locally packed/repacked tarballs and caller-provided facts remain
  `artifact-provenance-unavailable`;
- no Finish PASS, channel promotion, registry mutation, or release claim is
  enabled.

The verifier uses the fixed npm/GitHub/Sigstore policy, validates the exact
signed subject and predicate bindings, and remains read-only and
non-authoritative. Synthetic unit fixtures exercise parsing and binding
failures only; they are not provenance artifacts.

## Implementation Preflight

The exact source branch that introduced this producer had no repository
`AGENTS.md` or `.persona/project-profile.jsonc`; required
`npx ph workflow implement` therefore stopped with `ph: command not found`.
No profile, workflow state, or bootstrap content was created as a workaround.
