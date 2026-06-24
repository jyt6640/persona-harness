import { describe, expect, it } from "vitest"

import { detectTopLevelIntent } from "../src/runtime/top-level-intent-router.js"

describe("detectTopLevelIntent", () => {
  it("routes README implementation requests to requirements primary and programming secondary", () => {
    const intent = detectTopLevelIntent("README 보고 구현해줘")

    expect(intent?.primary).toBe("requirements")
    expect(intent?.secondary).toEqual(["programming"])
    expect(intent?.requirementsIntent?.kind).toBe("requirement-implementation")
    expect(intent?.requirementsIntent?.sourceFile).toBe("README.md")
  })

  it("routes vague product ideas to requirements drafting without programming", () => {
    const intent = detectTopLevelIntent("TODO 웹 서비스 만들래")

    expect(intent?.primary).toBe("requirements")
    expect(intent?.secondary).toEqual([])
    expect(intent?.requirementsIntent?.kind).toBe("requirement-drafting")
  })

  it("routes runtime failures to debug before programming", () => {
    const intent = detectTopLevelIntent("왜 gradle build가 실패하지? 고쳐줘")

    expect(intent?.primary).toBe("debug")
    expect(intent?.secondary).toEqual(["programming"])
    expect(intent?.requirementsIntent).toBeUndefined()
  })

  it("keeps debug primary when a README context is mixed with a bug report", () => {
    const intent = detectTopLevelIntent("README 보고 구현했는데 테스트가 실패해. 고쳐줘")

    expect(intent?.primary).toBe("debug")
    expect(intent?.secondary).toEqual(["requirements", "programming"])
  })

  it("routes review requests to review without direct implementation", () => {
    const intent = detectTopLevelIntent("이 코드 냉정하게 리뷰해줘")

    expect(intent?.primary).toBe("review")
    expect(intent?.secondary).toEqual([])
  })

  it("routes refactor requests to refactor with programming as secondary", () => {
    const intent = detectTopLevelIntent("구조 좀 정리하고 리팩터링해줘")

    expect(intent?.primary).toBe("refactor")
    expect(intent?.secondary).toEqual(["programming"])
  })

  it("routes git-only requests to git primary", () => {
    const intent = detectTopLevelIntent("커밋하고 푸쉬해")

    expect(intent?.primary).toBe("git")
    expect(intent?.secondary).toEqual([])
  })

  it("keeps work intent primary and git secondary for mixed work plus commit requests", () => {
    const intent = detectTopLevelIntent("버그 고치고 커밋해")

    expect(intent?.primary).toBe("debug")
    expect(intent?.secondary).toEqual(["programming", "git"])
  })

  it("routes direct code creation to programming when no stronger intent applies", () => {
    const intent = detectTopLevelIntent("CouponService 만들어줘")

    expect(intent?.primary).toBe("programming")
    expect(intent?.secondary).toEqual([])
  })

  it("returns undefined for empty messages", () => {
    expect(detectTopLevelIntent("  ")).toBeUndefined()
  })
})
