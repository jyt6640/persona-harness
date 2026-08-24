import { detectRequirementsIntent, type RequirementsIntent } from "./requirements-intent-router.js"
import {
  activateAutomaticPersonaSkill,
  activateExplicitPersonaSkill,
  isClearDirectImplementationRequest,
  isProductDiscoverySuppressed,
  parseExplicitPersonaSkillCommand,
  primaryIntentForPersonaSkill,
  type PersonaProductDiscoveryMode,
  type PersonaSharedSkillActivation,
} from "./persona-shared-skill-activation.js"
import {
  initialAuthDesignDecision,
  isAuthSecurityRequest,
  type AuthDesignDecisionSummary,
} from "./auth-design-decision.js"
import { isDecisionGrillStart } from "./decision-grill.js"
import { isProductDeepInterviewStart } from "./product-deep-interview.js"

export type TopLevelIntentKind = "product-interview" | "decision-grill" | "requirements" | "debug" | "review" | "refactor" | "git" | "programming" | "design-required" | "unavailable"

export type TopLevelIntent = {
  readonly activation?: PersonaSharedSkillActivation
  readonly primary: TopLevelIntentKind
  readonly reasonCode?: "malformed-explicit-skill-command" | "unavailable-explicit-skill"
  readonly secondary: readonly TopLevelIntentKind[]
  readonly reason: string
  readonly requirementsIntent?: RequirementsIntent
  readonly authDesignDecision?: AuthDesignDecisionSummary
}

export type TopLevelIntentOptions = {
  readonly authDesignApproved?: boolean
  readonly productMode?: PersonaProductDiscoveryMode
}

const REQUIREMENT_CONTEXT_PATTERN = /(?:\bREADME(?:\.md)?\b|\brequirements(?:\.md)?\b|리드미|요구사항|backlog|task\s*card|step|단계)/iu
const DEBUG_PATTERN = /(왜\s*안|안\s*돼|안됨|에러|오류|실패|버그|고장|멈춤|깨졌|문제|원인|debug|bug|error|fail(?:ed|ing|s)?|failure|crash|\bhang(?:s|ing)?\b|broken|not\s+working|why)/iu
const REVIEW_PATTERN = /(리뷰|검토|분석|냉정하게|살펴봐|봐봐|review|audit|qa|verify|validate|check\s+(?:this|my|the))/iu
const REFACTOR_PATTERN = /(리팩터|리팩토|구조\s*개선|구조\s*정리|정리하고|cleanup|clean\s+up|refactor|restructure|simplif)/iu
const GIT_PATTERN = /(커밋|푸쉬|푸시|태그|릴리즈|\bgit\s+(?:log|show|blame|rebase|status)\b|\bcommit\b|\bpush\b|\btag\b|\brelease\b|\brebase\b|\bblame\b)/iu
const PROGRAMMING_PATTERN = /(구현|만들|작성|개발|완성|수정|고치|고쳐|해결|\b(?:build|implement(?:ing)?|create|make|edit|fix|repair|resolve)\b)/iu

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
  activation: PersonaSharedSkillActivation | undefined,
): TopLevelIntent {
  if (primary === "product-interview") {
    return {
      ...(activation === undefined ? {} : { activation }),
      primary,
      reason,
      secondary: [],
    }
  }
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
    ...(activation === undefined ? {} : { activation }),
    primary,
    secondary,
    reason,
    ...(requirementsIntent !== undefined ? { requirementsIntent } : {}),
  }
}

function unavailableIntent(reasonCode: TopLevelIntent["reasonCode"]): TopLevelIntent {
  return {
    primary: "unavailable",
    reason: "The explicit Persona skill command is unavailable and was not routed.",
    reasonCode,
    secondary: [],
  }
}

export function detectTopLevelIntent(message: string, options: TopLevelIntentOptions = {}): TopLevelIntent | undefined {
  const normalized = message.trim()
  if (normalized.length === 0) {
    return undefined
  }

  const productMode = options.productMode ?? "new-product"
  if (!options.authDesignApproved && isAuthSecurityRequest(normalized)) {
    return {
      primary: "design-required",
      reason: "Authentication or security architecture decisions are unresolved; implementation remains held.",
      secondary: [],
      authDesignDecision: initialAuthDesignDecision(),
    }
  }

  const explicitCommand = parseExplicitPersonaSkillCommand(normalized)
  if (explicitCommand.kind === "malformed") {
    return unavailableIntent("malformed-explicit-skill-command")
  }
  if (explicitCommand.kind === "unavailable") {
    return unavailableIntent("unavailable-explicit-skill")
  }
  if (explicitCommand.kind === "valid") {
    const primary = primaryIntentForPersonaSkill(explicitCommand.skillId)
    return {
      activation: activateExplicitPersonaSkill(
        explicitCommand.skillId,
        "The user explicitly selected this Persona skill command.",
        productMode,
      ),
      primary,
      reason: "The explicit Persona skill command takes precedence over automatic intent routing.",
      secondary: [],
    }
  }

  const requirementsIntent = detectRequirementsIntent(normalized)
  const hasDebugIntent = DEBUG_PATTERN.test(normalized)
  const hasReviewIntent = REVIEW_PATTERN.test(normalized)
  const hasRefactorIntent = REFACTOR_PATTERN.test(normalized)
  const hasGitIntent = GIT_PATTERN.test(normalized)
  const hasProgrammingIntent = PROGRAMMING_PATTERN.test(normalized)
  const hasDecisionGrillIntent = isDecisionGrillStart(normalized)
  const hasWorkIntent = requirementsIntent !== undefined
    || hasDebugIntent
    || hasReviewIntent
    || hasRefactorIntent
    || hasProgrammingIntent
    || hasDecisionGrillIntent

  if (hasGitIntent && !hasWorkIntent) {
    return buildIntent("git", normalized, "Git-only operation requested.", requirementsIntent, activateAutomaticPersonaSkill("git", "Git-only operation requested."))
  }
  if (hasDebugIntent) {
    return buildIntent("debug", normalized, "Failure or broken-behavior signal detected.", requirementsIntent, activateAutomaticPersonaSkill("debug", "Failure or broken-behavior signal detected."))
  }
  if (hasReviewIntent && !hasProgrammingIntent) {
    return buildIntent("review", normalized, "Review or analysis request detected without a fix request.", requirementsIntent, activateAutomaticPersonaSkill("review", "Review or analysis request detected without a fix request."))
  }
  if (hasRefactorIntent) {
    return buildIntent("refactor", normalized, "Behavior-preserving structure improvement requested.", requirementsIntent, activateAutomaticPersonaSkill("refactor", "Behavior-preserving structure improvement requested."))
  }

  const productInterviewStart = isProductDeepInterviewStart(normalized)
  if (productInterviewStart && isProductDiscoverySuppressed(normalized)) {
    return undefined
  }
  if (productInterviewStart && !isClearDirectImplementationRequest(normalized)) {
    const reason = "Product facts require a one-question interview before technical intake."
    return buildIntent("product-interview", normalized, reason, undefined, activateAutomaticPersonaSkill("product-interview", reason, productMode))
  }
  if (hasDecisionGrillIntent && !hasProgrammingIntent && !hasRefactorIntent) {
    const reason = "Concrete decision pressure-test request detected without a direct code-change request."
    return buildIntent("decision-grill", normalized, reason, requirementsIntent, activateAutomaticPersonaSkill("decision-grill", reason))
  }
  if (requirementsIntent !== undefined) {
    return buildIntent("requirements", normalized, requirementsIntent.reason, requirementsIntent, activateAutomaticPersonaSkill("requirements", requirementsIntent.reason))
  }
  if (hasProgrammingIntent) {
    return buildIntent("programming", normalized, "Direct code creation or edit request detected.", requirementsIntent, activateAutomaticPersonaSkill("programming", "Direct code creation or edit request detected."))
  }

  return undefined
}
