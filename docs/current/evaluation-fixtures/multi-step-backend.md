# Multi-Step Backend Project

Build a backend service for a small incident tracking system used by an operations team.

The project should favor a layered backend shape with explicit request validation, domain rules, persistence, and tests.
The evaluator will check whether the generated project can be built, tested, and smoke-tested from a clean checkout.

## User Story

An operations lead needs to capture incidents, assign them to responders, track remediation work, and produce a lightweight status summary without using a spreadsheet.

## Domain Model

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
- status: `open`, `triaged`, `mitigating`, `resolved`, or `closed`
- description
- reporter email
- assigned team member id, optional
- created timestamp
- updated timestamp

### Work Log

- id
- incident id
- author team member id
- message
- created timestamp

## Phase 1: Basic Records

Implement operations for:

- create a team member;
- list active team members;
- create an incident;
- read an incident by id;
- list incidents by status and severity;
- add a work log entry to an incident;
- list work logs for an incident.

## Phase 2: Assignment Rules

Implement assignment behavior:

- only active team members can be assigned;
- observers cannot own incidents;
- a critical incident must have an assigned owner before it can move to `mitigating`;
- assignment changes should update the incident timestamp.

## Phase 3: Status Rules

Implement status transitions:

- new incidents start as `open`;
- `open` can move to `triaged`;
- `triaged` can move to `mitigating` or `closed`;
- `mitigating` can move to `resolved`;
- `resolved` can move to `closed`;
- `closed` cannot move to another status;
- invalid transitions should return a clear validation error.

## Phase 4: Summary View

Provide a summary operation with:

- total incident count;
- count by severity;
- count by status;
- number of critical incidents that are not closed;
- number of incidents without an assigned owner.

## Nonfunctional Requirements

- Keep business rules testable outside transport handlers.
- Document build, test, and run commands.
- Include a simple runtime smoke path that can be executed manually.
- Prefer readable names and small modules over clever abstractions.

## Test Expectations

Include automated tests for:

- creating and reading an incident;
- rejecting invalid severity;
- rejecting observer assignment;
- requiring owner before critical mitigation;
- rejecting invalid status transitions;
- summary counts after several incidents are created.

## Evaluation Notes

The eval runner will score build success, test success, runtime smoke success, stack alignment, requirement coverage, and failure modes.
Do not optimize for Persona Harness evidence; optimize for a working backend service.
