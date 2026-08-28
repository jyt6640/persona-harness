import type { Hooks } from "@opencode-ai/plugin"
import type { Part } from "@opencode-ai/sdk"

import { readContextPreview, type ContextPreviewOptions } from "../cli/context-preview.js"
import { resolveContainedPath } from "../io/bounded-path-walker.js"
import { extractTargetFile, isInstalledPersonaHarnessPackageFile } from "../io/tool-target.js"
import { ContextDeliveryStore, type PendingContextDelivery } from "./context-delivery-store.js"

const CONTEXT_DELIVERY_MARKER = "[Persona Harness Context]"

type HookHandler<T> = NonNullable<T>
type ContextEventInput = Parameters<HookHandler<Hooks["event"]>>[0]
type ContextToolAfterInput = Parameters<HookHandler<Hooks["tool.execute.after"]>>[0]
type ContextMessagesOutput = Parameters<HookHandler<Hooks["experimental.chat.messages.transform"]>>[1]

export type OpenCodeContextHookOptions = {
  readonly personalization?: ContextPreviewOptions["personalization"]
  readonly projectDir: string
  readonly store?: ContextDeliveryStore
}

export type OpenCodeContextHooks = Pick<Hooks, "event" | "experimental.chat.messages.transform" | "tool.execute.after">

export function createOpenCodeContextHooks(options: OpenCodeContextHookOptions): OpenCodeContextHooks {
  const store = options.store ?? new ContextDeliveryStore()

  return {
    event: async (input: ContextEventInput): Promise<void> => {
      const sessionID = terminalSessionID(input.event)
      if (sessionID !== undefined) store.clear(sessionID)
    },
    "tool.execute.after": async (input: ContextToolAfterInput): Promise<void> => {
      const sessionID = typeof input.sessionID === "string" ? input.sessionID : undefined
      const args = asRecord(input.args)
      if (sessionID === undefined || args === undefined) return
      const targetFile = extractTargetFile(input.tool, args)
      if (targetFile === undefined || isInstalledPersonaHarnessPackageFile(targetFile)) return

      const containedTarget = resolveContainedPath(options.projectDir, targetFile)
      if (!containedTarget.ok) return
      const delivery = resolveDelivery(options.projectDir, containedTarget.relativePath, options.personalization)
      if (delivery !== undefined) store.offer(sessionID, delivery)
    },
    "experimental.chat.messages.transform": async (
      _input: unknown,
      output: ContextMessagesOutput,
    ): Promise<void> => {
      const sessionID = latestUserSessionID(output)
      if (sessionID === undefined) return
      const delivery = store.take(sessionID)
      if (delivery === undefined) return
      if (injectContextBlock(output, sessionID, delivery.block)) store.markDelivered(sessionID, delivery)
    },
  }
}

function resolveDelivery(
  projectDir: string,
  targetPath: string,
  personalization: ContextPreviewOptions["personalization"],
): PendingContextDelivery | undefined {
  try {
    const result = readContextPreview([targetPath], projectDir, { personalization })
    if (result.status === "blocked" || !result.preview.contextEnabled || result.preview.envelope.status !== "resolved") {
      return undefined
    }
    const block = renderContextBlock(result.preview.envelope.selected.map((capsule) => capsule.content))
    return block.length <= result.preview.envelope.budget.maxChars
      ? { block, digest: result.preview.envelope.digest }
      : undefined
  } catch {
    return undefined
  }
}

function renderContextBlock(capsules: readonly string[]): string {
  return `${CONTEXT_DELIVERY_MARKER}\n${capsules.join("\n")}`
}

function injectContextBlock(output: ContextMessagesOutput, sessionID: string, block: string): boolean {
  for (let index = output.messages.length - 1; index >= 0; index -= 1) {
    const message = output.messages[index]
    if (message?.info.role !== "user" || message.info.sessionID !== sessionID) continue
    const textPart = message.parts.find(isTextPart)
    if (textPart !== undefined) {
      textPart.text = `${block}\n\n---\n\n${textPart.text}`
      return true
    }
    message.parts.unshift({
      id: "persona-harness-context",
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

function terminalSessionID(event: ContextEventInput["event"]): string | undefined {
  if (event.type === "session.compacted") return event.properties.sessionID
  if (event.type === "session.deleted") return event.properties.info.id
  return undefined
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return isRecord(value) ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isTextPart(part: Part): part is Extract<Part, { type: "text" }> {
  return part.type === "text" && typeof part.text === "string"
}
