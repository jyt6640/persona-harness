import type { ContextEnvelope } from "./context-envelope.js"

export const CONTEXT_DELIVERY_MARKER = "[Persona Harness Context]"

export function renderContextBlock(capsules: readonly string[]): string {
  return capsules.length === 0 ? "" : `${CONTEXT_DELIVERY_MARKER}\n${capsules.join("\n")}`
}

export function renderContextEnvelope(envelope: ContextEnvelope): string {
  return envelope.status === "blocked" ? "" : renderContextBlock([
    ...envelope.warnings.map((warning) => warning.message),
    ...envelope.selected.map((capsule) => capsule.content),
  ])
}
