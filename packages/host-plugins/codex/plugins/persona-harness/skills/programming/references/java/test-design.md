# Test Design

Load this for every Java test and before changing test strategy. It distills TDD, unit testing quality, and xUnit pattern topics: red-green-refactor, regression protection, refactoring resistance, fast feedback, maintainability, fixtures, exercise/verify/teardown, test doubles, test smells, and design for testability.

## TDD Loop

For new behavior, prefer:

1. Red: write a small failing test for public behavior.
2. Green: implement the minimum behavior.
3. Refactor: improve names, duplication, object boundaries, and structure while tests stay green.

Do not write broad speculative production code and then add tests that merely describe what you already wrote.

## Test Quality

A valuable test balances four forces:

| Force | Meaning |
|---|---|
| regression protection | fails when important behavior breaks |
| refactoring resistance | stays green when implementation changes but behavior does not |
| fast feedback | runs at the speed appropriate to its layer |
| maintainability | is easy to read, update, and diagnose |

Tests that know too much about implementation lose refactoring resistance. Tests that execute too little meaningful behavior lose regression protection.

## Test Shape

Use Given/When/Then or Arrange/Act/Assert.

- Given: only the required fixture.
- When: one action.
- Then: observable outcome and important side effects.

One test should fail for one behavioral reason.

## xUnit Four Phases

1. Fixture setup.
2. Exercise the system under test.
3. Verify result.
4. Fixture teardown.

Keep these phases visible. If setup is larger than the behavior, simplify the design or introduce named fixture builders.

## Test Doubles

| Double | Use |
|---|---|
| dummy | required argument not used by the test |
| stub | returns canned data |
| fake | working lightweight implementation, often in-memory |
| spy | records interactions for later assertion |
| mock | pre-programmed interaction expectation |

Default preference:

1. real object;
2. fake for ports/stores when real infra is too slow;
3. testcontainer/real service for integration truth;
4. mock only for delegation seams or true unmockables.

Do not mock value objects, entities, or pure domain behavior.

## Unit, Integration, Acceptance

| Layer | Purpose |
|---|---|
| unit | exercise domain/policy/value/service logic at the smallest truthful boundary |
| integration | verify adapters with real framework/DB/network boundary |
| acceptance | prove a user-visible scenario through the deployed surface |
| architecture | enforce dependency direction and forbidden imports |

Do not pretend a mock-heavy unit test proves integration.

## Design For Testability

Testable Java code tends to have:

- constructor-injected dependencies;
- explicit clocks/randomness/IDs when behavior depends on them;
- small objects with clear responsibilities;
- ports around external systems;
- pure domain behavior independent of frameworks;
- no static mutable state;
- no hidden background threads.

## Test Smells

| Smell | Fix |
|---|---|
| fragile test | assert behavior, not internal steps |
| obscure test | simplify fixture, name constants/builders |
| mystery guest | inline or name external fixture data |
| test logic | remove branches/loops from tests |
| excessive setup | split SUT or use named fixture builder |
| over-mocking | use fake or real object |
| slow unit test | move infra to integration layer |
| flaky timing | replace sleeps with deterministic signals |
| assertion roulette | one behavior per test, clear assertion messages |

## Naming

Use this method-name convention:

```text
methodName_ExpectedResult_TestState
```

Examples:

- `isAdult_False_AgeLessThan18`
- `withdrawMoney_ThrowsException_IfAccountIsInvalid`
- `admitStudent_FailToAdmit_IfMandatoryFieldsAreMissing`
- `register_ReturnsMember_WhenCommandIsValid`
- `register_ThrowsBusinessException_WhenEmailIsDuplicated`

Rules:

- `methodName` is the production method or public behavior under test.
- `ExpectedResult` is the observable result: `True`, `False`, `ReturnsMember`, `ThrowsException`, `ThrowsBusinessException`, `FailToAdmit`.
- `TestState` names the condition/state: `AgeLessThan18`, `IfAccountIsInvalid`, `WhenEmailIsDuplicated`.
- This convention is method-name-coupled, so when production method names change, update tests in the same refactor.

Korean `@DisplayName` is acceptable when it improves product-domain readability.

## Refactoring Tests

Refactor tests when:

- production refactoring requires implementation-coupled tests to change;
- fixture setup hides intent;
- assertions are duplicated and noisy;
- multiple tests fail for one underlying reason;
- a test no longer protects meaningful behavior.

Never delete a failing test to make CI green. Fix the product or fix the test's claim.

## Review Checklist

- Does the test name describe behavior?
- Does the test fail for a real regression?
- Would it survive a harmless implementation refactor?
- Is setup minimal and visible?
- Is there exactly one main action?
- Are doubles chosen for truth, not convenience?
- Are slow tests in the right layer?
- Are async/time-dependent tests deterministic?
