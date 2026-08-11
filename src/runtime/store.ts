import type { PendingInjection } from "./types.js"

export const MAX_PENDING_RUNTIME_CONTEXTS_PER_SESSION = 16

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
}

export type RuntimeContextDelivery = {
  readonly digest: string
  readonly sectionDigests: readonly string[]
  state: RuntimeContextDeliveryState
}

export class PendingInjectionStore {
  private readonly pendingBySession = new Map<string, PendingInjection[]>()
  private readonly deliveryBySession = new Map<string, Map<string, RuntimeContextDelivery>>()

  set(sessionId: string, injection: PendingInjection): PendingInjectionOffer {
    const digest = injection.contextDigest
    const deliveries = this.deliveryBySession.get(sessionId) ?? new Map<string, RuntimeContextDelivery>()
    this.deliveryBySession.set(sessionId, deliveries)
    const existing = deliveries.get(digest)
    if (existing !== undefined) {
      existing.state = "duplicate-suppressed"
      return { accepted: false, digest, kind: "duplicate-suppressed" }
    }

    const pending = this.pendingBySession.get(sessionId) ?? []
    if (pending.length >= MAX_PENDING_RUNTIME_CONTEXTS_PER_SESSION) {
      return { accepted: false, digest, kind: "bounded" }
    }
    pending.push(injection)
    this.pendingBySession.set(sessionId, pending)
    deliveries.set(digest, {
      digest,
      sectionDigests: injection.semanticSections.map((section) => section.digest),
      state: "offered",
    })
    return { accepted: true, digest, kind: "offered" }
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
