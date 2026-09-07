import { MAX_CONTEXT_TARGETS, type ContextToolTargets } from "./context-tool-targets.js"

export const MAX_TRACKED_CONTEXT_SESSIONS = 128

export type PendingContextTargets =
  | { readonly kind: "targets"; readonly paths: readonly string[] }
  | { readonly kind: "blocked"; readonly reason: "tool-input-invalid" | "target-limit" | "session-limit" }

export class ContextDeliveryStore {
  private readonly sessions = new Map<string, PendingContextTargets>()
  private admissionOpen = true

  observe(sessionID: string, targets: Exclude<ContextToolTargets, { readonly kind: "unsupported" }>): PendingContextTargets {
    const current = this.sessions.get(sessionID)
    if (current?.kind === "blocked") return current
    if (current === undefined && (!this.admissionOpen || this.sessions.size >= MAX_TRACKED_CONTEXT_SESSIONS)) {
      // Unknown rejected sessions cannot be tracked within the bound; reset only with a new store.
      this.admissionOpen = false
      return { kind: "blocked", reason: "session-limit" }
    }
    const paths = new Set([...(current?.paths ?? []), ...(targets.kind === "targets" ? targets.paths : [])])
    const pending: PendingContextTargets = targets.kind === "blocked" ? targets
      : paths.size > MAX_CONTEXT_TARGETS ? { kind: "blocked", reason: "target-limit" }
        : { kind: "targets", paths: [...paths].sort() }
    this.sessions.set(sessionID, pending)
    return pending
  }

  take(sessionID: string): PendingContextTargets | undefined {
    const pending = this.sessions.get(sessionID)
    this.sessions.delete(sessionID)
    return pending ?? (this.admissionOpen ? undefined : { kind: "blocked", reason: "session-limit" })
  }

  clear(sessionID: string): void {
    this.sessions.delete(sessionID)
  }
}
