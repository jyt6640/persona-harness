import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import type { Message } from "@opencode-ai/sdk"

import { EVIDENCE_PRIVACY_CLASS } from "../config/evidence-privacy.js"
import { resolveSafeEvidenceRootResult } from "../config/harness-config.js"
import { isRecord } from "../config/jsonc.js"
import { warnRuntimeFailure } from "./error-boundary.js"
import { opaqueEvidenceKey, writePrivateEvidenceJson } from "./evidence-file.js"

export type TokenUsage = {
  readonly cacheRead: number
  readonly cacheWrite: number
  readonly input: number
  readonly output: number
  readonly reasoning: number
  readonly total: number
}

type ModelLimit = {
  readonly context: number
  readonly source: "experimental.chat.system.transform"
}

type ModelWithContextLimit = {
  readonly limit?: {
    readonly context?: unknown
  }
}

type TokenMessageEntry = {
  readonly messageID: string
  readonly modelID: string
  readonly providerID: string
  readonly tokens: TokenUsage
  readonly updatedAt: string
}

export type TokenUsageEvidence = {
  readonly aggregate: TokenUsage
  readonly createdAt: string
  readonly messages: readonly TokenMessageEntry[]
  readonly modelID: string
  readonly modelLimit: number | null
  readonly modelLimitSource: ModelLimit["source"] | null
  readonly modelLimitUnavailableReason: string | null
  readonly privacyClass: "metadata-safe"
  readonly providerID: string
  readonly ratio: number | null
  readonly schemaVersion: "token-usage.1"
  readonly sessionID: string
  readonly source: "opencode-plugin-event:message.updated"
  readonly updatedAt: string
}

export type TokenTelemetryRecordResult =
  | { readonly kind: "ignored"; readonly reason: string }
  | { readonly kind: "written"; readonly path: string; readonly payload: TokenUsageEvidence }

type TokenTelemetryRecorderOptions = {
  readonly evidenceDir?: string
}

const LIMIT_UNAVAILABLE_REASON = "model context limit not observed for this session; ratio not computed"

export function safeSessionKey(sessionID: string): string {
  return opaqueEvidenceKey(sessionID)
}

function tokenUsageFrom(message: Extract<Message, { role: "assistant" }>): TokenUsage {
  const cacheRead = message.tokens.cache.read
  const cacheWrite = message.tokens.cache.write
  const input = message.tokens.input
  const output = message.tokens.output
  const reasoning = message.tokens.reasoning
  return {
    cacheRead,
    cacheWrite,
    input,
    output,
    reasoning,
    total: input + output + reasoning + cacheRead + cacheWrite,
  }
}

function zeroUsage(): TokenUsage {
  return { cacheRead: 0, cacheWrite: 0, input: 0, output: 0, reasoning: 0, total: 0 }
}

function aggregateUsage(messages: readonly TokenMessageEntry[]): TokenUsage {
  return messages.reduce<TokenUsage>(
    (aggregate, message) => ({
      cacheRead: aggregate.cacheRead + message.tokens.cacheRead,
      cacheWrite: aggregate.cacheWrite + message.tokens.cacheWrite,
      input: aggregate.input + message.tokens.input,
      output: aggregate.output + message.tokens.output,
      reasoning: aggregate.reasoning + message.tokens.reasoning,
      total: aggregate.total + message.tokens.total,
    }),
    zeroUsage(),
  )
}

function defaultEvidenceDir(projectDir: string): string | undefined {
  const result = resolveSafeEvidenceRootResult(projectDir)
  return result.ok ? result.path : undefined
}

function tokenUsageEvidencePath(evidenceDir: string, sessionID: string): string {
  return join(evidenceDir, "token-usage", `${safeSessionKey(sessionID)}.json`)
}

function readExistingMessages(path: string): readonly TokenMessageEntry[] {
  if (!existsSync(path)) {
    return []
  }
  const parsed = readExistingPayload(path)
  if (parsed === undefined || !Array.isArray(parsed.messages)) {
    return []
  }
  return parsed.messages.filter(isTokenMessageEntry)
}

function readExistingPayload(path: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"))
    return isRecord(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

function isTokenMessageEntry(value: unknown): value is TokenMessageEntry {
  if (!isRecord(value) || typeof value.messageID !== "string" || typeof value.updatedAt !== "string") {
    return false
  }
  return typeof value.providerID === "string" && typeof value.modelID === "string" && isTokenUsage(value.tokens)
}

function isTokenUsage(value: unknown): value is TokenUsage {
  return (
    isRecord(value) &&
    typeof value.cacheRead === "number" &&
    typeof value.cacheWrite === "number" &&
    typeof value.input === "number" &&
    typeof value.output === "number" &&
    typeof value.reasoning === "number" &&
    typeof value.total === "number"
  )
}

function upsertMessage(messages: readonly TokenMessageEntry[], next: TokenMessageEntry): readonly TokenMessageEntry[] {
  const entries = new Map<string, TokenMessageEntry>(messages.map((message) => [message.messageID, message]))
  entries.set(next.messageID, next)
  return [...entries.values()].sort((left, right) => left.messageID.localeCompare(right.messageID))
}

function payloadFor(
  sessionID: string,
  messages: readonly TokenMessageEntry[],
  modelLimit: ModelLimit | undefined,
  createdAt: string,
  updatedAt: string,
): TokenUsageEvidence {
  const aggregate = aggregateUsage(messages)
  const latest = messages.at(-1)
  const contextLimit = modelLimit?.context ?? null
  return {
    aggregate,
    createdAt,
    messages,
    modelID: latest?.modelID ?? "unknown",
    modelLimit: contextLimit,
    modelLimitSource: modelLimit?.source ?? null,
    modelLimitUnavailableReason: contextLimit === null ? LIMIT_UNAVAILABLE_REASON : null,
    privacyClass: EVIDENCE_PRIVACY_CLASS.metadataSafe,
    providerID: latest?.providerID ?? "unknown",
    ratio: contextLimit === null ? null : (aggregate.input + aggregate.cacheRead) / contextLimit,
    schemaVersion: "token-usage.1",
    sessionID,
    source: "opencode-plugin-event:message.updated",
    updatedAt,
  }
}

function createdAtFrom(path: string, fallback: string): string {
  if (!existsSync(path)) {
    return fallback
  }
  const parsed = readExistingPayload(path)
  if (parsed !== undefined && typeof parsed.createdAt === "string") {
    return parsed.createdAt
  }
  return fallback
}

export class TokenTelemetryRecorder {
  private readonly modelLimits = new Map<string, ModelLimit>()
  private readonly evidenceDir: string | undefined

  constructor(projectDir: string, options: TokenTelemetryRecorderOptions = {}) {
    const result = resolveSafeEvidenceRootResult(projectDir, options.evidenceDir)
    this.evidenceDir = result.ok ? result.path : undefined
  }

  rememberModelLimit(sessionID: string | undefined, model: ModelWithContextLimit): void {
    if (sessionID === undefined || typeof model.limit?.context !== "number") {
      return
    }
    this.modelLimits.set(sessionID, {
      context: model.limit.context,
      source: "experimental.chat.system.transform",
    })
  }

  recordMessage(message: Message, now = new Date()): TokenTelemetryRecordResult {
    if (message.role !== "assistant") {
      return { kind: "ignored", reason: "message is not assistant role" }
    }
    if (this.evidenceDir === undefined) {
      return { kind: "ignored", reason: "configured evidence root is unavailable" }
    }
    const outputPath = tokenUsageEvidencePath(this.evidenceDir, message.sessionID)
    try {
      const timestamp = now.toISOString()
      const previousMessages = readExistingMessages(outputPath)
      const messages = upsertMessage(previousMessages, {
        messageID: message.id,
        modelID: message.modelID,
        providerID: message.providerID,
        tokens: tokenUsageFrom(message),
        updatedAt: timestamp,
      })
      const payload = payloadFor(
        message.sessionID,
        messages,
        this.modelLimits.get(message.sessionID),
        createdAtFrom(outputPath, timestamp),
        timestamp,
      )
      writePrivateEvidenceJson(this.evidenceDir, outputPath, payload)
      return { kind: "written", path: outputPath, payload }
    } catch (error) {
      const runtimeError = error instanceof Error ? error : new Error(String(error))
      warnRuntimeFailure("evidence-write", "token-telemetry", outputPath, runtimeError)
      return { kind: "ignored", reason: runtimeError.message }
    }
  }
}
