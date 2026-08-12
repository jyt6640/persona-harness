import type { Part } from "@opencode-ai/sdk"

import { renderRuntimeContextSections } from "./runtime-context.js"
import type { PendingInjection, TransformMessagesOutput } from "./types.js"
import type { ToolAfterOutput } from "./types.js"

export type RuntimeContextMessageInjectionResult =
  | "observed"
  | "fallback"
  | "duplicate-suppressed"
  | "unavailable"

export const RUNTIME_CONTEXT_TOOL_METADATA_KEY = "personaHarnessRuntimeContext"
const RUNTIME_CONTEXT_TOOL_METADATA_SCHEMA = "runtime-context-tool-delivery.1"

type RuntimeContextToolMetadata = {
  readonly schemaVersion: typeof RUNTIME_CONTEXT_TOOL_METADATA_SCHEMA
  readonly digest: string
  readonly sectionDigests: readonly string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isRuntimeContextToolMetadata(value: unknown): value is RuntimeContextToolMetadata {
  if (!isRecord(value) || value.schemaVersion !== RUNTIME_CONTEXT_TOOL_METADATA_SCHEMA) {
    return false
  }
  return typeof value.digest === "string"
    && Array.isArray(value.sectionDigests)
    && value.sectionDigests.every((digest): digest is string => typeof digest === "string")
}

function matchesRuntimeContextToolMetadata(value: unknown, injection: PendingInjection): boolean {
  if (!isRuntimeContextToolMetadata(value) || value.digest !== injection.contextDigest) {
    return false
  }
  const expected = injection.semanticSections.map((section) => section.digest)
  return value.sectionDigests.length === expected.length
    && value.sectionDigests.every((digest, index) => digest === expected[index])
}

export function markRuntimeContextToolOutput(output: ToolAfterOutput, injection: PendingInjection): void {
  const metadata = isRecord(output.metadata) ? output.metadata : {}
  output.metadata = {
    ...metadata,
    [RUNTIME_CONTEXT_TOOL_METADATA_KEY]: {
      schemaVersion: RUNTIME_CONTEXT_TOOL_METADATA_SCHEMA,
      digest: injection.contextDigest,
      sectionDigests: injection.semanticSections.map((section) => section.digest),
    } satisfies RuntimeContextToolMetadata,
  }
}

export function hasObservedRuntimeContextToolOutput(
  output: TransformMessagesOutput,
  sessionID: string,
  injection: PendingInjection,
): boolean {
  for (const message of output.messages) {
    if (message.info.sessionID !== sessionID) {
      continue
    }
    for (const part of message.parts) {
      if (part.type !== "tool") {
        continue
      }
      const rawPart = part as unknown as Record<string, unknown>
      if (typeof rawPart.sessionID === "string" && rawPart.sessionID !== sessionID) {
        continue
      }
      const state = isRecord(rawPart.state) ? rawPart.state : undefined
      const metadataCandidates = [
        rawPart.metadata,
        state?.metadata,
      ]
      if (metadataCandidates.some((metadata) => {
        return isRecord(metadata) && matchesRuntimeContextToolMetadata(
          metadata[RUNTIME_CONTEXT_TOOL_METADATA_KEY],
          injection,
        )
      })) {
        return true
      }
    }
  }
  return false
}

function isTextPart(part: Part): part is Extract<Part, { type: "text" }> {
  return part.type === "text" && typeof part.text === "string"
}

export function injectTextIntoLatestUserMessage(
  output: TransformMessagesOutput,
  block: string,
  marker: string,
): boolean {
  for (let messageIndex = output.messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = output.messages[messageIndex]
    if (message?.info?.role !== "user") {
      continue
    }

    const textPart = message.parts.find(isTextPart)
    if (textPart) {
      if (textPart.text.includes(marker)) {
        return false
      }
      textPart.text = `${block}\n\n---\n\n${textPart.text}`
      return true
    }

    message.parts.unshift({
      id: "persona-harness-injection",
      sessionID: message.info.sessionID,
      messageID: message.info.id,
      type: "text",
      text: block,
      synthetic: true,
    })
    return true
  }

  return false
}

export function injectIntoLatestUserMessage(
  output: TransformMessagesOutput,
  injection: PendingInjection,
): boolean {
  return injectTextIntoLatestUserMessage(output, injection.block, "[Persona Harness Injection]")
}

export function injectRuntimeContextIntoLatestUserMessage(
  output: TransformMessagesOutput,
  injection: PendingInjection,
): RuntimeContextMessageInjectionResult {
  for (let messageIndex = output.messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = output.messages[messageIndex]
    if (message?.info?.role !== "user") {
      continue
    }

    const alreadyInjected = message.parts.some((part) => {
      if (part.type !== "text") {
        return false
      }
      const metadata = (part as typeof part & { readonly metadata?: Record<string, unknown> }).metadata
      return metadata?.personaHarnessContextDigest === injection.contextDigest
    })
    if (alreadyInjected) {
      return "duplicate-suppressed"
    }

    const textPart = message.parts.find(isTextPart)
    const metadata = {
      personaHarnessContextDigest: injection.contextDigest,
      personaHarnessContextSectionDigests: injection.semanticSections.map((section) => section.digest),
    }
    const renderedPayload = renderRuntimeContextSections(injection.semanticSections)
    if (textPart !== undefined) {
      try {
        textPart.text = `${renderedPayload}\n\n---\n\n${textPart.text}`
        ;(textPart as typeof textPart & { metadata?: Record<string, unknown> }).metadata = metadata
        return "observed"
      } catch {
        try {
          const partIndex = message.parts.indexOf(textPart)
          if (partIndex < 0) {
            return "unavailable"
          }
          message.parts.splice(partIndex, 1, {
            ...textPart,
            id: `persona-harness-runtime-context-fallback-${injection.contextDigest.slice(-16)}`,
            text: `${renderedPayload}\n\n---\n\n${textPart.text}`,
            synthetic: true,
          } as Part)
          return "fallback"
        } catch {
          return "unavailable"
        }
      }
    }

    try {
      message.parts.unshift({
        id: `persona-harness-runtime-context-${injection.contextDigest.slice(-16)}`,
        sessionID: message.info.sessionID,
        messageID: message.info.id,
        type: "text",
        text: renderedPayload,
        synthetic: true,
        metadata,
      } as Part)
      return "observed"
    } catch {
      return "unavailable"
    }
  }

  return "unavailable"
}
