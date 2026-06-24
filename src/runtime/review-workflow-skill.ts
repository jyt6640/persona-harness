import type { TopLevelIntent } from "./top-level-intent-router.js"

function secondaryLine(intent: TopLevelIntent): string {
  return intent.secondary.length > 0 ? intent.secondary.join(", ") : "none"
}

export function formatReviewWorkflowBlock(intent: TopLevelIntent): string {
  return [
    "[Persona Harness Review Workflow]",
    "",
    `Detected intent: ${intent.primary}`,
    `Secondary intents: ${secondaryLine(intent)}`,
    `Reason: ${intent.reason}`,
    "",
    "의도 감지: 리뷰 요청으로 판단함.",
    "근거: 사용자가 구현보다 검토/분석/QA를 요구함.",
    "다음 행동: 수정하지 말고 findings를 먼저 정리한다.",
    "",
    "Required flow:",
    "- 코드를 수정하지 않는다.",
    "- 현재 목표, 변경 범위, 관련 파일을 먼저 확인한다.",
    "- Findings를 먼저 쓴다. 심각도 높은 순서로 정리한다.",
    "- 각 finding에는 파일/라인/증거/영향을 포함한다.",
    "- 문제가 없으면 `No findings`라고 명확히 말하고 남은 리스크를 적는다.",
    "- 수정은 사용자가 명시적으로 요청할 때만 별도 구현/debug/refactor rail로 진행한다.",
    "",
    "Evidence checklist:",
    "- Reviewed files",
    "- Commands or evidence inspected",
    "- Findings with file/line/evidence/impact",
    "- Residual risks",
    "",
    "Non-goals:",
    "- 자동 수정 rail이 아니다.",
    "- generated app product quality 보증이 아니다.",
    "- AST/linter/enforcement gate가 아니다.",
    "- 구현/리팩터링을 시작하지 않는다.",
  ].join("\n")
}
