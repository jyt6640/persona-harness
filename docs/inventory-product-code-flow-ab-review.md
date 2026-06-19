# Inventory Product-Code Flow A/B Review

## Goal

Run one additional Gradle Java/Spring A/B pair and compare Injection ON/OFF with the backend product-code-flow rubric.

This review is not a product-quality gate and does not judge test style. It asks only whether Injection ON produced clearer backend product-code flow for a comparable Gradle fixture.

## Report Source

- Run: `experiments/phase0-runs/2026-06-19T-inventory-gradle-ab`
- Model: `openai/gpt-5.4-mini-fast`
- Fixture: Inventory Stock API
- ON output: `on-sandbox`
- OFF output: `off-sandbox`

Both ON and OFF completed generation with exit `0`.

Independent verification:

- ON `gradle test --quiet`: exit `0`
- OFF `gradle test --quiet`: exit `0`
- `pom.xml`: absent in both outputs
- `build.gradle` and `settings.gradle`: present in both outputs

## Product-Code Flow Rubric

| Signal | ON | OFF | Reading |
| --- | --- | --- | --- |
| Gradle only | Present | Present | Neutral |
| Single root Application class | Present | Present | Neutral |
| Controller delegates to Service | Present | Present | Neutral |
| Application Service orchestration | Present, but leaks `ResponseStatusException` | Present, but accepts request DTOs | Mixed, slight ON risk |
| Service-owned storage/id sequence absent | Present | Present | Neutral |
| Domain independence | Domain package has stock behavior and no Spring imports | Product record is flat/anemic but no Spring imports | ON clearer |
| Repository interface boundary | Domain `ProductRepository` | Feature-package `ProductRepository` | ON clearer |
| Repository implementation boundary | `infrastructure/InMemoryProductRepository` owns storage/id sequence | Flat `InMemoryProductRepository` owns storage/id sequence | ON clearer by package flow |
| Request DTO boundary | Controller-local request records | Separate request records | Neutral/mixed |
| Response DTO boundary | Controller-local `ProductResponse` used externally | Controller returns domain `Product` | ON clearer |
| Application command/result boundary | Missing | Missing | Neutral missing |
| Package flow shape | `product/application`, `product/domain`, `product/infrastructure`, `product/presentation` | flat `product` package | ON-positive |
| Final Gradle verification | Passed | Passed | Neutral |

## Finding

Injection ON is product-code-flow positive for this pair.

The strongest ON-positive signals are:

- visible `presentation -> application -> domain -> infrastructure` package flow,
- repository interface separated into the domain package and implementation into infrastructure,
- response DTO boundary instead of returning the domain `Product` directly,
- stock-decrease domain behavior placed on `Product`.

The neutral signals matter:

- both outputs stayed Gradle-only,
- both avoided Maven,
- both had one Spring Boot Application class,
- both kept storage state and id sequence out of `ProductService`,
- both passed final Gradle verification.

## Limitations

- ON still leaks Spring HTTP semantics into `ProductService` through `ResponseStatusException`.
- ON keeps request/response records as nested controller records rather than separate DTO files.
- OFF is still a coherent small Spring app; the differential is product-code flow, not product correctness.
- This is one additional A/B pair and does not certify product quality.

## Stopping Rule Impact

This pair counts as `ON-positive`.

Current fixed-window state after this review:

- comparable pairs: 2/3
- ON-positive: 2
- neutral/mixed: 0
- OFF-positive: 0
- decision: `open`

The decision remains open because the fixed evidence window requires 3 comparable Gradle Java/Spring A/B pairs.

## Next Loop

Run or regrade one more comparable Gradle Java/Spring A/B pair. If the third pair is comparable, update `docs/injection-value-status.json` and apply the stopping rule.
