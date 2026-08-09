# External-attested finish: a walkthrough

How a Java/Spring project reaches a finish backed by a GitHub-signed
attestation, written from an end-to-end run rather than from the code.

Every command and every output below is from that run — a public consumer
repository, `persona-harness@0.8.0-beta.34` installed from the registry, no
local build of the harness.

This is not a support claim and not a promise that the path is stable. It
records what worked on 2026-08-09 and, more usefully, the three places it did
not work at first.

## The two assurance modes

| mode | what it attests | needs |
| --- | --- | --- |
| `cooperative` | Persona Harness ran the build itself, in this process, under a read boundary | a git worktree, a build that actually runs, darwin or linux |
| external attested | a GitHub Actions run signed a receipt over your source, and this project consumed it once | a public repository, an enrolled workflow |

Cooperative is the local path. External attested is the one this document
covers.

## Setup

The consumer must be a **public** repository. The reusable producer workflow
refuses anything else:

```yaml
if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    && github.event.repository.private == false
```

Add one caller workflow, pinning the producer to an immutable commit:

```yaml
# .github/workflows/project-finish.yml
name: Project finish attestation

on:
  push:
    branches:
      - main

permissions:
  contents: read
  id-token: write
  attestations: write
  artifact-metadata: write

jobs:
  attest:
    uses: jyt6640/persona-harness/.github/workflows/persona-harness-project-finish.yml@<producer-commit-sha>
```

A branch ref will not do. The attestation binds caller and producer workflow
identities, so a moving ref makes the signed claim unverifiable.

## Enrolling

Enrollment is deliberately interactive. Project content cannot enroll or mutate
trust, so this cannot be scripted:

```bash
GH_TOKEN="$(gh auth token)" npx ph authority enroll github \
  <owner>/<repo> --workflow .github/workflows/project-finish.yml
```

```
Confirm public consumer-authority enrollment? [y/N]
```

Without a TTY it refuses:

```
Consumer authority enrollment requires interactive confirmation.
```

The trust store is `~/.persona-harness`, per user rather than per project.

## The sequence

```bash
npx ph authority fetch github <owner>/<repo> --json
npx ph workflow finish implement
```

```
fetch    state: trusted | eligible: true | consumption: unconsumed
finish   exit 0   Finish status: PASS
status   Consumption: consumed
```

Running finish again is refused:

```
exit 1   Blocker: trusted-authority-required
```

One attestation, one consumption. Fetching after consumption still reports
`trusted`, with `consumption: consumed`.

## Three things that will stop you

These are the whole reason this document exists. Each one cost real time in the
run it is drawn from.

### 1. Fill the workflow reports *before* you push

Source identity includes `.persona/workflow`, so the attestation signs the
reports as they were at push time. Filling them afterwards puts the working tree
out of step with what was signed, and the finish is refused.

Do the work, fill `implementation-report.md` and `review-report.md`, run
`ph plan --report-filled …` for both, **then** commit and push. The attestation
that run produces covers the completed state.

### 2. A clean `git status` is not clean source

This one is genuinely invisible. During the run:

```
head            matched
package version matched
entryCount      matched
gitStatusDigest matched
git status --porcelain --untracked-files=all   zero entries
```

and the fetch was still refused with `source-drift`.

The cause was `gradlew.bat`:

```
working copy : CRLF 93
committed    : LF   93
git status   : clean
```

Git normalizes line endings, so a file's working-tree bytes can differ from the
bytes that were committed and signed while `git status` reports nothing. Source
identity hashes working-tree bytes.

Since #223 the diagnostic names this case directly:

```
source.workingTreeBytesDifferFromMatchingGitIndex
```

The fix is to make the working tree match the index — `git config core.autocrlf
false` and re-checkout the affected file, or normalize line endings in the
repository.

### 3. Name the repository when more than one is enrolled

The store is per user, so a second enrolled repository makes an unqualified
fetch ambiguous:

```
state: selection-required
```

Pass the slug. Fetch will not guess.

## What this does not give you

- **It is not a quality claim.** The attestation says a signed GitHub run
  produced a receipt over this source and that this project consumed it once. It
  says nothing about whether the code is good.
- **It is not available everywhere.** The cooperative verifier and the source
  read boundary need a native artifact built for darwin and linux only. `ph
  doctor` states the scope for your platform — see #217.
- **Expiry, wrong repository or workflow or ref, excluded pull-request and fork
  paths, malformed artifacts, and denied network** are all enforced, but were not
  exercised in the run behind this document. They are covered by the repository's
  own tests.
