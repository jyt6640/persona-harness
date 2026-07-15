import type {
  ClosureBlocker,
  ClosureNextPayload,
  ClosureStatusPayload,
  ClosureStep,
  ClosureTicket,
  WorkflowClosureState,
} from "./workflow-closure.js"

const MAX_ARTIFACT_REFERENCES = 4
const MAX_BLOCKERS = 16
const MAX_CODE_LENGTH = 64
const MAX_PATH_LENGTH = 240
const MAX_TICKETS = 16
const SAFE_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u
const SAFE_PATH_PATTERN = /^[A-Za-z0-9._@+/-]+$/u
const SAFE_DIAGNOSTIC_CODES: ReadonlySet<string> = new Set([
  "convention-diagnostic",
  "configured-path-unavailable",
  "implementation-report-missing",
  "pending-ticket",
  "plan-not-accepted",
  "report-coverage-missing",
  "review-report-missing",
  "stack-alignment-mismatch",
  "tdd-diagnostic-unavailable",
  "trusted-authority-required",
  "verification-failed",
  "verification-unknown",
  "workflow-diagnostic-unavailable",
] as const)
const SAFE_FIXED_COMMANDS: ReadonlySet<string> = new Set([
  "npx ph plan",
  "npx ph plan --accept",
  "npx ph plan --report-filled implementation",
  "npx ph plan --report-filled review",
  "npx ph workflow check",
  "npx ph workflow continue",
  "npx ph workflow finish implement",
  "npx ph workflow test",
] as const)
const SAFE_ARCHIVE_COMMAND_PATTERN = /^npx ph workflow archive ([A-Za-z0-9][A-Za-z0-9._-]{0,63})$/u

export type SafeWorkflowBlocker = {
  readonly evidenceRef?: string
  readonly id: string
  readonly source?: string
}

export type SafeWorkflowStep = {
  readonly blockerId?: string
  readonly command?: string
  readonly commandAfterContent?: string
  readonly evidenceRef?: string
  readonly id: string
  readonly kind: ClosureStep["kind"]
  readonly source?: string
  readonly status: ClosureStep["status"]
}

export type WorkflowDiagnosticReference = {
  readonly artifactRefs: readonly string[]
  readonly blockerId: string
  readonly status?: ClosureStep["status"]
  readonly stepId?: string
}

export function safeWorkflowCode(value: string, fallback: string): string {
  return value.length <= MAX_CODE_LENGTH && SAFE_CODE_PATTERN.test(value) ? value : fallback
}

export function safeWorkflowDiagnostic(value: string): string {
  if (SAFE_DIAGNOSTIC_CODES.has(value)) {
    return value
  }
  if (/authority|unsigned|attestation/iu.test(value)) {
    return "trusted-authority-required"
  }
  if (/verification|junit|bearshell|compile|gradle|build/iu.test(value)) {
    return /failed|failure|error/iu.test(value) ? "verification-failed" : "verification-unknown"
  }
  if (/implementation report/iu.test(value)) {
    return "implementation-report-missing"
  }
  if (/review report/iu.test(value)) {
    return "review-report-missing"
  }
  if (/report coverage|read coverage/iu.test(value)) {
    return "report-coverage-missing"
  }
  if (/stack alignment/iu.test(value)) {
    return "stack-alignment-mismatch"
  }
  if (/convention/iu.test(value)) {
    return "convention-diagnostic"
  }
  if (/configured|unsafe|path|harness\.jsonc/iu.test(value)) {
    return "configured-path-unavailable"
  }
  if (/tdd/iu.test(value)) {
    return "tdd-diagnostic-unavailable"
  }
  if (/pending|backlog|ticket/iu.test(value)) {
    return "pending-ticket"
  }
  if (/plan/iu.test(value)) {
    return "plan-not-accepted"
  }
  return "workflow-diagnostic-unavailable"
}

export function safeWorkflowTitle(_value: string): string {
  return /^Malformed workflow backlog:/u.test(_value)
    ? "Malformed workflow backlog"
    : "ticket-title-unavailable"
}

export function safeArtifactReference(value: string | undefined): string | undefined {
  if (value === undefined || value.length === 0 || value.length > MAX_PATH_LENGTH) {
    return undefined
  }
  const normalized = value.replaceAll("\\", "/")
  if (
    normalized.startsWith("/")
    || /^[A-Za-z]:\//u.test(normalized)
    || !SAFE_PATH_PATTERN.test(normalized)
  ) {
    return undefined
  }
  const segments = normalized.split("/")
  return segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")
    ? undefined
    : normalized
}

export function safeWorkflowCommand(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined
  }
  if (SAFE_FIXED_COMMANDS.has(value)) {
    return value
  }
  return SAFE_ARCHIVE_COMMAND_PATTERN.test(value) ? value : undefined
}

export function safeClosureBlocker(blocker: ClosureBlocker): SafeWorkflowBlocker {
  const evidenceRef = safeArtifactReference(blocker.evidenceRef)
  const source = safeArtifactReference(blocker.source)
  return {
    ...(evidenceRef === undefined ? {} : { evidenceRef }),
    id: safeWorkflowCode(blocker.id, "invalid-blocker-code"),
    ...(source === undefined ? {} : { source }),
  }
}

export function safeClosureStep(step: ClosureStep): SafeWorkflowStep {
  const blockerId = step.blockerId === undefined
    ? undefined
    : safeWorkflowCode(step.blockerId, "invalid-blocker-code")
  const command = safeWorkflowCommand(step.command)
  const commandAfterContent = safeWorkflowCommand(step.commandAfterContent)
  const evidenceRef = safeArtifactReference(step.evidenceRef)
  const source = safeArtifactReference(step.source)
  return {
    ...(blockerId === undefined ? {} : { blockerId }),
    ...(command === undefined ? {} : { command }),
    ...(commandAfterContent === undefined ? {} : { commandAfterContent }),
    ...(evidenceRef === undefined ? {} : { evidenceRef }),
    id: safeWorkflowCode(step.id, "invalid-step-code"),
    kind: step.kind,
    ...(source === undefined ? {} : { source }),
    status: step.status,
  }
}

export function workflowDiagnosticReference(
  blocker: ClosureBlocker,
  step: ClosureStep | null,
): WorkflowDiagnosticReference {
  const refs = [blocker.evidenceRef, blocker.source, step?.evidenceRef, step?.source]
    .flatMap((value) => {
      const ref = safeArtifactReference(value)
      return ref === undefined ? [] : [ref]
    })
  const artifactRefs = [...new Set(refs)].slice(0, MAX_ARTIFACT_REFERENCES)
  return {
    artifactRefs,
    blockerId: safeWorkflowCode(blocker.id, "invalid-blocker-code"),
    ...(step === null ? {} : {
      status: step.status,
      stepId: safeWorkflowCode(step.id, "invalid-step-code"),
    }),
  }
}

export function safeWorkflowClosureNextPayload(payload: ClosureNextPayload) {
  const blockers = payload.state.blockers.slice(0, MAX_BLOCKERS).map(safeClosureBlocker)
  const steps = payload.steps.slice(0, MAX_BLOCKERS).map(safeClosureStep)
  const currentTicket = payload.state.currentTicket === null
    ? null
    : safeClosureTicket(payload.state.currentTicket)
  const tddEvidenceRef = safeArtifactReference(payload.state.tdd.evidenceRef)
  const tddSource = "source" in payload.state.tdd
    ? safeArtifactReference(payload.state.tdd.source)
    : undefined
  return {
    action: "next" as const,
    nextStep: steps[0] ?? null,
    rendering: {
      blockerCount: payload.state.blockers.length,
      renderedBlockerCount: blockers.length,
      truncated: payload.state.blockers.length > blockers.length,
    },
    state: {
      archive: payload.state.archive,
      blockers,
      currentTicket,
      evidence: payload.state.evidence,
      finish: payload.state.finish,
      implementationReport: payload.state.implementationReport,
      pendingTickets: payload.state.pendingTickets
        .slice(0, MAX_TICKETS)
        .map((ticket) => safeWorkflowCode(ticket, "invalid-ticket-code")),
      plan: safeWorkflowCode(payload.state.plan, "unknown"),
      reportCoverage: payload.state.reportCoverage,
      reviewReport: payload.state.reviewReport,
      tdd: {
        ...(tddEvidenceRef === undefined ? {} : { evidenceRef: tddEvidenceRef }),
        kind: payload.state.tdd.kind,
        ...(tddSource === undefined ? {} : { source: tddSource }),
      },
      verification: payload.state.verification,
    },
    steps,
  }
}

export function safeWorkflowClosureStatusPayload(payload: ClosureStatusPayload) {
  const nextPayload = safeWorkflowClosureNextPayload({
    action: "next",
    nextStep: null,
    state: payload.state,
    steps: payload.steps,
  })
  return {
    action: "status" as const,
    state: {
      ...nextPayload.state,
      blockers: payload.state.blockers
        .slice(0, MAX_BLOCKERS)
        .map(safeClosureStatusBlocker),
      currentTicket: payload.state.currentTicket === null
        ? null
        : safeClosureStatusTicket(payload.state.currentTicket),
      tdd: safeClosureStatusTdd(payload.state.tdd),
    },
    steps: payload.steps.slice(0, MAX_BLOCKERS).map(safeClosureStatusStep),
  }
}

function safeClosureTicket(ticket: ClosureTicket) {
  const path = safeArtifactReference(ticket.path)
  return {
    id: safeWorkflowCode(ticket.id, "invalid-ticket-code"),
    ...(path === undefined ? {} : { path }),
    reviewArchiveCandidate: ticket.reviewArchiveCandidate,
    state: ticket.state,
  }
}

function safeClosureStatusTicket(ticket: ClosureTicket) {
  const path = safeArtifactReference(ticket.path)
  return {
    id: safeWorkflowCode(ticket.id, "invalid-ticket-code"),
    title: safeWorkflowTitle(ticket.title),
    ...(path === undefined ? { path: ".persona/workflow" } : { path }),
    reviewArchiveCandidate: ticket.reviewArchiveCandidate,
    state: ticket.state,
    technicalSignals: ticket.technicalSignals
      .slice(0, MAX_TICKETS)
      .map(() => "workflow-signal-observed"),
  }
}

function safeClosureStatusBlocker(blocker: ClosureBlocker) {
  const evidenceRef = safeArtifactReference(blocker.evidenceRef)
  const source = safeArtifactReference(blocker.source)
  return {
    ...(evidenceRef === undefined ? {} : { evidenceRef }),
    id: safeWorkflowCode(blocker.id, "invalid-blocker-code"),
    reason: safeWorkflowDiagnostic(blocker.reason),
    ...(source === undefined ? { source: ".persona/workflow" } : { source }),
    ...(blocker.tickets === undefined
      ? {}
      : { tickets: blocker.tickets.slice(0, MAX_TICKETS).map(safeClosureStatusTicket) }),
  }
}

function safeClosureStatusStep(step: ClosureStep) {
  const safeStep = safeClosureStep(step)
  return {
    ...safeStep,
    ...(step.reason === undefined ? {} : { reason: safeWorkflowDiagnostic(step.reason) }),
  }
}

function safeClosureStatusTdd(tdd: WorkflowClosureState["tdd"]) {
  const evidenceRef = safeArtifactReference(tdd.evidenceRef)
  const source = "source" in tdd ? safeArtifactReference(tdd.source) : undefined
  return {
    ...(evidenceRef === undefined ? {} : { evidenceRef }),
    kind: tdd.kind,
    reason: safeWorkflowDiagnostic(tdd.reason),
    ...(source === undefined ? {} : { source }),
  }
}
