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
const APPROVAL_PATTERN = /^(?:approve|승인|진행하자|시작하자|proceed|go\s+ahead)$/iu
const STOP_PATTERN = /^(?:stop|pause|그만|중단)$/iu
const DEFER_PATTERN = /^(?:defer|skip|later|보류|넘겨)$/iu

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

export function isAuthSecurityRequest(message: string): boolean {
  return AUTH_SECURITY_PATTERN.test(message.trim())
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
      this.sessions.delete(sessionId)
      return { kind: "released" }
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

    if (STOP_PATTERN.test(normalized)) {
      this.sessions.delete(sessionId)
      return {
        kind: "stopped",
        block: "[Persona Harness Auth Design Hold]\nState: stopped\nNo project, workflow, issue, agent, or file state was changed.",
      }
    }

    if (DEFER_PATTERN.test(normalized)) {
      return this.renderActive(current)
    }

    if (APPROVAL_PATTERN.test(normalized)) {
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
