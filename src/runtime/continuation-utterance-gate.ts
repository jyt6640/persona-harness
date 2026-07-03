export type ContinuationUtteranceBlockReason = "in-flight" | "retry-cap-reached" | "same-blocker"

type ContinuationUtteranceRequest = {
  readonly blockerId: string
  readonly maxAttempts: number
  readonly sessionId: string
}

type ContinuationUtteranceAllowed = {
  readonly kind: "allowed"
  readonly complete: () => void
}

type ContinuationUtteranceBlocked = {
  readonly kind: "blocked"
  readonly reason: ContinuationUtteranceBlockReason
}

export type ContinuationUtteranceDecision = ContinuationUtteranceAllowed | ContinuationUtteranceBlocked

export class ContinuationUtteranceGate {
  private readonly inFlightSessions = new Set<string>()
  private readonly lastBlockerIds = new Map<string, string>()
  private readonly sentCounts = new Map<string, number>()

  reset(sessionId: string): void {
    this.inFlightSessions.delete(sessionId)
    this.lastBlockerIds.delete(sessionId)
    this.sentCounts.delete(sessionId)
  }

  tryBegin(request: ContinuationUtteranceRequest): ContinuationUtteranceDecision {
    if (this.inFlightSessions.has(request.sessionId)) {
      return { kind: "blocked", reason: "in-flight" }
    }

    const currentCount = this.sentCounts.get(request.sessionId) ?? 0
    if (currentCount >= request.maxAttempts) {
      return { kind: "blocked", reason: "retry-cap-reached" }
    }

    if (this.lastBlockerIds.get(request.sessionId) === request.blockerId) {
      return { kind: "blocked", reason: "same-blocker" }
    }

    this.inFlightSessions.add(request.sessionId)
    this.sentCounts.set(request.sessionId, currentCount + 1)
    this.lastBlockerIds.set(request.sessionId, request.blockerId)

    return {
      kind: "allowed",
      complete: () => {
        this.inFlightSessions.delete(request.sessionId)
      },
    }
  }
}
