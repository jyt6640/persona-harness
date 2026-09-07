import type { Hooks } from "@opencode-ai/plugin"

import type { ContextPreviewOptions } from "../cli/context-preview.js"
import { ContextDeliveryStore } from "./context-delivery-store.js"
import { selectContextForTargets } from "./context-target-selection.js"
import { extractContextTargets } from "./context-tool-targets.js"

const CONTEXT_DELIVERY_PART_ID = "persona-harness-context"

type HookHandler<T> = NonNullable<T>
type ContextEventInput = Parameters<HookHandler<Hooks["event"]>>[0]
type ContextToolAfterInput = Parameters<HookHandler<Hooks["tool.execute.after"]>>[0]
type ContextMessagesOutput = Parameters<HookHandler<Hooks["experimental.chat.messages.transform"]>>[1]

export type OpenCodeContextHookOptions = {
  readonly onObservation?: (observation: OpenCodeContextObservation) => void
  readonly personalization?: ContextPreviewOptions["personalization"]
  readonly projectDir: string
  readonly store?: ContextDeliveryStore
}

export type OpenCodeContextObservation =
  | { readonly status: "selected" | "offered"; readonly digest: string; readonly ruleIds: readonly string[]; readonly usedChars: number }
  | { readonly status: "skipped" | "blocked"; readonly reason: string }

export type OpenCodeContextHooks = Pick<Hooks, "event" | "experimental.chat.messages.transform" | "tool.execute.after">

export function createOpenCodeContextHooks(options: OpenCodeContextHookOptions): OpenCodeContextHooks {
  const store = options.store ?? new ContextDeliveryStore()
  const report = (observation: OpenCodeContextObservation): void => {
    try { options.onObservation?.(observation) } catch {}
  }

  return {
    event: async (input: ContextEventInput): Promise<void> => {
      if (input.event.type === "session.deleted") store.clear(input.event.properties.info.id)
    },
    "tool.execute.after": async (input: ContextToolAfterInput): Promise<void> => {
      const sessionID = typeof input.sessionID === "string" ? input.sessionID : undefined
      if (sessionID === undefined) return report({ status: "blocked", reason: "session-invalid" })
      const targets = extractContextTargets(input.tool, input.args)
      if (targets.kind === "unsupported") return report({ status: "skipped", reason: "tool-unsupported" })
      const pending = store.observe(sessionID, targets)
      if (pending.kind === "blocked") report({ status: "blocked", reason: pending.reason })
    },
    "experimental.chat.messages.transform": async (
      _input: unknown,
      output: ContextMessagesOutput,
    ): Promise<void> => {
      const sessionID = latestUserSessionID(output)
      if (sessionID === undefined) return
      const targets = store.take(sessionID)
      if (targets === undefined) return
      if (targets.kind === "blocked") return report({ status: "blocked", reason: targets.reason })
      try {
        const selection = selectContextForTargets(options.projectDir, targets.paths, { personalization: options.personalization })
        if (selection.status !== "selected") return report(selection)
        const metadata = { digest: selection.digest, ruleIds: selection.ruleIds, usedChars: selection.usedChars }
        report({ status: "selected", ...metadata })
        if (containsContextBlock(output, sessionID, selection.block)) return report({ status: "skipped", reason: "context-present" })
        if (injectContextBlock(output, sessionID, selection.block)) report({ status: "offered", ...metadata })
      } catch {
        report({ status: "blocked", reason: "context-unavailable" })
      }
    },
  }
}

function containsContextBlock(output: ContextMessagesOutput, sessionID: string, block: string): boolean {
  return output.messages.some((message) => message.info.sessionID === sessionID && message.parts.some((part) =>
    part.id === CONTEXT_DELIVERY_PART_ID && part.type === "text" && part.synthetic === true && part.text === block,
  ))
}

function injectContextBlock(output: ContextMessagesOutput, sessionID: string, block: string): boolean {
  for (let index = output.messages.length - 1; index >= 0; index -= 1) {
    const message = output.messages[index]
    if (message?.info.role !== "user" || message.info.sessionID !== sessionID) continue
    message.parts.unshift({
      id: CONTEXT_DELIVERY_PART_ID,
      messageID: message.info.id,
      sessionID,
      synthetic: true,
      text: block,
      type: "text",
    })
    return true
  }
  return false
}

function latestUserSessionID(output: ContextMessagesOutput): string | undefined {
  for (let index = output.messages.length - 1; index >= 0; index -= 1) {
    const message = output.messages[index]
    if (message?.info.role === "user" && typeof message.info.sessionID === "string") return message.info.sessionID
  }
  return undefined
}
