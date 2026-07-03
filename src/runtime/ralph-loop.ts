import { readWorkflowClosurePayload } from "../cli/workflow-closure.js"
import { createContinuationPromptText } from "../cli/continuation-prompt.js"
import type { HarnessRalphLoopConfig } from "../config/harness-config.js"
import { ContinuationUtteranceGate } from "./continuation-utterance-gate.js"
import type { IdleContinuationClient } from "./idle-continuation.js"
import {
  EMPTY_RALPH_LOOP_SESSION_STATE,
  readRalphLoopState,
  sessionRalphLoopState,
  withRalphLoopSessionState,
  writeRalphLoopState,
} from "./ralph-loop-state.js"
import type { RalphLoopSessionState, RalphLoopStopReason } from "./ralph-loop-state.js"

export type RalphLoopContinuationStatus =
  | "capped"
  | "cooldown"
  | "disabled"
  | "gate-blocked"
  | "no-blockers"
  | "no-client"
  | "prompt-sent"
  | "summary-sent"

export type RalphLoopContinuationResult = {
  readonly status: RalphLoopContinuationStatus
}

type RalphLoopContinuationOptions = {
  readonly client?: IdleContinuationClient
  readonly config: HarnessRalphLoopConfig
  readonly now?: () => Date
  readonly projectDir: string
}

function elapsedMsSince(isoTimestamp: string | null, nowMs: number): number | null {
  if (isoTimestamp === null) {
    return null
  }
  const parsed = Date.parse(isoTimestamp)
  return Number.isFinite(parsed) ? nowMs - parsed : null
}

function stoppedSessionState(
  previous: RalphLoopSessionState,
  reason: RalphLoopStopReason,
): RalphLoopSessionState {
  return {
    ...previous,
    lastStopReason: reason,
  }
}

function cappedSessionState(previous: RalphLoopSessionState): RalphLoopSessionState {
  return {
    ...previous,
    capped: true,
    lastStopReason: "max-attempts",
  }
}

function markCapSummaryNotified(previous: RalphLoopSessionState): RalphLoopSessionState {
  return {
    ...previous,
    capSummaryNotified: true,
  }
}

function attemptedSessionState(
  previous: RalphLoopSessionState,
  blockerId: string,
  now: string,
  maxAttempts: number,
): RalphLoopSessionState {
  const previousBlocker = previous.blockerAttempts[blockerId] ?? EMPTY_RALPH_LOOP_SESSION_STATE.blockerAttempts[blockerId]
  const blockerAttempts = previousBlocker?.attempts ?? 0
  const nextBlockerAttempts = blockerAttempts + 1
  const attemptsUsed = previous.attemptsUsed + 1
  const capped = attemptsUsed >= maxAttempts || nextBlockerAttempts >= maxAttempts
  return {
    ...previous,
    attemptsUsed,
    blockerAttempts: {
      ...previous.blockerAttempts,
      [blockerId]: {
        attempts: nextBlockerAttempts,
        capped,
        lastUtteranceAt: now,
      },
    },
    capped,
    capSummaryNotified: capped ? previous.capSummaryNotified : false,
    lastBlockerId: blockerId,
    lastStopReason: capped ? "max-attempts" : null,
    lastUtteranceAt: now,
  }
}

function capSummaryText(blockerId: string, reason: string, attemptsUsed: number, maxAttempts: number): string {
  return [
    "[Persona Harness Ralph Loop]",
    "Retry cap reached; no further blocker continuation prompt will be sent for this session.",
    `Blocker: ${blockerId}`,
    `Reason: ${reason}`,
    `Attempts used: ${attemptsUsed}/${maxAttempts}`,
    "PH finish/closure gates remain authoritative. Fix blockers directly, then rerun `npx ph workflow finish implement`.",
  ].join("\n")
}

export class RalphLoopContinuationTracker {
  private readonly utteranceGate = new ContinuationUtteranceGate()

  constructor(private readonly options: RalphLoopContinuationOptions) {}

  async continueIfBlocked(sessionID: string): Promise<RalphLoopContinuationResult> {
    if (!this.options.config.enabled) {
      return { status: "disabled" }
    }
    const client = this.options.client
    if (client === undefined) {
      return { status: "no-client" }
    }

    const nowDate = this.options.now?.() ?? new Date()
    const now = nowDate.toISOString()
    const state = readRalphLoopState(this.options.projectDir, now)
    const sessionState = sessionRalphLoopState(state, sessionID)
    const closure = readWorkflowClosurePayload("next", this.options.projectDir)
    const blocker = closure.state.blockers[0]

    if (blocker === undefined) {
      writeRalphLoopState(
        this.options.projectDir,
        withRalphLoopSessionState(state, sessionID, stoppedSessionState(sessionState, "no-blockers"), now),
      )
      this.utteranceGate.reset(sessionID)
      return { status: "no-blockers" }
    }

    if (sessionState.capped) {
      if (sessionState.capSummaryNotified) {
        return { status: "capped" }
      }
      await this.sendPrompt(sessionID, capSummaryText(blocker.id, blocker.reason, sessionState.attemptsUsed, this.options.config.maxAttempts))
      writeRalphLoopState(
        this.options.projectDir,
        withRalphLoopSessionState(state, sessionID, markCapSummaryNotified(sessionState), now),
      )
      return { status: "summary-sent" }
    }

    if (sessionState.attemptsUsed >= this.options.config.maxAttempts) {
      writeRalphLoopState(
        this.options.projectDir,
        withRalphLoopSessionState(state, sessionID, cappedSessionState(sessionState), now),
      )
      return { status: "capped" }
    }

    const elapsedMs = elapsedMsSince(sessionState.lastUtteranceAt, nowDate.getTime())
    if (elapsedMs !== null && elapsedMs < this.options.config.cooldownMs) {
      return { status: "cooldown" }
    }

    const decision = this.utteranceGate.tryBegin({
      allowSameBlockerRetry: true,
      blockerId: blocker.id,
      maxAttempts: this.options.config.maxAttempts,
      sessionId: sessionID,
    })
    if (decision.kind === "blocked") {
      return { status: "gate-blocked" }
    }

    try {
      const nextSessionState = attemptedSessionState(sessionState, blocker.id, now, this.options.config.maxAttempts)
      writeRalphLoopState(this.options.projectDir, withRalphLoopSessionState(state, sessionID, nextSessionState, now))
      await this.sendPrompt(
        sessionID,
        createContinuationPromptText({
          blocker,
          context: "ralph-loop",
          step: closure.action === "next" ? closure.nextStep : null,
        }),
      )
      return { status: "prompt-sent" }
    } finally {
      decision.complete()
    }
  }

  private async sendPrompt(sessionID: string, text: string): Promise<void> {
    await this.options.client?.session.promptAsync({
      path: { id: sessionID },
      query: { directory: this.options.projectDir },
      body: {
        noReply: false,
        parts: [{ text, type: "text" }],
      },
    })
  }
}
