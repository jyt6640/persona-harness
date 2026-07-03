import { readWorkflowClosurePayload } from "../cli/workflow-closure.js"
import { createContinuationPromptText } from "../cli/continuation-prompt.js"
import { ContinuationUtteranceGate } from "./continuation-utterance-gate.js"

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

export class IdleContinuationTracker {
  private readonly utteranceGate = new ContinuationUtteranceGate()

  constructor(private readonly options: IdleContinuationOptions) {}

  async continueIfBlocked(sessionID: string): Promise<boolean> {
    const client = this.options.client
    if (client === undefined) {
      return false
    }

    const payload = readWorkflowClosurePayload("next", this.options.projectDir)
    const blocker = payload.state.blockers[0]
    if (blocker === undefined) {
      this.utteranceGate.reset(sessionID)
      return false
    }

    const decision = this.utteranceGate.tryBegin({
      blockerId: blocker.id,
      maxAttempts: MAX_CONTINUATIONS_PER_SESSION,
      sessionId: sessionID,
    })
    if (decision.kind === "blocked") {
      return false
    }

    try {
      await client.session.promptAsync({
        path: { id: sessionID },
        query: { directory: this.options.projectDir },
        body: {
          noReply: false,
          parts: [
            {
              type: "text",
              text: createContinuationPromptText({ blocker, context: "idle", step: payload.action === "next" ? payload.nextStep : null }),
            },
          ],
        },
      })
      return true
    } finally {
      decision.complete()
    }
  }
}
