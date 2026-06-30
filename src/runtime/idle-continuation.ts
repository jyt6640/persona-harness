import { readWorkflowClosurePayload } from "../cli/workflow-closure.js"
import type { ClosureBlocker } from "../cli/workflow-closure.js"

export type IdlePromptAsyncOptions = {
  path: {
    id: string
  }
  query: {
    directory: string
  }
  body: {
    noReply: boolean
    parts: {
      type: "text"
      text: string
    }[]
  }
}

export type IdleContinuationClient = {
  readonly session: {
    readonly promptAsync: (options: IdlePromptAsyncOptions) => Promise<unknown> | unknown
  }
}

type IdleContinuationOptions = {
  readonly client?: IdleContinuationClient
  readonly projectDir: string
}

const MAX_CONTINUATIONS_PER_SESSION = 3
const IDLE_CONTINUATION_MARKER = "[Persona Harness Idle Continuation]"

function continuationText(blocker: ClosureBlocker): string {
  return [
    IDLE_CONTINUATION_MARKER,
    "",
    "Closure blockers remain after the session became idle.",
    `Blocker: ${blocker.id}`,
    `Reason: ${blocker.reason}`,
    `Source: ${blocker.source}`,
    "",
    "Next action: run `npx ph workflow continue`, fix only this blocker, then re-run `npx ph workflow finish implement`.",
    "Do not claim done while this blocker remains.",
    "",
    "This is an opt-in continuation nudge, not a hard stop, full orchestration loop, or generated app quality certification.",
  ].join("\n")
}

export class IdleContinuationTracker {
  private readonly sentCounts = new Map<string, number>()
  private readonly lastBlockerIds = new Map<string, string>()

  constructor(private readonly options: IdleContinuationOptions) {}

  async continueIfBlocked(sessionID: string): Promise<boolean> {
    const client = this.options.client
    if (client === undefined) {
      return false
    }

    const payload = readWorkflowClosurePayload("next", this.options.projectDir)
    const blocker = payload.state.blockers[0]
    if (blocker === undefined) {
      this.sentCounts.delete(sessionID)
      this.lastBlockerIds.delete(sessionID)
      return false
    }

    const currentCount = this.sentCounts.get(sessionID) ?? 0
    if (currentCount >= MAX_CONTINUATIONS_PER_SESSION || this.lastBlockerIds.get(sessionID) === blocker.id) {
      return false
    }

    this.sentCounts.set(sessionID, currentCount + 1)
    this.lastBlockerIds.set(sessionID, blocker.id)
    await client.session.promptAsync({
      path: { id: sessionID },
      query: { directory: this.options.projectDir },
      body: {
        noReply: false,
        parts: [{ type: "text", text: continuationText(blocker) }],
      },
    })
    return true
  }
}
