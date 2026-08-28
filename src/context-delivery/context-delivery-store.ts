export type PendingContextDelivery = {
  readonly block: string
  readonly digest: string
}

export const MAX_TRACKED_CONTEXT_SESSIONS = 128
export const MAX_DELIVERED_CONTEXT_DIGESTS = 32

type ContextDeliverySession = {
  readonly deliveredDigests: ReadonlySet<string>
  readonly pending?: PendingContextDelivery
}

export class ContextDeliveryStore {
  private readonly sessions = new Map<string, ContextDeliverySession>()

  offer(sessionID: string, delivery: PendingContextDelivery): "duplicate-suppressed" | "offered" {
    const current = this.sessions.get(sessionID)
    if (current?.deliveredDigests.has(delivery.digest) || current?.pending?.digest === delivery.digest) {
      return "duplicate-suppressed"
    }
    this.remember(sessionID, {
      deliveredDigests: current?.deliveredDigests ?? new Set<string>(),
      pending: delivery,
    })
    return "offered"
  }

  take(sessionID: string): PendingContextDelivery | undefined {
    const current = this.sessions.get(sessionID)
    if (current === undefined || current.pending === undefined) return undefined
    const pending = current.pending
    if (current.deliveredDigests.size === 0) {
      this.sessions.delete(sessionID)
    } else {
      this.remember(sessionID, { deliveredDigests: current.deliveredDigests })
    }
    return pending
  }

  markDelivered(sessionID: string, delivery: PendingContextDelivery): void {
    const current = this.sessions.get(sessionID)
    const deliveredDigests = new Set(current?.deliveredDigests)
    deliveredDigests.delete(delivery.digest)
    deliveredDigests.add(delivery.digest)
    while (deliveredDigests.size > MAX_DELIVERED_CONTEXT_DIGESTS) {
      const oldestDigest = deliveredDigests.values().next().value
      if (oldestDigest === undefined) break
      deliveredDigests.delete(oldestDigest)
    }
    this.remember(sessionID, { deliveredDigests })
  }

  clear(sessionID: string): void {
    this.sessions.delete(sessionID)
  }

  private remember(sessionID: string, session: ContextDeliverySession): void {
    this.sessions.delete(sessionID)
    this.sessions.set(sessionID, session)
    while (this.sessions.size > MAX_TRACKED_CONTEXT_SESSIONS) {
      const oldestSessionID = this.sessions.keys().next().value
      if (oldestSessionID === undefined) break
      this.sessions.delete(oldestSessionID)
    }
  }
}
