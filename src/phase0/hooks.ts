import type { Hooks } from "@opencode-ai/plugin"

import { isJavaTargetFile } from "./file-role.js"
import { createInjectionBlock } from "./injection.js"
import { injectIntoLatestUserMessage } from "./messages.js"
import { PendingInjectionStore } from "./store.js"
import { extractTargetFile } from "./target-file.js"
import type {
  ToolAfterInput,
  ToolAfterOutput,
  ToolBeforeInput,
  ToolBeforeOutput,
  TransformMessagesOutput,
} from "./types.js"

export function createPhase0Hooks(store = new PendingInjectionStore()): Hooks {
  function captureTargetFile(tool: string, sessionID: string, args: Record<string, unknown>): void {
    const targetFile = extractTargetFile(tool, args)
    if (!targetFile || !isJavaTargetFile(targetFile)) {
      return
    }

    store.set(sessionID, createInjectionBlock(targetFile))
  }

  return {
    "tool.execute.before": async (input: ToolBeforeInput, output: ToolBeforeOutput): Promise<void> => {
      captureTargetFile(input.tool, input.sessionID, output.args as Record<string, unknown>)
    },

    "tool.execute.after": async (input: ToolAfterInput, _output: ToolAfterOutput): Promise<void> => {
      captureTargetFile(input.tool, input.sessionID, input.args as Record<string, unknown>)
    },

    "experimental.chat.messages.transform": async (
      _input: unknown,
      output: TransformMessagesOutput,
    ): Promise<void> => {
      const latestUserMessage = [...output.messages].reverse().find((message) => message.info.role === "user")
      const sessionId = latestUserMessage?.info.sessionID
      if (!sessionId) {
        return
      }

      const injection = store.take(sessionId)
      if (!injection) {
        return
      }

      injectIntoLatestUserMessage(output, injection)
    },
  }
}
