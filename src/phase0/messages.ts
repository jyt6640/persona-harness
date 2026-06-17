import type { Part } from "@opencode-ai/sdk"

import type { PendingInjection, TransformMessagesOutput } from "./types.js"

function isTextPart(part: Part): part is Extract<Part, { type: "text" }> {
  return part.type === "text" && typeof part.text === "string"
}

export function injectIntoLatestUserMessage(
  output: TransformMessagesOutput,
  injection: PendingInjection,
): boolean {
  for (let messageIndex = output.messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = output.messages[messageIndex]
    if (message?.info?.role !== "user") {
      continue
    }

    const textPart = message.parts.find(isTextPart)
    if (textPart) {
      if (textPart.text.includes("[Persona Harness Injection]")) {
        return false
      }
      textPart.text = `${injection.block}\n\n---\n\n${textPart.text}`
      return true
    }

    message.parts.unshift({
      id: "persona-harness-injection",
      sessionID: message.info.sessionID,
      messageID: message.info.id,
      type: "text",
      text: injection.block,
      synthetic: true,
    })
    return true
  }

  return false
}
