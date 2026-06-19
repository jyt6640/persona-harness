# Backend Product Code Style Direction

## Context

`example/src` is a reference answer for the user's preferred backend product code style, not a universal roomescape or step1 contract.

The current goal is not a test-observer track. The current goal is to make generated backend product code come out with a consistent Clean Code based flow when the same requirements and technology choices are given.

## Core Direction

Persona Harness should have two distinct layers:

1. Default Clean Code / backend baseline.
2. Optional philosophy harness selected by the user or project.

If no personal/team/project philosophy is provided, the harness should use the default Clean Code and backend baseline. It should ask only the minimum project-shaping questions needed to choose a reasonable architecture and technology plan before implementation.

If a backend philosophy is provided, the harness should apply it naturally on top of the baseline for backend work. The same future pattern can exist for frontend and infrastructure, but that is not part of the current implementation target.

## What Is Fixed Now

- Gradle is fixed as the Java/Spring build tool.
- Maven evidence and Maven fixtures should be discarded for future primary decisions.
- Product code quality and uniform code flow are the active concern.
- Test style and test-contract rules are deferred to a separate later section.
- The roomescape step labels are study fixture labels, not product concepts to hard-code into general rules.

## Default Backend Baseline

The default backend baseline should prefer:

- Controller / Service / Repository / DTO responsibility separation.
- presentation / application / domain / infrastructure layer boundaries.
- Upper layers may know lower layers, but direct skip-layer coupling is avoided.
- Domain is an independent layer that can be used by Application Service and Infrastructure, while Domain does not know Infrastructure.
- Service as application/use-case flow orchestration.
- Repository as persistence/storage access boundary.
- DTOs as external API request/response contracts.
- Domain naming and package naming derived from the project domain, not from the roomescape example.
- Code that is easy to read, analyze, and refactor over code that only passes tests.

The baseline should not force a specific persistence stack such as H2, JdbcTemplate, JPA, MyBatis, Flyway, or schema.sql unless the user chooses that stack or the project requirements imply it.

## Strong Rule Candidates

These are strong enough to be considered baseline rule or prompt candidates:

- Java/Spring projects use Gradle by default and do not generate Maven files.
- Application Service does not directly own storage state or id sequence such as `List`, `Map`, `AtomicLong`, `nextId`, `idCounter`, or `sequence`.
- Application Service coordinates business/use-case flow; storage and id generation belong behind Repository or another explicit persistence boundary.

## Not Current Rule Candidates

These should not be hard-coded as current product rules:

- H2 as the default database.
- JdbcTemplate as the universal persistence style.
- schema.sql as the universal migration mechanism.
- roomescape package names or endpoint fields.
- step1/step2-3 as product architecture concepts.
- RestAssured, MockMvc, or any test style.

Those can be fixture choices, user choices, or later testing policy decisions.

## Intake Layer Boundary

Project-shaping questions belong to the future philosophy/intake harness, not directly to today's baseline rule set.

For backend, the intake should ask about:

- project scale and lifecycle
- personal vs team project
- selected or preferred persistence technology
- database vs file vs external API vs other storage
- migration style such as schema.sql, Flyway, or Liquibase
- preferred architecture depth based on project size
- DTO strictness and package structure

For frontend and infrastructure, the same pattern should exist later: ask about scale, selected stack, deployment/runtime assumptions, and style preferences, then propose a plan before implementation.

## Product Flow

The desired workflow is:

1. User describes a project or feature.
2. Harness detects the role/domain, such as backend.
3. If a project/team/personal philosophy exists, apply it.
4. If not, ask the minimum architecture and stack questions.
5. Agent proposes a plan based on requirements, scale, and selected stack.
6. User answers or confirms.
7. Agent implements using the default Clean Code baseline plus any selected philosophy.

## Shared Skill Boundary

OMO's `packages/shared-skills` structure is now vendored under `packages/shared-skills` as the reusable agent guidance package shape.

The desired behavior is OMO-like skill loading with Persona-specific domains. The harness should eventually feel like it can naturally pull the right skill for the work, but the content should be specialized around backend, frontend, and infrastructure instead of copied as a generic OMO workflow.

Programming discipline should live in that shared skill style layer, not inside the current Java/Spring backend rule baseline. This lets backend, frontend, and infrastructure reuse the same skill package shape while keeping today's deterministic `.persona/rules` narrow.

For TypeScript, the future reference should be React/frontend oriented by default because the expected TypeScript work is frontend work. Backend TypeScript stacks can remain optional references rather than a default Persona Harness assumption.

## Non-Goals

- Do not turn `example/src` into a universal code template.
- Do not hard-code roomescape requirements into general backend rules.
- Do not move test style into the current product-code-quality track.
- Do not implement frontend/infra/profile-aware routing in this loop.
- Do not wire OMO shared-skills or workflow machinery into the current backend baseline.
- Do not claim product-quality certification from the existence of the baseline.

## First Implementation

The first backend product-code uniformity implementation is:

- Gradle-only Java/Spring baseline.
- Application Service storage/id sequence ownership prohibition.

This is narrow, aligned with the user's Clean Code direction, and directly connected to the latest Gradle A/B mixed signal.

## Gradle A/B Recheck

A Gradle canonical A/B actual generated pair was run with `openai/gpt-5.4-mini-fast`.

The result is mixed:

- Both Injection ON and OFF kept `build.gradle`/`settings.gradle` and did not create `pom.xml`.
- Both kept storage state and id sequence out of `ReservationService`.
- Injection ON separated request and response DTOs.
- Injection OFF returned domain `Reservation` in the response path and had one intermediate failed `gradle test` before fixing it.

This is useful evidence, but not proof that the baseline improves product quality. The prompt itself already strongly asked for Gradle, so Maven avoidance is not isolated to injection.

## Next Decision

The next A/B pass should focus on response DTO/code-shape uniformity instead of Gradle-only or Service storage ownership.

The practical decision is whether to reinforce response DTO boundary as backend Clean Code baseline guidance, or run one more parallel A/B set before changing rules.

## Response DTO Boundary Recheck

Response DTO boundary was minimally reinforced in the backend baseline and rechecked with two Gradle A/B pairs.

The result did not preserve the earlier ON-positive differential signal. Controller response DTO boundary appeared in both ON and OFF runs. One ON run still returned domain `Reservation` from Service and converted in Controller, while the matching OFF run returned `ReservationResponse` from Service.

The next useful code-shape target is stricter Service response DTO placement or package/class duplication noise, not simply requiring a `*Response` type to exist.
