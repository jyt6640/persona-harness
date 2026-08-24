export const AUTH_DESIGN_DECISION_SLOTS = [
  "provider",
  "domain",
  "callback",
  "state",
  "layer",
  "type-exception",
  "global-scope",
] as const

export type AuthDesignDecisionSlot = (typeof AUTH_DESIGN_DECISION_SLOTS)[number]
export type AuthDesignDecisionState = "design-required" | "approval-required" | "approved"

export type AuthDesignDecisionSummary = {
  readonly state: AuthDesignDecisionState
  readonly status: AuthDesignDecisionState
  readonly approval: "not-accepted" | "accepted"
  readonly answeredSlots: readonly AuthDesignDecisionSlot[]
  readonly missingSlots: readonly AuthDesignDecisionSlot[]
  readonly conflictedSlots: readonly AuthDesignDecisionSlot[]
  readonly allowImplementation: boolean
  readonly allowWorkflowProgression: boolean
}

export type AuthDesignDecisionRoute =
  | {
      readonly kind: "design-required"
      readonly decision: AuthDesignDecisionSummary
      readonly nextSlot: AuthDesignDecisionSlot
      readonly block: string
    }
  | {
      readonly kind: "clarification-required"
      readonly decision: AuthDesignDecisionSummary
      readonly nextSlot: AuthDesignDecisionSlot
      readonly block: string
    }
  | {
      readonly kind: "approval-required"
      readonly decision: AuthDesignDecisionSummary
      readonly block: string
    }
  | {
      readonly kind: "approved"
      readonly decision: AuthDesignDecisionSummary
      readonly block: string
    }
  | {
      readonly kind: "stopped"
      readonly block: string
    }
  | { readonly kind: "released" }

type AuthDesignSession = {
  readonly answers: ReadonlyMap<AuthDesignDecisionSlot, string>
  readonly conflictedSlots: ReadonlySet<AuthDesignDecisionSlot>
  readonly approved: boolean
}

type ParsedSlotValues = {
  readonly values: ReadonlyMap<AuthDesignDecisionSlot, string>
  readonly conflictedSlots: ReadonlySet<AuthDesignDecisionSlot>
}

const AUTH_SECURITY_PATTERN = /(?:auth(?:entication|orization)?|oauth|oidc|sso|jwt|security|secure|permission|login|인증|인가|보안|권한|로그인)/iu
const EXACT_APPROVAL_PATTERN = /^(?:approve|승인|진행하자|시작하자|proceed|go\s+ahead)$/iu
const STOP_PATTERN = /^(?:stop|pause|그만|중단)$/iu
const NATURAL_STOP_PATTERN = /(?:(?:do\s+not|don't|stop|skip)\s+(?:the\s+)?(?:interview|questions?|design\s+hold)|(?:interview|questions?|design\s+hold)\s+(?:is\s+)?(?:not\s+(?:needed|now)|stop|skip)|(?:인터뷰|질문|설계\s*홀드?)\s*(?:를|을|은|는)?\s*(?:하지\s*마(?:요|세요)?|말아(?:줘|주세요)?|그만(?:해|하자|해줘|해주세요)?|중단(?:해|하자|해줘|해주세요)?|필요\s*없(?:어|어요|습니다)?))/iu
const NON_AUTH_TASK_SWITCH_PATTERN = /(?:feedback[-\s]?dogfooding|dogfooding|workflow\s+finish(?:\s+implement)?|source-read-runtime-unavailable|history\s+archive|(?:피드백|이슈)\s*(?:로|을|를|에)?\s*(?:기록|남기|등록|정리)|(?:워크플로|workflow)\s*(?:finish|진단|오류)|(?:구현|리뷰)\s*보고서)/iu
const DEFER_PATTERN = /^(?:defer|skip|later|보류|넘겨)$/iu
const CLARIFICATION_PATTERN = /(?:무슨\s*말|뭔\s*말|이해(?:가)?\s*안|모르겠|설명(?:해|해줘|해주세요|좀)|쉽게\s*(?:말|설명)|what\s+(?:does|do)\b.*\bmean|(?:i\s+)?(?:do\s+not|don't)\s+understand|(?:can|could)\s+you\s+explain|please\s+explain)/iu

const SLOT_VALUE_PATTERNS: Readonly<Record<AuthDesignDecisionSlot, RegExp>> = {
  provider: /(?:^|[\s,;])provider\s*[:=]\s*([^\n,;]+)/iu,
  domain: /(?:^|[\s,;])domain\s*[:=]\s*([^\n,;]+)/iu,
  callback: /(?:^|[\s,;])callback\s*[:=]\s*([^\n,;]+)/iu,
  state: /(?:^|[\s,;])state\s*[:=]\s*([^\n,;]+)/iu,
  layer: /(?:^|[\s,;])layer\s*[:=]\s*([^\n,;]+)/iu,
  "type-exception": /(?:^|[\s,;])(?:type[- ]?exception|exception)\s*[:=]\s*([^\n,;]+)/iu,
  "global-scope": /(?:^|[\s,;])(?:global[- ]?scope|scope)\s*[:=]\s*([^\n,;]+)/iu,
}

const SLOT_PROMPTS: Readonly<Record<AuthDesignDecisionSlot, string>> = {
  provider: "provider",
  domain: "domain",
  callback: "callback",
  state: "state",
  layer: "layer",
  "type-exception": "type-exception",
  "global-scope": "global-scope",
}

const SLOT_EXPLANATIONS: Readonly<Record<AuthDesignDecisionSlot, string>> = {
  provider: "Which external identity service the product will trust for login, such as GitHub only or GitHub plus another provider.",
  domain: "Which domain concept owns the link between an internal user and an external provider account.",
  callback: "The callback is the URL GitHub sends the browser to after login. Decide the path and which boundary receives the code and state before handing work to the application layer.",
  state: "OAuth state is a short-lived value that connects the login start to the callback and helps reject a mismatched return. Decide which component creates it, where it is kept, and which component verifies it.",
  layer: "Which layer owns each responsibility: the HTTP entry point, the application use case, and the domain rules.",
  "type-exception": "How provider failures and unexpected responses become domain or application errors without leaking provider details into unrelated layers.",
  "global-scope": "Which cross-cutting configuration or response conventions belong in a shared global place, instead of inside one OAuth feature.",
}

export function isAuthSecurityRequest(message: string): boolean {
  return AUTH_SECURITY_PATTERN.test(message.trim())
}

function isEditDistanceAtMostOne(value: string, expected: string): boolean {
  if (value === expected) {
    return true
  }
  if (Math.abs(value.length - expected.length) > 1) {
    return false
  }

  let valueIndex = 0
  let expectedIndex = 0
  let edits = 0
  while (valueIndex < value.length && expectedIndex < expected.length) {
    if (value[valueIndex] === expected[expectedIndex]) {
      valueIndex += 1
      expectedIndex += 1
      continue
    }
    edits += 1
    if (edits > 1) {
      return false
    }
    if (value.length > expected.length) {
      valueIndex += 1
      continue
    }
    if (value.length < expected.length) {
      expectedIndex += 1
      continue
    }
    valueIndex += 1
    expectedIndex += 1
  }

  return edits + (value.length - valueIndex) + (expected.length - expectedIndex) <= 1
}

function isApprovalCommand(message: string): boolean {
  if (EXACT_APPROVAL_PATTERN.test(message)) {
    return true
  }
  return /^[a-z]+$/iu.test(message) && isEditDistanceAtMostOne(message.toLowerCase(), "approve")
}

function isStopCommand(message: string): boolean {
  return STOP_PATTERN.test(message) || NATURAL_STOP_PATTERN.test(message)
}

function isNonAuthTaskSwitch(message: string): boolean {
  return !isAuthSecurityRequest(message) && NON_AUTH_TASK_SWITCH_PATTERN.test(message)
}

function stoppedRoute(): AuthDesignDecisionRoute {
  return {
    kind: "stopped",
    block: "[Persona Harness Auth Design Hold]\nState: stopped\nNo project, workflow, issue, agent, or file state was changed.\nDo not ask another auth-design question. Address a separate latest user request through its normal route.",
  }
}

export function initialAuthDesignDecision(): AuthDesignDecisionSummary {
  return createDecision(new Map<AuthDesignDecisionSlot, string>(), new Set<AuthDesignDecisionSlot>(), false)
}

function createDecision(
  answers: ReadonlyMap<AuthDesignDecisionSlot, string>,
  conflicts: ReadonlySet<AuthDesignDecisionSlot>,
  approved: boolean,
): AuthDesignDecisionSummary {
  const answeredSlots = AUTH_DESIGN_DECISION_SLOTS.filter((slot) => answers.has(slot) && !conflicts.has(slot))
  const missingSlots = AUTH_DESIGN_DECISION_SLOTS.filter((slot) => !answers.has(slot) || conflicts.has(slot))
  const conflictedSlots = AUTH_DESIGN_DECISION_SLOTS.filter((slot) => conflicts.has(slot))
  const state: AuthDesignDecisionState = approved
    ? "approved"
    : missingSlots.length > 0
      ? "design-required"
      : "approval-required"
  return {
    state,
    status: state,
    approval: approved ? "accepted" : "not-accepted",
    answeredSlots,
    missingSlots,
    conflictedSlots,
    allowImplementation: approved,
    allowWorkflowProgression: approved,
  }
}

function parseExplicitSlotValues(message: string): ParsedSlotValues {
  const values = new Map<AuthDesignDecisionSlot, string>()
  const conflictedSlots = new Set<AuthDesignDecisionSlot>()
  for (const slot of AUTH_DESIGN_DECISION_SLOTS) {
    const matches = message.matchAll(new RegExp(SLOT_VALUE_PATTERNS[slot].source, "giu"))
    const slotValues = new Set<string>()
    for (const match of matches) {
      const value = match[1]?.trim()
      if (value !== undefined && value.length > 0) {
        slotValues.add(value.slice(0, 600))
      }
    }
    if (slotValues.size > 1) {
      conflictedSlots.add(slot)
    }
    const firstValue = slotValues.values().next().value
    if (firstValue !== undefined) {
      values.set(slot, firstValue)
    }
  }
  return { values, conflictedSlots }
}

function mergeAnswers(
  current: ReadonlyMap<AuthDesignDecisionSlot, string>,
  currentConflicts: ReadonlySet<AuthDesignDecisionSlot>,
  message: string,
): { readonly answers: ReadonlyMap<AuthDesignDecisionSlot, string>; readonly conflictedSlots: ReadonlySet<AuthDesignDecisionSlot> } {
  const explicit = parseExplicitSlotValues(message)
  const answers = new Map(current)
  const conflictedSlots = new Set(currentConflicts)
  for (const slot of explicit.conflictedSlots) {
    conflictedSlots.add(slot)
  }
  for (const [slot, value] of explicit.values) {
    if (conflictedSlots.has(slot)) {
      continue
    }
    const previous = answers.get(slot)
    if (previous === undefined) {
      answers.set(slot, value)
      continue
    }
    if (previous !== value) {
      conflictedSlots.add(slot)
    }
  }

  const nextSlot = AUTH_DESIGN_DECISION_SLOTS.find((slot) => !answers.has(slot) || conflictedSlots.has(slot))
  if (nextSlot === undefined) {
    return { answers, conflictedSlots }
  }
  if (explicit.values.size > 0) {
    return { answers, conflictedSlots }
  }
  if (conflictedSlots.has(nextSlot)) {
    return { answers, conflictedSlots }
  }
  answers.set(nextSlot, message.slice(0, 600))
  return { answers, conflictedSlots }
}

function parseResolution(message: string): { readonly slot: AuthDesignDecisionSlot; readonly value: string } | undefined {
  const match = /^resolve\s+([a-z-]+)\s*[:=]\s*(.+)$/iu.exec(message)
  const slotText = match?.[1]?.toLowerCase()
  const slot = AUTH_DESIGN_DECISION_SLOTS.find((candidate) => candidate === slotText)
  const value = match?.[2]?.trim()
  if (slot === undefined || value === undefined || value.length === 0) {
    return undefined
  }
  return { slot, value: value.slice(0, 600) }
}

function renderDesignRequired(decision: AuthDesignDecisionSummary, nextSlot: AuthDesignDecisionSlot): string {
  return [
    "[Persona Harness Auth Design Hold]",
    `State: ${decision.state}`,
    `Next decision slot: ${SLOT_PROMPTS[nextSlot]}`,
    "Resolve the named architecture decisions one at a time before implementation or workflow progression.",
    "Respond with exactly one question ending in `?` about the named decision slot.",
    "Do not provide a solution, implementation, plan, command, or file change.",
    "No provider, domain, callback, state, layer, type/exception, or global-scope convention is inferred.",
    "Reply with the decision, or use `defer`, `stop`, or `approve` only after every slot is explicit.",
    "No plan, ticket, workflow, branch, file, issue, or agent action has been created.",
  ].join("\n")
}

function renderClarificationRequired(decision: AuthDesignDecisionSummary, nextSlot: AuthDesignDecisionSlot): string {
  return [
    "[Persona Harness Auth Design Hold]",
    `State: ${decision.state}`,
    `Current decision slot: ${SLOT_PROMPTS[nextSlot]}`,
    "The user's latest message is a clarification request, not an architecture decision.",
    "First explain only the current question in plain language. Do not choose a design or imply that an example is the user's decision.",
    `Plain-language meaning: ${SLOT_EXPLANATIONS[nextSlot]}`,
    "Then ask whether the user wants a recommendation, wants to defer this slot, or wants to give their decision.",
    "Do not record an answer, advance to another slot, or ask the next slot.",
    "No plan, ticket, workflow, branch, file, issue, or agent action has been created.",
  ].join("\n")
}

function renderApprovalRequired(decision: AuthDesignDecisionSummary): string {
  return [
    "[Persona Harness Auth Design Hold]",
    `State: ${decision.state}`,
    "All required architecture slots are explicit; approval is still required before implementation or workflow progression.",
    "Reply `approve` to release the existing implementation handoff, or name a correction.",
    "No plan, ticket, workflow, branch, file, issue, or agent action has been created.",
  ].join("\n")
}

function renderApproved(decision: AuthDesignDecisionSummary): string {
  return [
    "[Persona Harness Auth Design Hold]",
    `State: ${decision.state}`,
    "Architecture decisions were explicitly approved in this conversation.",
    "The existing technical-intake -> plan -> optional ralplan -> TDD -> implementation -> review handoff is now available.",
  ].join("\n")
}

export class AuthDesignDecisionTracker {
  private readonly sessions = new Map<string, AuthDesignSession>()

  hasActiveSession(sessionId: string): boolean {
    return this.sessions.has(sessionId)
  }

  isApproved(sessionId: string): boolean {
    return this.sessions.get(sessionId)?.approved ?? false
  }

  route(sessionId: string, message: string): AuthDesignDecisionRoute | undefined {
    const normalized = message.trim()
    if (normalized.length === 0) {
      return undefined
    }

    const current = this.sessions.get(sessionId)
    if (current?.approved === true) {
      if (isStopCommand(normalized)) {
        this.sessions.delete(sessionId)
        return stoppedRoute()
      }
      return isAuthSecurityRequest(normalized) ? { kind: "released" } : undefined
    }

    if (current === undefined) {
      if (!isAuthSecurityRequest(normalized)) {
        return undefined
      }
      const parsed = parseExplicitSlotValues(normalized)
      const started: AuthDesignSession = {
        answers: parsed.values,
        conflictedSlots: parsed.conflictedSlots,
        approved: false,
      }
      this.sessions.set(sessionId, started)
      return this.renderActive(started)
    }

    if (isStopCommand(normalized) || isNonAuthTaskSwitch(normalized)) {
      this.sessions.delete(sessionId)
      return stoppedRoute()
    }

    if (DEFER_PATTERN.test(normalized)) {
      return this.renderActive(current)
    }

    if (CLARIFICATION_PATTERN.test(normalized)) {
      const decision = createDecision(current.answers, current.conflictedSlots, false)
      const nextSlot = decision.missingSlots[0]
      if (nextSlot !== undefined) {
        return {
          kind: "clarification-required",
          decision,
          nextSlot,
          block: renderClarificationRequired(decision, nextSlot),
        }
      }
    }

    if (isApprovalCommand(normalized)) {
      const decision = createDecision(current.answers, current.conflictedSlots, false)
      if (decision.missingSlots.length > 0) {
        return this.renderActive(current)
      }
      const approved: AuthDesignSession = {
        answers: current.answers,
        conflictedSlots: new Set<AuthDesignDecisionSlot>(),
        approved: true,
      }
      this.sessions.set(sessionId, approved)
      const approvedDecision = createDecision(approved.answers, approved.conflictedSlots, true)
      return {
        kind: "approved",
        decision: approvedDecision,
        block: renderApproved(approvedDecision),
      }
    }

    const resolution = parseResolution(normalized)
    const nextState = resolution === undefined
      ? mergeAnswers(current.answers, current.conflictedSlots, normalized)
      : {
          answers: new Map(current.answers).set(resolution.slot, resolution.value),
          conflictedSlots: new Set([...current.conflictedSlots].filter((slot) => slot !== resolution.slot)),
        }
    const next: AuthDesignSession = {
      answers: nextState.answers,
      conflictedSlots: nextState.conflictedSlots,
      approved: false,
    }
    this.sessions.set(sessionId, next)
    return this.renderActive(next)
  }

  private renderActive(session: AuthDesignSession): AuthDesignDecisionRoute {
    const decision = createDecision(session.answers, session.conflictedSlots, session.approved)
    const nextSlot = decision.missingSlots[0]
    if (nextSlot !== undefined) {
      return {
        kind: "design-required",
        decision,
        nextSlot,
        block: renderDesignRequired(decision, nextSlot),
      }
    }
    return {
      kind: "approval-required",
      decision,
      block: renderApprovalRequired(decision),
    }
  }
}

export function isAuthDesignDecisionRoute(
  value: AuthDesignDecisionRoute | undefined,
): value is Exclude<AuthDesignDecisionRoute, { readonly kind: "released" }> {
  return value !== undefined && value.kind !== "released"
}
