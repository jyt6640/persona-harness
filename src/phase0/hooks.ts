import type { Hooks } from "@opencode-ai/plugin"

import { writePhase0Evidence } from "./evidence.js"
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

type Phase0HookOptions = {
  projectDir?: string
  store?: PendingInjectionStore
}

function appendInjectionToToolOutput(output: ToolAfterOutput, block: string): void {
  if (typeof output.output !== "string" || output.output.includes("[Persona Harness Injection]")) {
    return
  }

  output.output = `${output.output}\n\n---\n\n${block}`
}

export function createPhase0Hooks(options: Phase0HookOptions = {}): Hooks {
  const store = options.store ?? new PendingInjectionStore()
  const projectDir = options.projectDir ?? process.cwd()

  function captureTargetFile(
    hook: "tool.execute.before" | "tool.execute.after",
    tool: string,
    sessionID: string,
    callID: string | undefined,
    args: Record<string, unknown>,
  ): ReturnType<typeof createInjectionBlock> | undefined {
    const targetFile = extractTargetFile(tool, args)
    if (!targetFile || !isJavaTargetFile(targetFile)) {
      return undefined
    }

    const injection = createInjectionBlock(targetFile)
    store.set(sessionID, injection)
    writePhase0Evidence(projectDir, {
      hook,
      sessionID,
      callID,
      injectedInto: "pending-store",
      injection,
    })
    return injection
  }

  return {
    "tool.execute.before": async (input: ToolBeforeInput, output: ToolBeforeOutput): Promise<void> => {
      captureTargetFile(
        "tool.execute.before",
        input.tool,
        input.sessionID,
        input.callID,
        output.args as Record<string, unknown>,
      )
    },

    "tool.execute.after": async (input: ToolAfterInput, output: ToolAfterOutput): Promise<void> => {
      const injection = captureTargetFile(
        "tool.execute.after",
        input.tool,
        input.sessionID,
        input.callID,
        input.args as Record<string, unknown>,
      )
      if (!injection) {
        return
      }

      appendInjectionToToolOutput(output, injection.block)
      writePhase0Evidence(projectDir, {
        hook: "tool.execute.after",
        sessionID: input.sessionID,
        callID: input.callID,
        injectedInto: "tool-output",
        injection,
      })
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

      if (injectIntoLatestUserMessage(output, injection)) {
        writePhase0Evidence(projectDir, {
          hook: "experimental.chat.messages.transform",
          sessionID: sessionId,
          injectedInto: "model-input",
          injection,
        })
      }
    },
  }
}
