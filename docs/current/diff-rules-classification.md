# Diff Rules Classification

T6 classifies the reference-only files under `references/diff-rules/` for
future Role Rules work. It does not migrate rules, create conventions, change
runtime behavior, or claim product effectiveness.

## Count

- Directory scanned: `references/diff-rules/`
- Files found: `50`
- Files classified: `50/50`

## Classification Labels

- `[게이트 가능]`: a future T8 candidate can inspect the rule mechanically.
  The row names a possible inspection method and expected convention id.
- `[PH 기존 rule과 중복]`: the file overlaps current PH rule, observer, or
  workflow-gate surfaces and should not be copied as a separate rule without
  deduplication.
- `[전달 전용]`: the file is guidance for a role/checklist/prompt surface. It
  should be delivered to the named role rather than converted directly into a
  gate.

## Classification Table

| # | File | Classification | Rationale | Delivery target or gate candidate |
| ---: | --- | --- | --- | --- |
| 1 | `references/diff-rules/architecture/domain-boundary.md` | `[게이트 가능]` | Domain should not depend on persistence/web/framework types, which is import/path inspectable. | ast-grep/import observer; candidate convention id `domain.no-technology-import`. |
| 2 | `references/diff-rules/architecture/index.md` | `[전달 전용]` | Overview page routes to detailed architecture topics and is not a standalone gate. | Target role: `main` for planning/context selection. |
| 3 | `references/diff-rules/architecture/layered-architecture.md` | `[PH 기존 rule과 중복]` | Layer responsibility overlaps existing controller/repository, service state, DTO, and rule-selection surfaces. | Deduplicate against `controller.repository-dependency`, `service.state-ownership`, `dto.boundary`, and backend rule injection. |
| 4 | `references/diff-rules/architecture/package-structure.md` | `[게이트 가능]` | Domain-first/layer package shape can be inspected from Java source paths. | tree observer; candidate convention id `architecture.domain-first-package-structure`. |
| 5 | `references/diff-rules/architecture/repository-pattern.md` | `[게이트 가능]` | Repository interface location and adapter direction can be inspected by path/import scan. | observer; candidate convention id `repository.interface-in-domain`. |
| 6 | `references/diff-rules/architecture/transactions.md` | `[게이트 가능]` | `@Transactional` placement is inspectable on Controller/Service/Repository classes and methods. | ast-grep; candidate convention id `transaction.boundary-in-service`. |
| 7 | `references/diff-rules/decisions/README.md` | `[전달 전용]` | Decision-directory operating guide, not a code rule. | Target role: `main` for roadmap/decision maintenance. |
| 8 | `references/diff-rules/decisions/accepted/domain-does-not-know-technology.md` | `[게이트 가능]` | Accepted decision maps to domain-layer framework/persistence import checks. | ast-grep/import observer; candidate convention id `domain.no-technology-import`. |
| 9 | `references/diff-rules/decisions/accepted/domain-first-package-structure.md` | `[게이트 가능]` | Accepted decision can be checked by package/path layout and role discovery. | tree observer; candidate convention id `architecture.domain-first-package-structure`. |
| 10 | `references/diff-rules/decisions/accepted/domain-first-testing.md` | `[PH 기존 rule과 중복]` | Test ordering overlaps existing `workflow tdd`, test-writer rail, and PH evidence gates. | Deduplicate against `workflow tdd` and Role Checklist Relay `test-writer`. |
| 11 | `references/diff-rules/decisions/accepted/domain-validation-over-getter.md` | `[전달 전용]` | Getter-vs-behavior design requires semantic judgment beyond current safe observers. | Target role: `implementer`. |
| 12 | `references/diff-rules/decisions/accepted/exception-hierarchy.md` | `[전달 전용]` | Exception hierarchy is design guidance unless a later project-specific hierarchy is configured. | Target role: `implementer`. |
| 13 | `references/diff-rules/decisions/accepted/explicit-over-reuse.md` | `[전달 전용]` | Early abstraction/reuse judgment is contextual and not a precise gate. | Target role: `implementer`. |
| 14 | `references/diff-rules/decisions/accepted/fake-over-mock-in-service-test.md` | `[전달 전용]` | Fake-vs-mock choice is test design guidance and should be delivered before test writing. | Target role: `test-writer`. |
| 15 | `references/diff-rules/decisions/accepted/policy-object-separation.md` | `[전달 전용]` | Policy extraction depends on domain size/semantics and is not mechanically safe yet. | Target role: `implementer`. |
| 16 | `references/diff-rules/decisions/accepted/public-behavior-based-tdd.md` | `[PH 기존 rule과 중복]` | Public-behavior TDD overlaps existing TDD rail and test evidence expectations. | Deduplicate against `workflow tdd` and `test-writer` guidance. |
| 17 | `references/diff-rules/decisions/accepted/repository-interface-in-domain.md` | `[게이트 가능]` | Repository port placement is inspectable by path/package/import direction. | observer; candidate convention id `repository.interface-in-domain`. |
| 18 | `references/diff-rules/decisions/accepted/request-command-separation.md` | `[게이트 가능]` | Request DTO vs application command separation is inspectable by class naming and package flow. | observer/ast-grep; candidate convention id `dto.request-command-separation`. |
| 19 | `references/diff-rules/decisions/accepted/service-orchestration-only.md` | `[전달 전용]` | Whether a service only orchestrates is semantic; current PH only gates narrower service-state ownership. | Target role: `implementer`. |
| 20 | `references/diff-rules/decisions/accepted/small-service-method.md` | `[게이트 가능]` | Service method size can be measured mechanically with a conservative line/statement threshold. | ast-grep/tree metric; candidate convention id `service.small-method`. |
| 21 | `references/diff-rules/decisions/accepted/static-factory-method.md` | `[게이트 가능]` | Domain constructor visibility/static factory presence can be inspected for selected domain classes. | ast-grep; candidate convention id `domain.static-factory-construction`. |
| 22 | `references/diff-rules/decisions/accepted/transaction-boundary-in-service.md` | `[게이트 가능]` | Accepted transaction-boundary decision maps to annotation placement checks. | ast-grep; candidate convention id `transaction.boundary-in-service`. |
| 23 | `references/diff-rules/decisions/pending/aggregate-boundary.md` | `[전달 전용]` | Pending aggregate split/merge criteria require product-domain judgment. | Target role: `main` for design decision, then `implementer`. |
| 24 | `references/diff-rules/decisions/pending/domain-entity-separation.md` | `[전달 전용]` | Pending entity separation is a design tradeoff, not a stable gate. | Target role: `implementer`. |
| 25 | `references/diff-rules/decisions/pending/event-driven-boundary.md` | `[전달 전용]` | Event boundaries depend on integration/consistency requirements and remain pending. | Target role: `main`. |
| 26 | `references/diff-rules/decisions/pending/fake-package-location.md` | `[전달 전용]` | Fake package placement is test organization guidance while the decision is pending. | Target role: `test-writer`. |
| 27 | `references/diff-rules/decisions/pending/security-auth-pattern.md` | `[전달 전용]` | Security/auth approach is intentionally deferred until a concrete project needs it. | Target role: `main`. |
| 28 | `references/diff-rules/decisions/pending/validator-package-location.md` | `[전달 전용]` | Validator placement remains a design decision tied to project boundary choices. | Target role: `implementer`. |
| 29 | `references/diff-rules/decisions/rejected/anemic-domain-model.md` | `[전달 전용]` | Anemic-domain detection needs behavior semantics and can be misleading as a pure syntax gate. | Target role: `implementer`. |
| 30 | `references/diff-rules/decisions/rejected/common-util-package.md` | `[게이트 가능]` | Broad `common/util` package creation can be detected mechanically. | tree/path observer; candidate convention id `architecture.no-common-util-package`. |
| 31 | `references/diff-rules/decisions/rejected/generic-base-class.md` | `[게이트 가능]` | Generic base class names/inheritance are inspectable with conservative naming patterns. | ast-grep; candidate convention id `oop.no-generic-base-class`. |
| 32 | `references/diff-rules/decisions/rejected/generic-manager-class.md` | `[게이트 가능]` | `*Manager` service-like class names are inspectable by class-name/path patterns. | ast-grep; candidate convention id `naming.no-generic-manager-class`. |
| 33 | `references/diff-rules/decisions/rejected/generic-response-wrapper.md` | `[게이트 가능]` | Generic response wrapper classes can be inspected by name and generic type parameters. | ast-grep; candidate convention id `api.no-generic-response-wrapper`. |
| 34 | `references/diff-rules/decisions/rejected/overuse-of-builder-pattern.md` | `[전달 전용]` | Builder overuse is contextual; a syntax-only gate would likely over-block. | Target role: `implementer`. |
| 35 | `references/diff-rules/decisions/rejected/service-layer-business-logic.md` | `[전달 전용]` | Service business-logic placement requires semantic review beyond current safe gates. | Target role: `implementer`; reviewer checks manually. |
| 36 | `references/diff-rules/decisions/rejected/util-based-validation.md` | `[게이트 가능]` | `*Util` validation calls/packages are mechanically discoverable. | ast-grep; candidate convention id `validation.no-util-based-validation`. |
| 37 | `references/diff-rules/principles/architecture-evolution.md` | `[전달 전용]` | Evolution/abstraction timing is planning guidance, not an enforceable code shape. | Target role: `main`. |
| 38 | `references/diff-rules/principles/exceptions.md` | `[전달 전용]` | Exception responsibility guidance should shape implementation and review before a project-specific hierarchy exists. | Target role: `implementer`. |
| 39 | `references/diff-rules/principles/index.md` | `[전달 전용]` | Principles overview routes to detailed role guidance. | Target role: `main`. |
| 40 | `references/diff-rules/principles/method-design.md` | `[PH 기존 rule과 중복]` | Method-size/responsibility guidance overlaps current clean-code method-design injection. | Deduplicate against `clean-code/method-design.md` rule family before any T8 gate. |
| 41 | `references/diff-rules/principles/naming.md` | `[전달 전용]` | Naming examples are broad guidance except for specific future rejected-name gates. | Target role: `implementer`. |
| 42 | `references/diff-rules/principles/oop.md` | `[전달 전용]` | Object responsibility and Tell-Don't-Ask need semantic code review. | Target role: `implementer`; reviewer validates manually. |
| 43 | `references/diff-rules/principles/testing.md` | `[PH 기존 rule과 중복]` | Test taxonomy/fake guidance overlaps existing backend test guidance and TDD rail. | Deduplicate against `backend/spring-test.md`, `workflow tdd`, and `test-writer` guidance. |
| 44 | `references/diff-rules/workflow/code-review.md` | `[전달 전용]` | Review checklist guidance belongs to reviewer role rather than a code gate. | Target role: `reviewer`. |
| 45 | `references/diff-rules/workflow/git-convention.md` | `[전달 전용]` | Commit practice is process guidance and outside Java code gate scope. | Target role: `main`. |
| 46 | `references/diff-rules/workflow/how-to-add-new-feature.md` | `[전달 전용]` | Feature workflow order belongs to planning/role checklist delivery. | Target role: `main`, then `test-writer`/`implementer` as steps split. |
| 47 | `references/diff-rules/workflow/how-to-review-legacy-code.md` | `[전달 전용]` | Legacy review flow is a review strategy, not a deterministic gate. | Target role: `reviewer`. |
| 48 | `references/diff-rules/workflow/index.md` | `[전달 전용]` | Workflow overview routes to detailed workflow guidance. | Target role: `main`. |
| 49 | `references/diff-rules/workflow/refactoring.md` | `[전달 전용]` | Refactoring priority and timing need human/agent judgment. | Target role: `implementer`; reviewer checks behavior preservation. |
| 50 | `references/diff-rules/workflow/tdd.md` | `[PH 기존 rule과 중복]` | TDD flow overlaps existing `workflow tdd`, PH-generated evidence, and test-writer rail. | Deduplicate against `workflow tdd` and `test-writer` guidance. |

## Boundary

This table fixes T6 scope for future T8 work only. It is not a convention
migration, not a new gate, not evidence-schema movement, not a default change,
and not a product-effectiveness claim.
