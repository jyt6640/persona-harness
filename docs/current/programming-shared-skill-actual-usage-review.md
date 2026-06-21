# Programming Shared-skill Actual Usage Review

## Goal

Check whether the `programming` shared skill is actually being used in the Java backend actual run, and whether it replaces or merely supports the `.persona/rules` backend guidance.

## Original Actual Run

Project: `/Users/yongtae/Desktop/persona-harness-artifacts/generated-apps/persona-real-demo`

Observed evidence:

- Phase 0 evidence count: 4
- Targets: `README.md` only
- File role: `project-bootstrap`
- Selected rules: `backend/java-backend-bootstrap.md`
- Selected shared skills: none
- Model-input injection: README bootstrap only

Conclusion:

- programming shared-skill selected: no
- programming shared-skill injected into model input: no
- frontend shared-skill leaked into Java backend run: no
- programming replaced `.persona` backend rules: no
- actual backend shape effect: weak
- decision: keep as limited active support, do not treat as productized multi-domain feature

## Clean Revalidation Run

Project: `/Users/yongtae/Desktop/persona-harness-artifacts/generated-apps/persona-real-demo-2`

Observed evidence:

- Phase 0 evidence count: 13
- Targets:
  - `README.md`
  - `ReservationService.java`
  - `ThemeService.java`
  - `WaitingService.java`
- File roles:
  - `project-bootstrap`: 4
  - `service`: 9
- Selected shared skills:
  - `programming`: 9
  - `frontend`: 0
- Selected backend rules for Java Service targets:
  - `clean-code/common.md`
  - `clean-code/method-design.md`
  - `backend/java-common.md`
  - `backend/spring-service.md`
  - `backend/validation-exception.md`

## Interpretation

The `programming` shared skill is active for Java files, but it acts as a support surface. It did not replace backend rule selection: Java Service targets still selected backend rules, and README bootstrap still selected `backend/java-backend-bootstrap.md`.

It also did not leak frontend guidance into the Java backend actual run.

## Limitation

The evidence only appears when OpenCode reads or edits a target file. In the clean rerun, Java target evidence appeared for services because the model read service files while debugging and compiling. There was no observed Controller, DTO, Repository, or Gradle model-input evidence.

## Decision

Keep `programming` as limited active support for Java/Gradle targets. Do not treat it as the productized source of Java backend architecture rules, and do not expand this loop into frontend/infra/multi-domain productization.
