# What it takes to reach a first verified completion

The project has no measurement of how much work stands between installing
Persona Harness and getting a PASS. This is that measurement, taken on
2026-08-09 by running both assurance modes end to end on a real Java/Spring
project with `persona-harness@0.8.0-beta.34` installed from the registry.

It is one operator on one day. Read the limits at the bottom before quoting any
number here.

## The path, as it actually ran

Every row is a refusal that had to be resolved before the next one appeared.
"Documented" means the step was named in `ph go`'s rail or in the docs **at the
time the run happened**.

### Cooperative PASS

| | refusal | what resolved it | documented then |
| ---: | --- | --- | :---: |
| 1 | `verification-unknown` | `ph bearshell './gradlew test'` | yes |
| 2 | `report-coverage-missing` | fill both reports to the literal patterns | partly |
| 3 | `java-role-read-coverage-missing` | `ph evidence read <path>` per file | **no** |
| 4 | `git-worktree-root-mismatch` | `git init` and commit | **no** |
| 5 | `build-command-failed` | make the build actually succeed | yes |
| 6 | `build-task-nonfresh` | `./gradlew clean` first | **no** |
| 7 | — | `--assurance cooperative` | **no** |

**PASS.** Seven steps, four of them unnamed anywhere a reader would look.

### External-attested PASS

| | refusal | what resolved it | documented then |
| ---: | --- | --- | :---: |
| 8 | not enrolled | `ph authority enroll` at a TTY | yes |
| 9 | `selection-required` | name the repository slug | **no** |
| 10 | `binding-mismatch` → `source-drift` | `gradlew.bat` held CRLF against LF; `git status` clean | **no** |
| 11 | phVersion mismatch | wait for the governed publish | n/a — an artefact of this run's timing |
| 12 | `source-drift` again | fill the reports **before** pushing | **no** |

**PASS.** Five more steps, four unnamed.

## The number

**Twelve refusals to a first verified completion. Eight of them had no
documented resolution at the time.**

Every one of the eight is now covered — the rail names `ph evidence read`,
`git init`, `./gradlew clean`, and `--assurance cooperative` (#215), and the
walkthrough names reports-at-push-time, line-ending drift, and
`selection-required` (#224). By that accounting the documented share moves from
4/12 to 11/12, with the twelfth being a timing artefact rather than a step.

That is the measurement worth repeating: not "did it pass", but **how many
refusals stand in the way and how many of them a reader can resolve without
reading the source.**

## What this does not measure

These are the parts a simulated user cannot supply, and they matter more than
the number above.

- **Abandonment.** I never gave up. A real user weighs each refusal against how
  much they wanted the outcome, and at some point stops. The rate at which they
  stop is the most important number this project does not have, and no amount of
  careful simulation produces it.
- **Wall-clock time.** I read the source when I got stuck. That is not available
  to a user, and it means every duration here is a lower bound on theirs by an
  unknown factor.
- **Surprise.** My expectations came from the codebase. A user's come from other
  tools. What reads as obvious to me may not, and the reverse.
- **Distribution.** One project shape, one operator, one day. Ten users with
  legacy multi-module Spring, Kotlin, or a corporate proxy would hit refusals
  that never appeared here.

## How to repeat it

Follow
[the walkthrough](external-attested-finish-walkthrough.md) exactly, and record
each refusal before resolving it. The discipline that makes the result useful is
simple and easy to lose: **write down where you are stuck before you go looking
for why.** Reaching for the source first destroys the measurement, which is what
happened on several rows above and is why there is no time column.
