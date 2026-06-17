import type { PendingInjection } from "./types.js"

export class PendingInjectionStore {
  private readonly pendingBySession = new Map<string, PendingInjection>()

  set(sessionId: string, injection: PendingInjection): void {
    this.pendingBySession.set(sessionId, injection)
  }

  take(sessionId: string): PendingInjection | undefined {
    const injection = this.pendingBySession.get(sessionId)
    if (injection) {
      this.pendingBySession.delete(sessionId)
    }
    return injection
  }
}
