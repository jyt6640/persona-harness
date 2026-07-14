import type { AssistantMessage, Message } from "@opencode-ai/sdk"

import type { HarnessCompactionConfig } from "../config/harness-config.js"
import { resolveSafeEvidenceRootResult } from "../config/harness-config.js"
import { warnRuntimeFailure } from "./error-boundary.js"
import {
  compactionEvidenceCooldownUntil,
  writeCompactionAttempt,
  type CompactionAttempt,
  type CompactionMeasurement,
  type TokenCompactionSummarizeOptions,
} from "./token-compaction-evidence.js"
import type { TokenTelemetryRecordResult, TokenUsageEvidence } from "./token-telemetry.js"

export type { TokenCompactionSummarizeOptions } from "./token-compaction-evidence.js"

export type TokenCompactionClient = {
  readonly session: {
    readonly summarize?: (options: TokenCompactionSummarizeOptions) => Promise<unknown> | unknown
  }
}

type CompactionAttemptInput = {
  readonly measurement: CompactionMeasurement
  readonly reason?: string
  readonly request?: TokenCompactionSummarizeOptions
  readonly status: CompactionAttempt["status"]
  readonly timestamp: string
}

export type TokenCompactionResult =
  | { readonly kind: "disabled" }
  | { readonly kind: "failed"; readonly path: string; readonly reason: string }
  | { readonly kind: "skipped"; readonly path: string; readonly reason: string }
  | { readonly kind: "triggered"; readonly path: string }

type TokenCompactionTrackerOptions = {
  readonly client?: TokenCompactionClient
  readonly config: HarnessCompactionConfig
  readonly evidenceDir?: string
  readonly projectDir: string
}

const AFTER_MEASUREMENT_REASON =
  "effectiveness unmeasured until a later provider token event changes cacheRead/total; no token-saving claim"

function isAssistantMessage(message: Message): message is AssistantMessage {
  return message.role === "assistant"
}

function beforeMeasurement(payload: TokenUsageEvidence): CompactionMeasurement {
  if (payload.ratio === null) {
    return {
      aggregate: payload.aggregate,
      measured: false,
      reason: payload.modelLimitUnavailableReason ?? "ratio-unavailable",
    }
  }
  return {
    aggregate: payload.aggregate,
    measured: true,
    ratio: payload.ratio,
  }
}

function attemptWith(input: CompactionAttemptInput): CompactionAttempt {
  return {
    afterMeasurement: {
      measured: false,
      reason: AFTER_MEASUREMENT_REASON,
    },
    beforeMeasurement: input.measurement,
    reason: input.reason,
    request: input.request,
    status: input.status,
    timestamp: input.timestamp,
  }
}

export class TokenCompactionTracker {
  private readonly cooldownUntilBySession = new Map<string, number>()
  private readonly evidenceDir: string | undefined

  constructor(private readonly options: TokenCompactionTrackerOptions) {
    const result = resolveSafeEvidenceRootResult(options.projectDir, options.evidenceDir)
    this.evidenceDir = result.ok ? result.path : undefined
  }

  async maybeSummarize(
    message: Message,
    telemetryResult: TokenTelemetryRecordResult,
    now = new Date(),
  ): Promise<TokenCompactionResult> {
    const evidenceDir = this.evidenceDir
    if (evidenceDir === undefined) {
      return { kind: "disabled" }
    }
    if (!this.options.config.enabled) {
      return { kind: "disabled" }
    }
    if (!isAssistantMessage(message) || telemetryResult.kind !== "written") {
      return { kind: "disabled" }
    }

    const measurement = beforeMeasurement(telemetryResult.payload)
    const skipped = (reason: string): TokenCompactionResult => {
      try {
        const path = writeCompactionAttempt(
          evidenceDir,
          message.sessionID,
          attemptWith({
            measurement,
            reason,
            status: "skipped",
            timestamp: now.toISOString(),
          }),
        )
        return { kind: "skipped", path, reason }
      } catch (error) {
        const runtimeError = error instanceof Error ? error : new Error(String(error))
        warnRuntimeFailure("evidence-write", "token-compaction", message.sessionID, runtimeError)
        return { kind: "skipped", path: "", reason }
      }
    }

    if (!measurement.measured) {
      return skipped("ratio-unavailable")
    }
    if (measurement.ratio < this.options.config.threshold) {
      return skipped("below-threshold")
    }

    const cooldownUntil = this.cooldownUntilBySession.get(message.sessionID) ?? 0
    const persistedCooldownUntil = compactionEvidenceCooldownUntil(
      evidenceDir,
      message.sessionID,
      this.options.config.cooldownMs,
    )
    if (now.getTime() < Math.max(cooldownUntil, persistedCooldownUntil)) {
      return skipped("cooldown-active")
    }

    const session = this.options.client?.session
    if (session?.summarize === undefined) {
      return skipped("summarize-client-unavailable")
    }

    const request: TokenCompactionSummarizeOptions = {
      body: {
        modelID: message.modelID,
        providerID: message.providerID,
      },
      path: { id: message.sessionID },
      query: { directory: message.path.cwd },
    }

    try {
      await session.summarize(request)
      this.cooldownUntilBySession.set(message.sessionID, now.getTime() + this.options.config.cooldownMs)
      const path = writeCompactionAttempt(
        evidenceDir,
        message.sessionID,
        attemptWith({ measurement, request, status: "triggered", timestamp: now.toISOString() }),
      )
      return { kind: "triggered", path }
    } catch (error) {
      this.cooldownUntilBySession.set(message.sessionID, now.getTime() + this.options.config.cooldownMs)
      const runtimeError = error instanceof Error ? error : new Error(String(error))
      const path = writeCompactionAttempt(
        evidenceDir,
        message.sessionID,
        attemptWith({
          measurement,
          reason: runtimeError.message,
          request,
          status: "failed",
          timestamp: now.toISOString(),
        }),
      )
      return { kind: "failed", path, reason: runtimeError.message }
    }
  }
}
