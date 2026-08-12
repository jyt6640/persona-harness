import type { PendingInjection } from "./types.js"
import { runtimeContextDigest } from "./runtime-context.js"

export const MAX_PENDING_RUNTIME_CONTEXTS_PER_SESSION = 16
export const MAX_TRACKED_RUNTIME_SESSIONS = 64

export type RuntimeContextDeliveryState =
  | "offered"
  | "tool-output-emitted"
  | "model-input-observed"
  | "model-input-fallback"
  | "duplicate-suppressed"

export type PendingInjectionOffer = {
  readonly accepted: boolean
  readonly digest: string
  readonly kind: "offered" | "duplicate-suppressed" | "bounded"
  readonly injection?: PendingInjection
}

export type RuntimeContextDelivery = {
  readonly digest: string
  readonly sectionDigests: readonly string[]
  state: RuntimeContextDeliveryState
}

export class PendingInjectionStore {
  private readonly pendingBySession = new Map<string, PendingInjection[]>()
  private readonly deliveryBySession = new Map<string, Map<string, RuntimeContextDelivery>>()
  private readonly sectionDigestsBySession = new Map<string, Set<string>>()
  private readonly trackedSessions = new Set<string>()

  set(sessionId: string, injection: PendingInjection): PendingInjectionOffer {
    this.trackSession(sessionId)
    const deliveries = this.deliveryBySession.get(sessionId) ?? new Map<string, RuntimeContextDelivery>()
    this.deliveryBySession.set(sessionId, deliveries)
    const seenSectionDigests = this.sectionDigestsBySession.get(sessionId) ?? new Set<string>()
    this.sectionDigestsBySession.set(sessionId, seenSectionDigests)
    const newSections = injection.semanticSections.filter((section) => !seenSectionDigests.has(section.digest))
    if (newSections.length === 0) {
      const existing = deliveries.get(injection.contextDigest)
      if (existing !== undefined) {
        existing.state = "duplicate-suppressed"
      } else {
        deliveries.set(injection.contextDigest, {
          digest: injection.contextDigest,
          sectionDigests: injection.semanticSections.map((section) => section.digest),
          state: "duplicate-suppressed",
        })
      }
      return { accepted: false, digest: injection.contextDigest, kind: "duplicate-suppressed" }
    }

    const pending = this.pendingBySession.get(sessionId) ?? []
    if (pending.length >= MAX_PENDING_RUNTIME_CONTEXTS_PER_SESSION) {
      return { accepted: false, digest: injection.contextDigest, kind: "bounded" }
    }

    const effectiveInjection = newSections.length === injection.semanticSections.length
      ? injection
      : {
          ...injection,
          semanticSections: newSections,
          contextDigest: runtimeContextDigest(newSections),
        }
    pending.push(effectiveInjection)
    this.pendingBySession.set(sessionId, pending)
    deliveries.set(effectiveInjection.contextDigest, {
      digest: effectiveInjection.contextDigest,
      sectionDigests: effectiveInjection.semanticSections.map((section) => section.digest),
      state: "offered",
    })
    for (const section of newSections) {
      seenSectionDigests.add(section.digest)
    }
    return { accepted: true, digest: effectiveInjection.contextDigest, kind: "offered", injection: effectiveInjection }
  }

  take(sessionId: string): PendingInjection | undefined {
    const pending = this.pendingBySession.get(sessionId)
    const injection = pending?.shift()
    if (pending !== undefined && pending.length === 0) {
      this.pendingBySession.delete(sessionId)
    }
    return injection
  }

  takeForModelInput(sessionId: string): PendingInjection | undefined {
    return this.take(sessionId)
  }

  markToolOutputEmitted(sessionId: string, digest: string): void {
    this.removePending(sessionId, digest)
    this.setState(sessionId, digest, "tool-output-emitted")
  }

  markModelInputObserved(sessionId: string, digest: string): void {
    this.removePending(sessionId, digest)
    this.setState(sessionId, digest, "model-input-observed")
  }

  markModelInputFallback(sessionId: string, digest: string): void {
    this.removePending(sessionId, digest)
    this.setState(sessionId, digest, "model-input-fallback")
  }

  markDuplicateSuppressed(sessionId: string, digest: string): void {
    this.setState(sessionId, digest, "duplicate-suppressed")
  }

  delivery(sessionId: string, digest: string): RuntimeContextDelivery | undefined {
    return this.deliveryBySession.get(sessionId)?.get(digest)
  }

  pendingCount(sessionId: string): number {
    return this.pendingBySession.get(sessionId)?.length ?? 0
  }

  clearSession(sessionId: string): void {
    this.pendingBySession.delete(sessionId)
    this.deliveryBySession.delete(sessionId)
    this.sectionDigestsBySession.delete(sessionId)
    this.trackedSessions.delete(sessionId)
  }

  private trackSession(sessionId: string): void {
    this.trackedSessions.delete(sessionId)
    this.trackedSessions.add(sessionId)
    while (this.trackedSessions.size > MAX_TRACKED_RUNTIME_SESSIONS) {
      const oldest = this.trackedSessions.values().next().value
      if (typeof oldest !== "string") {
        return
      }
      this.clearSession(oldest)
    }
  }

  private removePending(sessionId: string, digest: string): void {
    const pending = this.pendingBySession.get(sessionId)
    if (pending === undefined) {
      return
    }
    const remaining = pending.filter((injection) => injection.contextDigest !== digest)
    if (remaining.length === 0) {
      this.pendingBySession.delete(sessionId)
    } else {
      this.pendingBySession.set(sessionId, remaining)
    }
  }

  private setState(sessionId: string, digest: string, state: RuntimeContextDeliveryState): void {
    const delivery = this.deliveryBySession.get(sessionId)?.get(digest)
    if (delivery !== undefined) {
      delivery.state = state
    }
  }
}
