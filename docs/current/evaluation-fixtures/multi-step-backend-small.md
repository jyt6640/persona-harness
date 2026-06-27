# Small Multi-Step Backend Project

Build a backend service for a small incident tracking system used by an operations team.

This is a reduced-scope variant of the multi-step backend fixture. Keep the same Java/Spring backend preference when guidance is available, but limit the implementation to the first few workflow-sized requirements so the eval can distinguish scope-size timeout from core workflow failure.

## User Story

An operations lead needs to capture incidents, assign active responders, and read a lightweight incident summary without using a spreadsheet.

## Core Records

### Team Member

- id
- name
- email
- role: `lead`, `responder`, or `observer`
- active flag

### Incident

- id
- title
- severity: `low`, `medium`, `high`, or `critical`
- status: `open`, `triaged`, or `mitigating`
- reporter email
- assigned team member id, optional
- created timestamp
- updated timestamp

## Required Operations

Implement operations for:

- create a team member;
- list active team members;
- create an incident;
- read an incident by id;
- assign an active non-observer team member to an incident;
- move an incident from `open` to `triaged`;
- move a `triaged` incident to `mitigating` only when it has an assigned owner.

## Validation and Rules

- Reject team member creation when email is missing or malformed.
- Reject incident creation when severity is invalid.
- Reject assignment to inactive team members.
- Reject assignment to observers.
- Reject moving a critical or non-critical incident to `mitigating` when no owner is assigned.
- Reject invalid status transitions with a clear validation error.

## Summary View

Provide a summary operation with:

- total incident count;
- count by severity;
- count by status;
- number of incidents without an assigned owner.

## Nonfunctional Requirements

- Keep business rules testable outside transport handlers.
- Persist data across process restarts in whatever local persistence mechanism is appropriate for the chosen implementation.
- Document build, test, and run commands.
- Include a simple runtime smoke path that can be executed manually.

## Test Expectations

Include automated tests for:

- creating and reading an incident;
- rejecting invalid severity;
- rejecting observer assignment;
- requiring owner before mitigation;
- summary counts after several incidents are created.

## Evaluation Notes

The eval runner will score build success, test success, runtime smoke success, stack alignment, workflow closure, and failure modes.
Do not optimize for Persona Harness evidence; optimize for a working backend service.
