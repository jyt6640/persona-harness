import type { TopLevelIntent } from "./top-level-intent-router.js"

function secondaryLine(intent: TopLevelIntent): string {
  return intent.secondary.length > 0 ? intent.secondary.join(", ") : "none"
}

export function formatDebugWorkflowBlock(intent: TopLevelIntent): string {
  return [
    "[Persona Harness Debug Workflow]",
    "",
    `Detected intent: ${intent.primary}`,
    `Secondary intents: ${secondaryLine(intent)}`,
    `Reason: ${intent.reason}`,
    "",
    "의도 감지: 디버그 요청으로 판단함.",
    "근거: 실패/에러/동작 이상을 해결해달라는 신호가 있음.",
    "다음 행동: 구현부터 하지 말고 재현, 가설, evidence 확인을 먼저 수행한다.",
    "",
    "Required flow:",
    "- 실패를 먼저 재현한다. 실패 명령, 에러 핵심, 관찰한 증상을 기록한다.",
    "- 최소 3개 가설을 세운다. 각 가설은 서로 다른 원인 축을 가져야 한다.",
    "- 각 가설마다 확인/반박 evidence를 남긴다. 추측만으로 수정하지 않는다.",
    "- 확인된 원인만 수정한다. 원인과 무관한 리팩터링이나 기능 추가는 하지 않는다.",
    "- 수정 후 같은 실패 명령을 다시 실행한다.",
    "- 관련 테스트/빌드/스모크를 재실행하고 결과를 보고한다.",
    "",
    "Evidence checklist:",
    "- Reproduction command",
    "- Observed failure",
    "- Hypothesis 1 / evidence",
    "- Hypothesis 2 / evidence",
    "- Hypothesis 3 / evidence",
    "- Confirmed root cause",
    "- Verification command",
    "",
    "Non-goals:",
    "- generated app product quality 보증이 아니다.",
    "- AST/linter/enforcement gate가 아니다.",
    "- 원인 확인 없는 대규모 리팩터링을 하지 않는다.",
    "- README/requirements 구현 workflow가 아니다.",
  ].join("\n")
}
