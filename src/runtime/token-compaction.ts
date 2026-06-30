import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

import type { AssistantMessage, Message } from "@opencode-ai/sdk"

import type { HarnessCompactionConfig } from "../config/harness-config.js"
import { loadHarnessConfig, resolveConfiguredPath } from "../config/harness-config.js"
import { isRecord } from "../config/jsonc.js"
import { warnRuntimeFailure } from "./error-boundary.js"
import type { TokenTelemetryRecordResult, TokenUsage, TokenUsageEvidence } from "./token-telemetry.js"
import { safeSessionKey } from "./token-telemetry.js"

export type TokenCompactionSummarizeOptions = {
  readonly body: {
    readonly modelID: string
    readonly providerID: string
  }
  readonly path: {
    readonly id: string
  }
  readonly query: {
    readonly directory: string
  }
}

export type TokenCompactionClient = {
  readonly session: {
    readonly summarize?: (options: TokenCompactionSummarizeOptions) => Promise<unknown> | unknown
  }
}

type CompactionMeasurement =
  | {
      readonly aggregate: TokenUsage
      readonly measured: true
      readonly ratio: number
    }
  | {
      readonly aggregate: TokenUsage
      readonly measured: false
      readonly reason: string
    }

type CompactionAttemptStatus = "failed" | "skipped" | "triggered"

type CompactionAttempt = {
  readonly afterMeasurement: {
    readonly measured: false
    readonly reason: string
  }
  readonly beforeMeasurement: CompactionMeasurement
  readonly request?: TokenCompactionSummarizeOptions
  readonly reason?: string
  readonly status: CompactionAttemptStatus
  readonly timestamp: string
}

type CompactionAttemptInput = {
  readonly measurement: CompactionMeasurement
  readonly reason?: string
  readonly request?: TokenCompactionSummarizeOptions
  readonly status: CompactionAttemptStatus
  readonly timestamp: string
}

type CompactionEvidence = {
  readonly attempts: readonly CompactionAttempt[]
  readonly createdAt: string
  readonly schemaVersion: "token-compaction.1"
  readonly sessionID: string
  readonly source: "opencode-plugin-event:message.updated"
  readonly updatedAt: string
}

export type TokenCompactionResult =
  | { readonly kind: "disabled" }
  | { readonly kind: "failed"; readonly path: string; readonly reason: string }
  | { readonly kind: "skipped"; readonly path: string; readonly reason: string }
  | { readonly kind: "triggered"; readonly path: string }

type TokenCompactionTrackerOptions = {
  readonly client?: TokenCompactionClient
  readonly config: HarnessCompactionConfig
  readonly projectDir: string
}

const AFTER_MEASUREMENT_REASON =
  "effectiveness unmeasured until a later provider token event changes cacheRead/total; no token-saving claim"

function isAssistantMessage(message: Message): message is AssistantMessage {
  return message.role === "assistant"
}

function compactionEvidencePath(projectDir: string, sessionID: string): string {
  const config = loadHarnessConfig(projectDir)
  return join(resolveConfiguredPath(projectDir, config.evidenceDir), "compaction", `${safeSessionKey(sessionID)}.json`)
}

function isCompactionAttempt(value: unknown): value is CompactionAttempt {
  return (
    isRecord(value) &&
    typeof value.timestamp === "string" &&
    (value.status === "failed" || value.status === "skipped" || value.status === "triggered") &&
    isRecord(value.beforeMeasurement) &&
    typeof value.beforeMeasurement.measured === "boolean" &&
    isRecord(value.afterMeasurement) &&
    value.afterMeasurement.measured === false &&
    typeof value.afterMeasurement.reason === "string"
  )
}

function readExistingEvidence(path: string): CompactionEvidence | undefined {
  if (!existsSync(path)) {
    return undefined
  }
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"))
    if (
      !isRecord(parsed) ||
      parsed.schemaVersion !== "token-compaction.1" ||
      typeof parsed.sessionID !== "string" ||
      typeof parsed.createdAt !== "string" ||
      !Array.isArray(parsed.attempts)
    ) {
      return undefined
    }
    return {
      attempts: parsed.attempts.filter(isCompactionAttempt),
      createdAt: parsed.createdAt,
      schemaVersion: "token-compaction.1",
      sessionID: parsed.sessionID,
      source: "opencode-plugin-event:message.updated",
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : parsed.createdAt,
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      return undefined
    }
    throw error
  }
}

function writeAttempt(projectDir: string, sessionID: string, attempt: CompactionAttempt): string {
  const outputPath = compactionEvidencePath(projectDir, sessionID)
  const previous = readExistingEvidence(outputPath)
  const payload: CompactionEvidence = {
    attempts: [...(previous?.attempts ?? []), attempt],
    createdAt: previous?.createdAt ?? attempt.timestamp,
    schemaVersion: "token-compaction.1",
    sessionID,
    source: "opencode-plugin-event:message.updated",
    updatedAt: attempt.timestamp,
  }
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`)
  return outputPath
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

  constructor(private readonly options: TokenCompactionTrackerOptions) {}

  async maybeSummarize(
    message: Message,
    telemetryResult: TokenTelemetryRecordResult,
    now = new Date(),
  ): Promise<TokenCompactionResult> {
    if (!this.options.config.enabled) {
      return { kind: "disabled" }
    }
    if (!isAssistantMessage(message) || telemetryResult.kind !== "written") {
      return { kind: "disabled" }
    }

    const measurement = beforeMeasurement(telemetryResult.payload)
    const skipped = (reason: string): TokenCompactionResult => {
      try {
        const path = writeAttempt(
          this.options.projectDir,
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
    if (now.getTime() < cooldownUntil) {
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
      const path = writeAttempt(
        this.options.projectDir,
        message.sessionID,
        attemptWith({ measurement, request, status: "triggered", timestamp: now.toISOString() }),
      )
      return { kind: "triggered", path }
    } catch (error) {
      this.cooldownUntilBySession.set(message.sessionID, now.getTime() + this.options.config.cooldownMs)
      const runtimeError = error instanceof Error ? error : new Error(String(error))
      const path = writeAttempt(
        this.options.projectDir,
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
