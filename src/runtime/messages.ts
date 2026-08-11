import type { Part } from "@opencode-ai/sdk"

import type { PendingInjection, TransformMessagesOutput } from "./types.js"

export type RuntimeContextMessageInjectionResult =
  | "observed"
  | "fallback"
  | "duplicate-suppressed"
  | "unavailable"

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
    if (textPart !== undefined) {
      try {
        textPart.text = `${injection.block}\n\n---\n\n${textPart.text}`
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
            text: `${injection.block}\n\n---\n\n${textPart.text}`,
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
        text: injection.block,
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
