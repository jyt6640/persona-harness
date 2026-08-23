# Independent Spring Pilot Protocol

Status: recruitment and preregistration template only. This document does not
record a participant, an outcome, or a usefulness claim.

This protocol supports the consented independent-maintainer pilot tracked in
[#317](https://github.com/jyt6640/persona-harness/issues/317). It does not
replace the source-provenance review in [#311](https://github.com/jyt6640/persona-harness/issues/311),
and a synthetic model run is never a participant observation. The public
interest route is [Discussion #366](https://github.com/jyt6640/persona-harness/discussions/366).

## Interest Is Not Enrollment

An expression of interest is not a pilot start. Do not ask a prospective
participant to install, run, or evaluate Persona Harness until the owner has
completed the preregistration record below and the person has explicitly
consented.

Keep contact details, private correspondence, project code, prompts,
credentials, repository URLs, and private paths out of the public record.

## Owner Preregistration Record

Before the first participant starts, create one immutable, public-safe record
that contains only the following fields:

| Field | Required value |
| --- | --- |
| Candidate identity | Exact source SHA, package version, registry tarball digest, and assurance tier. |
| Cohort denominator | Three to five participant pseudonyms, such as `P-01` through `P-05`; every accepted start is included. |
| Independence | For each pseudonym, a bounded relationship category: `none`, `past collaborator`, or `other disclosed relationship`. |
| Compensation | `none`, `fixed`, or `other disclosed arrangement`; never publish an amount or personal payment detail. |
| Task | One safe disposable or shareable Java/Spring project task, with its expected install and BLOCK-to-PASS path. |
| Time budget | A single time limit and stop rule applied to every participant. |
| Intervention policy | What the maintainer may answer, and how every intervention will be counted. |
| Claim rule | The `ACCEPT`, `REJECT`, or `INCONCLUSIVE` rule from #317. |

The owner retains any mapping from a pseudonym to a person privately. Do not
replace a cohort member after outcomes are visible. A person who withdraws or
stops remains in the public denominator with a bounded reason.

## Consent Check

Before a session, each participant must affirm all of the following:

1. Participation is optional and may stop at any time without giving a reason.
2. The result can be positive, negative, or inconclusive, and every started
   session is included in the aggregate.
3. The maintainer will not run commands for the participant while calling the
   result independent.
4. The public aggregate will not include project code, prompts, credentials,
   private paths, or unredacted command output.
5. The participant may review their normalized public record before it is
   published.

If consent is absent or unclear, do not start the session and do not count the
person as an observed participant.

## Session Protocol

1. Give the participant the frozen candidate and the preregistered task only.
2. Use a safe disposable or shareable Java/Spring project. Do not collect a
   private production repository.
3. Let the participant run the canonical install and workflow commands. Record
   install success or stop, first BLOCK, Gradle/JUnit progress, cooperative
   PASS or stop, elapsed time at each stage, and any intervention.
4. Normalize notes immediately: preserve a bounded failure category and
   command stage, but remove code, prompts, credentials, private paths, and
   raw logs.
5. Stop when the participant elects to stop or the common time budget expires.
   Do not turn a timeout into a retry or substitute another participant.

## Per-Participant Public-Safe Record

Use one record for each accepted start:

| Field | Allowed values |
| --- | --- |
| Pseudonym | Preregistered participant id only. |
| Candidate | Exact preregistered identity; a mismatch invalidates the result. |
| Install | `pass` or bounded `stop` category. |
| First BLOCK | `reached`, `not-reached`, or bounded stop category. |
| Gradle/JUnit | `reached`, `not-reached`, or `not-applicable`. |
| Cooperative PASS | `reached`, `not-reached`, or bounded stop category. |
| Elapsed stages | Rounded durations for install, first BLOCK, and finish/stop. |
| Maintainer intervention | `none` or preregistered category and count. |
| Defect | `none` or bounded public-safe defect category. |
| Final outcome | `completed`, `stopped`, `abandoned`, or `invalid-candidate`. |

`invalid-candidate` means the observation cannot support a claim, but it must
still appear in the aggregate. Do not silently discard it.

## Aggregate And Decision

Publish the frozen candidate identity, denominator, every final outcome,
aggregate counts, disclosed relationships and compensation categories, and the
reviewer result. Do not publish a result until every started participant has a
record.

Apply the #317 rule exactly:

- `ACCEPT` requires at least two-thirds of the cohort to reach the canonical
  BLOCK, at least two participants to reach cooperative PASS without the
  maintainer operating their commands, at least one observation on the final
  frozen candidate, and no unresolved P0 defect invalidating the path.
- `REJECT` applies when the preregistered rule is not met and the evidence is
  sufficient to make that determination.
- `INCONCLUSIVE` applies to missing consent, candidate mismatch, incomplete
  retrieval, denominator drift, hidden intervention, or a privacy violation.

The decision is a bounded first-run usefulness statement only. It does not
establish long-term adoption, productivity, generated-code quality, or
security.

## Prohibited Shortcuts

- Do not count models, fixtures, maintainers, employees, or simulated users as
  independent participants.
- Do not replace a stopped observation with a more favorable one.
- Do not change the candidate or task after the first outcome is seen.
- Do not convert an early-adopter issue into a pilot record without the frozen
  cohort and consent check.
- Do not publish a testimonial-like excerpt in place of the complete
  aggregate.
