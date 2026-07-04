import { createContinuationPromptText } from "../cli/continuation-prompt.js"
import { readWorkflowClosurePayload } from "../cli/workflow-closure.js"
import type { HarnessRalphLoopConfig } from "../config/harness-config.js"
import { ContinuationUtteranceGate } from "./continuation-utterance-gate.js"
import {
  readRalphLoopState,
  sessionRalphLoopState,
  withRalphLoopSessionState,
  writeRalphLoopState,
} from "./ralph-loop-state.js"
import type { RalphLoopSessionState } from "./ralph-loop-state.js"

const TOOL_CONTINUATION_MARKER = "[Persona Harness Ralph Loop Tool Continuation]"
const ELIGIBLE_TOOL_NAMES = new Set(["bash", "shell", "terminal"])
const FINISH_OR_CHECK_COMMAND = /\b(?:npx\s+)?ph\s+workflow\s+(?:finish\s+implement|check)\b/u
const CLOSURE_BLOCKER_OUTPUT = /Closure blocker:/u

export type RalphLoopToolOutputResult =
  | { readonly kind: "appended"; readonly output: string }
  | { readonly kind: "skipped" }

type RalphLoopToolOutputOptions = {
  readonly config: HarnessRalphLoopConfig
  readonly now?: () => Date
  readonly projectDir: string
}

type RalphLoopToolOutputInput = {
  readonly args: Readonly<Record<string, unknown>>
  readonly output: string
  readonly sessionID: string
  readonly tool: string
}

function commandFromArgs(args: Readonly<Record<string, unknown>>): string | undefined {
  return typeof args.command === "string" ? args.command : undefined
}

export function isRalphLoopToolOutputCandidate(input: RalphLoopToolOutputInput): boolean {
  const command = commandFromArgs(input.args)
  return (
    ELIGIBLE_TOOL_NAMES.has(input.tool) &&
    command !== undefined &&
    FINISH_OR_CHECK_COMMAND.test(command) &&
    CLOSURE_BLOCKER_OUTPUT.test(input.output) &&
    !input.output.includes(TOOL_CONTINUATION_MARKER)
  )
}

function elapsedMsSince(isoTimestamp: string | null, nowMs: number): number | null {
  if (isoTimestamp === null) {
    return null
  }
  const parsed = Date.parse(isoTimestamp)
  return Number.isFinite(parsed) ? nowMs - parsed : null
}

function blockerAttempts(previous: RalphLoopSessionState, blockerId: string): number {
  return previous.blockerAttempts[blockerId]?.attempts ?? 0
}

function attemptedSessionState(
  previous: RalphLoopSessionState,
  blockerId: string,
  config: HarnessRalphLoopConfig,
  now: string,
): RalphLoopSessionState {
  const nextBlockerAttempts = blockerAttempts(previous, blockerId) + 1
  const attemptsUsed = previous.attemptsUsed + 1
  const sessionCapped = attemptsUsed >= config.maxSessionAttempts
  return {
    ...previous,
    attemptsUsed,
    blockerAttempts: {
      ...previous.blockerAttempts,
      [blockerId]: {
        attempts: nextBlockerAttempts,
        capped: nextBlockerAttempts >= config.maxAttempts,
        lastUtteranceAt: now,
      },
    },
    capped: sessionCapped,
    capSummaryNotified: sessionCapped ? previous.capSummaryNotified : false,
    lastBlockerId: blockerId,
    lastStopReason: sessionCapped ? "max-attempts" : null,
    lastUtteranceAt: now,
  }
}

function cappedSessionState(previous: RalphLoopSessionState): RalphLoopSessionState {
  return {
    ...previous,
    capped: true,
    lastStopReason: "max-attempts",
  }
}

function capSummaryText(blockerId: string, reason: string, sessionAttemptsUsed: number, config: HarnessRalphLoopConfig): string {
  return [
    "[Persona Harness Ralph Loop]",
    "Retry cap reached; no further blocker continuation prompt will be sent for this session.",
    `Blocker: ${blockerId}`,
    `Reason: ${reason}`,
    `Attempts used: ${sessionAttemptsUsed}/${config.maxSessionAttempts}`,
    `Per-blocker cap: ${config.maxAttempts}`,
    "PH finish/closure gates remain authoritative. Fix blockers directly, then rerun `npx ph workflow finish implement`.",
  ].join("\n")
}

function markCapSummaryNotified(previous: RalphLoopSessionState): RalphLoopSessionState {
  return {
    ...previous,
    capSummaryNotified: true,
  }
}

function withToolContinuationMarker(output: string, prompt: string): string {
  return `${output}\n\n---\n\n${TOOL_CONTINUATION_MARKER}\n\n${prompt}`
}

export class RalphLoopToolOutputContinuationTracker {
  private readonly utteranceGate = new ContinuationUtteranceGate()

  constructor(private readonly options: RalphLoopToolOutputOptions) {}

  appendIfEligible(input: RalphLoopToolOutputInput): RalphLoopToolOutputResult {
    if (!this.options.config.enabled || !this.options.config.toolOutputTrigger || !isRalphLoopToolOutputCandidate(input)) {
      return { kind: "skipped" }
    }

    const nowDate = this.options.now?.() ?? new Date()
    const now = nowDate.toISOString()
    const state = readRalphLoopState(this.options.projectDir, now)
    const sessionState = sessionRalphLoopState(state, input.sessionID)
    const closure = readWorkflowClosurePayload("next", this.options.projectDir)
    const blocker = closure.state.blockers[0]
    if (blocker === undefined) {
      return { kind: "skipped" }
    }

    if (
      sessionState.capped ||
      sessionState.attemptsUsed >= this.options.config.maxSessionAttempts ||
      blockerAttempts(sessionState, blocker.id) >= this.options.config.maxAttempts
    ) {
      if (sessionState.capSummaryNotified) {
        return { kind: "skipped" }
      }
      const capped = markCapSummaryNotified(cappedSessionState(sessionState))
      writeRalphLoopState(this.options.projectDir, withRalphLoopSessionState(state, input.sessionID, capped, now))
      return {
        kind: "appended",
        output: withToolContinuationMarker(
          input.output,
          capSummaryText(blocker.id, blocker.reason, sessionState.attemptsUsed, this.options.config),
        ),
      }
    }

    const elapsedMs = elapsedMsSince(sessionState.lastUtteranceAt, nowDate.getTime())
    if (elapsedMs !== null && elapsedMs < this.options.config.cooldownMs) {
      return { kind: "skipped" }
    }

    const decision = this.utteranceGate.tryBegin({
      allowSameBlockerRetry: true,
      blockerId: blocker.id,
      maxAttempts: this.options.config.maxSessionAttempts,
      sessionId: input.sessionID,
    })
    if (decision.kind === "blocked") {
      return { kind: "skipped" }
    }

    try {
      const nextSessionState = attemptedSessionState(sessionState, blocker.id, this.options.config, now)
      writeRalphLoopState(this.options.projectDir, withRalphLoopSessionState(state, input.sessionID, nextSessionState, now))
      return {
        kind: "appended",
        output: withToolContinuationMarker(
          input.output,
          createContinuationPromptText({
            blocker,
            context: "ralph-loop",
            depth: { index: 1, total: closure.state.blockers.length },
            step: closure.action === "next" ? closure.nextStep : null,
          }),
        ),
      }
    } finally {
      decision.complete()
    }
  }
}
