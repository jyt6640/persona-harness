import type { Part } from "@opencode-ai/sdk"

import type { PendingInjection, TransformMessagesOutput } from "./types.js"

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
