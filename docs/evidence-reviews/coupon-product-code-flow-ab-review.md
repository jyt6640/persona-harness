# Coupon Product-Code Flow A/B Review

## Goal

Run the third comparable Gradle Java/Spring A/B pair and compare Injection ON/OFF with the backend product-code-flow rubric.

This review is not a product-quality gate and does not judge test style. It closes only the fixed 3-pair injection-value evidence window.

## Report Source

- Run: `experiments/phase0-runs/2026-06-19T-coupon-gradle-ab`
- Model: `openai/gpt-5.4-mini-fast`
- Fixture: Coupon Campaign API
- ON output: `on-sandbox`
- OFF output: `off-sandbox`

Execution notes:

- OFF generation completed on the first run.
- ON first attempt failed before generation with OpenCode `database is locked` while OFF was running in parallel.
- ON was rerun after OFF completed and then completed generation with exit `0`.
- The failed ON attempt is treated as execution infrastructure noise, not as an A/B product-code-flow sample.

Independent verification:

- ON `gradle test --quiet`: exit `0`
- OFF `gradle test --quiet`: exit `0`
- ON HTTP smoke: `POST /coupons`, `GET /coupons`, `POST /coupons/1/issue` succeeded on port `18081`.
- OFF HTTP smoke: `POST /coupons`, `GET /coupons`, `POST /coupons/1/issue` succeeded on port `18082`.
- `pom.xml`: absent in both outputs
- `build.gradle` and `settings.gradle`: present in both outputs

## Product-Code Flow Rubric

| Signal | ON | OFF | Reading |
| --- | --- | --- | --- |
| Gradle only | Present | Present | Neutral |
| Single root Application class | Present | Present | Neutral |
| Controller delegates to Service | Present | Missing; Controller depends directly on Repository | ON clearer |
| Application Service orchestration | Present | Missing | ON clearer |
| Service-owned storage/id sequence absent | Present | Not applicable; no Service | ON clearer |
| Domain independence | Domain package has behavior and no Spring imports | Campaign record has behavior and no Spring imports | Neutral/partial |
| Repository interface boundary | Domain `CouponCampaignRepository` interface | Concrete `CouponCampaignRepository` class | ON clearer |
| Repository implementation boundary | `infrastructure/InMemoryCouponCampaignRepository` owns storage/id sequence | Concrete repository owns storage/id sequence in flat campaign package | ON clearer |
| Request DTO boundary | `presentation/dto/request/CreateCouponCampaignRequest` | `CreateCouponCampaignRequest` in flat campaign package | ON clearer by boundary placement |
| Response DTO boundary | `presentation/dto/response/CouponCampaignResponse` | Controller returns domain `CouponCampaign` | ON clearer |
| Application command/result boundary | Missing | Missing | Neutral missing |
| Package flow shape | `application`, `domain`, `infrastructure`, `presentation`, `global` | flat `campaign` package | ON-positive |
| Final Gradle verification | Passed | Passed | Neutral |
| HTTP smoke | Passed | Passed | Neutral |

## Finding

Injection ON is product-code-flow positive for this pair.

The strongest ON-positive signals are:

- Controller delegates to `CouponCampaignService` instead of using persistence directly.
- Application Service exists as the use-case orchestration boundary.
- Repository contract lives in domain and implementation lives in infrastructure.
- Request/response DTOs are separated under presentation DTO packages.
- The generated package flow is easy to read as `presentation -> application -> domain -> infrastructure`.

The neutral signals matter:

- both outputs stayed Gradle-only,
- both avoided Maven,
- both had one Spring Boot Application class,
- both passed final Gradle verification,
- both passed basic HTTP smoke.

## Limitations

- ON uses an application service but does not introduce command/result DTOs.
- OFF still implements a small working Spring app; the differential is code flow, not product correctness.
- The first ON attempt hit an OpenCode database lock due to parallel execution and had to be rerun.
- This evidence window is still small and does not certify broad model quality.

## Stopping Rule Impact

This pair counts as `ON-positive`.

Current fixed-window state after this review:

- comparable pairs: 3/3
- ON-positive: 3
- neutral/mixed: 0
- OFF-positive: 0
- decision: `continue-java-mvp`

The fixed stopping rule is now satisfied: Injection ON was product-code-flow positive in at least 2 of 3 comparable Gradle Java/Spring A/B pairs.

## Next Loop

Move to Java backend MVP productization/demo packaging.

Recommended next scope:

- keep frontend/infra/shared-skill expansion frozen by default,
- package the Java backend Clean Code MVP around Gradle-only routing, rule diagnostics, scope checks, and the product-code-flow evidence window,
- avoid adding new observers unless packaging reveals a concrete productization gap.
