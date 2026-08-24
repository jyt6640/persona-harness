const DECISION_SUBJECT_PATTERN = /(?:\b(?:decision|design|plan|strategy|approach|architecture|migration|rollout|proposal|option)\b|설계|디자인|계획|전략|방안|결정|선택|아키텍처|마이그레이션|출시)/iu
const PRESSURE_TEST_PATTERN = /(?:\b(?:grill(?:\s+(?:me|this))?|pressure[-\s]?test|stress[-\s]?test|adversarial|challenge|assumptions?|alternatives?|risks?|trade[-\s]?offs?|failure\s+modes?)\b|가정|전제|트레이드오프|대안|리스크|위험|실패\s*모드|반례|혹독하게|따져봐|파헤쳐|검증해\s*줘)/iu

export function isDecisionGrillStart(message: string): boolean {
  const normalized = message.trim()
  return normalized.length > 0 && DECISION_SUBJECT_PATTERN.test(normalized) && PRESSURE_TEST_PATTERN.test(normalized)
}
