import { describe, expect, it } from "vitest"

import { isDecisionGrillStart } from "../src/runtime/decision-grill.js"

describe("decision grill start predicate", () => {
  it.each([
    "grill me on this cache invalidation design",
    "Pressure-test this rollout plan before we commit to it.",
    "이 캐시 무효화 설계의 가정과 트레이드오프를 따져봐",
    "이 마이그레이션 전략의 대안과 실패 모드를 혹독하게 검증해줘",
  ])("recognizes a concrete decision pressure-test request: %s", (message) => {
    expect(isDecisionGrillStart(message)).toBe(true)
  })

  it.each([
    "이 코드를 냉정하게 리뷰해줘",
    "이 설계를 검토해줘",
    "테스트가 실패해. 고쳐줘",
    "CouponService 만들어줘",
    "동네 기술 교환 서비스를 만들고 싶어",
  ])("does not treat a different request as a decision grill: %s", (message) => {
    expect(isDecisionGrillStart(message)).toBe(false)
  })
})
