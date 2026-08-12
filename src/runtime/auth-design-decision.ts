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
  readonly approved: boolean
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
  return createDecision(new Map<AuthDesignDecisionSlot, string>(), false)
}

function createDecision(
  answers: ReadonlyMap<AuthDesignDecisionSlot, string>,
  approved: boolean,
): AuthDesignDecisionSummary {
  const answeredSlots = AUTH_DESIGN_DECISION_SLOTS.filter((slot) => answers.has(slot))
  const missingSlots = AUTH_DESIGN_DECISION_SLOTS.filter((slot) => !answers.has(slot))
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
    allowImplementation: approved,
    allowWorkflowProgression: approved,
  }
}

function parseExplicitSlotValues(message: string): ReadonlyMap<AuthDesignDecisionSlot, string> {
  const values = new Map<AuthDesignDecisionSlot, string>()
  for (const slot of AUTH_DESIGN_DECISION_SLOTS) {
    const match = SLOT_VALUE_PATTERNS[slot].exec(message)
    const value = match?.[1]?.trim()
    if (value !== undefined && value.length > 0) {
      values.set(slot, value.slice(0, 600))
    }
  }
  return values
}

function mergeAnswers(
  current: ReadonlyMap<AuthDesignDecisionSlot, string>,
  message: string,
): ReadonlyMap<AuthDesignDecisionSlot, string> {
  const explicit = parseExplicitSlotValues(message)
  if (explicit.size > 0) {
    return new Map([...current, ...explicit])
  }

  const nextSlot = AUTH_DESIGN_DECISION_SLOTS.find((slot) => !current.has(slot))
  if (nextSlot === undefined) {
    return current
  }
  return new Map(current).set(nextSlot, message.slice(0, 600))
}

function renderDesignRequired(decision: AuthDesignDecisionSummary, nextSlot: AuthDesignDecisionSlot): string {
  return [
    "[Persona Harness Auth Design Hold]",
    `State: ${decision.state}`,
    `Next decision slot: ${SLOT_PROMPTS[nextSlot]}`,
    "Resolve the named architecture decisions one at a time before implementation or workflow progression.",
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
      const answers = parseExplicitSlotValues(normalized)
      const started: AuthDesignSession = { answers, approved: false }
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
      const decision = createDecision(current.answers, false)
      if (decision.missingSlots.length > 0) {
        return this.renderActive(current)
      }
      const approved: AuthDesignSession = { answers: current.answers, approved: true }
      this.sessions.set(sessionId, approved)
      const approvedDecision = createDecision(approved.answers, true)
      return {
        kind: "approved",
        decision: approvedDecision,
        block: renderApproved(approvedDecision),
      }
    }

    const next: AuthDesignSession = {
      answers: mergeAnswers(current.answers, normalized),
      approved: false,
    }
    this.sessions.set(sessionId, next)
    return this.renderActive(next)
  }

  private renderActive(session: AuthDesignSession): AuthDesignDecisionRoute {
    const decision = createDecision(session.answers, session.approved)
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
