import { detectRequirementsIntent, type RequirementsIntent } from "./requirements-intent-router.js"

export type TopLevelIntentKind = "requirements" | "debug" | "review" | "refactor" | "git" | "programming"

export type TopLevelIntent = {
  readonly primary: TopLevelIntentKind
  readonly secondary: readonly TopLevelIntentKind[]
  readonly reason: string
  readonly requirementsIntent?: RequirementsIntent
}

const REQUIREMENT_CONTEXT_PATTERN = /(?:\bREADME(?:\.md)?\b|\brequirements(?:\.md)?\b|리드미|요구사항|backlog|task\s*card|step|단계)/iu
const DEBUG_PATTERN = /(왜\s*안|안\s*돼|안됨|에러|오류|실패|버그|고장|멈춤|깨졌|문제|원인|debug|bug|error|fail(?:ed|ing|s)?|failure|crash|hang|broken|not\s+working|why)/iu
const REVIEW_PATTERN = /(리뷰|검토|분석|냉정하게|살펴봐|봐봐|review|audit|qa|verify|validate|check\s+(?:this|my|the))/iu
const REFACTOR_PATTERN = /(리팩터|리팩토|구조\s*개선|구조\s*정리|정리하고|cleanup|clean\s+up|refactor|restructure|simplif)/iu
const GIT_PATTERN = /(커밋|푸쉬|푸시|태그|릴리즈|\bgit\s+(?:log|show|blame|rebase|status)\b|\bcommit\b|\bpush\b|\btag\b|\brelease\b|\brebase\b|\bblame\b)/iu
const PROGRAMMING_PATTERN = /(구현|만들|작성|개발|완성|수정|고치|고쳐|해결|build|implement|create|make|edit|fix|repair|resolve)/iu

function includesIntent(intents: readonly TopLevelIntentKind[], intent: TopLevelIntentKind): boolean {
  return intents.includes(intent)
}

function appendSecondary(
  intents: readonly TopLevelIntentKind[],
  primary: TopLevelIntentKind,
  candidate: TopLevelIntentKind,
): readonly TopLevelIntentKind[] {
  if (candidate === primary || includesIntent(intents, candidate)) {
    return intents
  }
  return [...intents, candidate]
}

function buildIntent(
  primary: TopLevelIntentKind,
  message: string,
  reason: string,
  requirementsIntent: RequirementsIntent | undefined,
): TopLevelIntent {
  const hasRequirementsContext = requirementsIntent !== undefined || REQUIREMENT_CONTEXT_PATTERN.test(message)
  const hasProgrammingIntent =
    requirementsIntent?.kind === "requirement-drafting" ? false : PROGRAMMING_PATTERN.test(message)
  const hasGitIntent = GIT_PATTERN.test(message)
  let secondary: readonly TopLevelIntentKind[] = []

  if (hasRequirementsContext) {
    secondary = appendSecondary(secondary, primary, "requirements")
  }
  if (hasProgrammingIntent || primary === "refactor") {
    secondary = appendSecondary(secondary, primary, "programming")
  }
  if (hasGitIntent) {
    secondary = appendSecondary(secondary, primary, "git")
  }

  return {
    primary,
    secondary,
    reason,
    ...(requirementsIntent !== undefined ? { requirementsIntent } : {}),
  }
}

export function detectTopLevelIntent(message: string): TopLevelIntent | undefined {
  const normalized = message.trim()
  if (normalized.length === 0) {
    return undefined
  }

  const requirementsIntent = detectRequirementsIntent(normalized)
  const hasDebugIntent = DEBUG_PATTERN.test(normalized)
  const hasReviewIntent = REVIEW_PATTERN.test(normalized)
  const hasRefactorIntent = REFACTOR_PATTERN.test(normalized)
  const hasGitIntent = GIT_PATTERN.test(normalized)
  const hasProgrammingIntent = PROGRAMMING_PATTERN.test(normalized)
  const hasWorkIntent = requirementsIntent !== undefined || hasDebugIntent || hasReviewIntent || hasRefactorIntent || hasProgrammingIntent

  if (hasGitIntent && !hasWorkIntent) {
    return buildIntent("git", normalized, "Git-only operation requested.", requirementsIntent)
  }
  if (hasDebugIntent) {
    return buildIntent("debug", normalized, "Failure or broken-behavior signal detected.", requirementsIntent)
  }
  if (hasReviewIntent && !hasProgrammingIntent) {
    return buildIntent("review", normalized, "Review or analysis request detected without a fix request.", requirementsIntent)
  }
  if (requirementsIntent !== undefined) {
    return buildIntent("requirements", normalized, requirementsIntent.reason, requirementsIntent)
  }
  if (hasRefactorIntent) {
    return buildIntent("refactor", normalized, "Behavior-preserving structure improvement requested.", requirementsIntent)
  }
  if (hasProgrammingIntent) {
    return buildIntent("programming", normalized, "Direct code creation or edit request detected.", requirementsIntent)
  }

  return undefined
}
