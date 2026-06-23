export type RequirementsIntentKind =
  | "requirement-drafting"
  | "requirement-approval"
  | "requirement-implementation"
  | "requirement-change"
  | "requirement-continuation"

export type RequirementsIntent = {
  readonly kind: RequirementsIntentKind
  readonly source: "file" | "prompt" | "workflow"
  readonly sourceFile?: string
  readonly reason: string
}

const FILE_REQUIREMENT_PATTERN = /(?:\bREADME(?:\.md)?\b|\brequirements(?:\.md)?\b|리드미|요구사항\.md)/iu
const IMPLEMENTATION_VERBS = /(구현|만들|작성|개발|완성|build|implement|create|make)/iu
const CHANGE_VERBS = /(추가|변경|수정|확장|add|change|update|extend)/iu
const REQUIREMENT_HINTS = /(요구사항|기능|서비스|api|프로젝트|과제|step|단계)/iu
const CONTINUE_PATTERN = /(step\s*\d+|단계\s*\d+|이어서|계속|다음|remaining|continue|resume)/iu
const APPROVAL_PATTERN = /^(진행하자|시작하자|가자|승인|approve|proceed|go ahead)$/iu
const DRAFTING_PATTERN = /(만들래|만들고\s*싶|하고\s*싶|기획해|구상해|아이디어|웹\s*서비스\s*만들래|서비스\s*만들래)/iu
const NON_REQUIREMENT_PATTERN = /(설명|분석|원인|리뷰|검토|왜|어떻게 동작|debug|bug|review|explain|analy[sz]e)/iu

function sourceFileFromMessage(message: string): string | undefined {
  const match = FILE_REQUIREMENT_PATTERN.exec(message)
  const value = match?.[0]
  if (value === undefined) {
    return undefined
  }
  const normalized = value.toLowerCase()
  return normalized.includes("readme") || normalized.includes("리드미") ? "README.md" : "requirements.md"
}

export function detectRequirementsIntent(message: string): RequirementsIntent | undefined {
  const normalized = message.trim()
  if (normalized.length === 0) {
    return undefined
  }

  const sourceFile = sourceFileFromMessage(normalized)
  const hasImplementationVerb = IMPLEMENTATION_VERBS.test(normalized)
  const hasChangeVerb = CHANGE_VERBS.test(normalized)
  const hasRequirementHint = REQUIREMENT_HINTS.test(normalized)
  const hasContinueHint = CONTINUE_PATTERN.test(normalized)
  const hasApprovalHint = APPROVAL_PATTERN.test(normalized)
  const hasDraftingHint = DRAFTING_PATTERN.test(normalized)

  if (hasApprovalHint) {
    return {
      kind: "requirement-approval",
      source: "workflow",
      reason: "User approved the drafted requirements and asked to proceed.",
    }
  }

  if (hasContinueHint && !NON_REQUIREMENT_PATTERN.test(normalized)) {
    return {
      kind: "requirement-continuation",
      source: "workflow",
      reason: "Continuation-oriented requirement workflow request detected.",
    }
  }

  if (sourceFile !== undefined && (hasImplementationVerb || hasChangeVerb || hasRequirementHint)) {
    return {
      kind: hasChangeVerb && !hasImplementationVerb ? "requirement-change" : "requirement-implementation",
      source: "file",
      sourceFile,
      reason: `${sourceFile} requirement source mentioned with implementation/change intent.`,
    }
  }

  if (NON_REQUIREMENT_PATTERN.test(normalized)) {
    return undefined
  }

  if (hasDraftingHint && !sourceFile && !hasChangeVerb) {
    return {
      kind: "requirement-drafting",
      source: "prompt",
      reason: "Vague product idea detected; draft requirements before implementation.",
    }
  }

  if ((hasImplementationVerb || hasChangeVerb) && hasRequirementHint) {
    return {
      kind: hasChangeVerb && !hasImplementationVerb ? "requirement-change" : "requirement-implementation",
      source: "prompt",
      reason: "Prompt contains requirement-like product implementation/change intent.",
    }
  }

  return undefined
}
