import { describe, expect, it } from "vitest"

import {
  evaluateOpenCodeInterviewObservation,
  OPENCODE_INTERVIEW_OBSERVATION_SCHEMA_VERSION,
} from "../scripts/opencode-interview-observation-contract.mjs"

const sessionID = "session-observation"

function userMessage(text: string) {
  return {
    type: "message.updated",
    properties: { info: { id: "user-message", sessionID, role: "user" } },
  }
}

function assistantMessage() {
  return {
    type: "message.updated",
    properties: { info: { id: "assistant-message", sessionID, role: "assistant" } },
  }
}

function assistantText(text: string) {
  return {
    type: "message.part.updated",
    properties: {
      part: {
        id: "assistant-text",
        sessionID,
        messageID: "assistant-message",
        type: "text",
        text,
      },
    },
  }
}

function observation(events: readonly unknown[]) {
  return {
    schemaVersion: OPENCODE_INTERVIEW_OBSERVATION_SCHEMA_VERSION,
    events,
  }
}

describe("OpenCode interview observation contract", () => {
  it("does not treat transformed user input as a post-model response", () => {
    const result = evaluateOpenCodeInterviewObservation(observation([
      userMessage("Required first response: ask exactly one product question now, then wait."),
      {
        type: "message.part.updated",
        properties: {
          part: {
            id: "user-text",
            sessionID,
            messageID: "user-message",
            type: "text",
            text: "Which people should this product help first?",
          },
        },
      },
    ]))

    expect(result).toMatchObject({
      status: "blocked",
      ambiguousInterviewFirst: false,
      responsePredicatePostModel: false,
      code: "assistant-response-missing",
    })
    expect(JSON.stringify(result)).not.toContain("Which people")
  })

  it("accepts one actual assistant question with no pre-approval mutation", () => {
    const result = evaluateOpenCodeInterviewObservation(observation([
      userMessage("Create an app for neighbours to exchange practical skills"),
      assistantMessage(),
      assistantText("Which people should this product help first?"),
    ]))

    expect(result).toEqual({
      schemaVersion: OPENCODE_INTERVIEW_OBSERVATION_SCHEMA_VERSION,
      status: "passed",
      code: "ready",
      ambiguousInterviewFirst: true,
      responsePredicatePostModel: true,
      preApprovalNoMutation: true,
    })
  })

  it("rejects a message identity that drifts from user to assistant", () => {
    const result = evaluateOpenCodeInterviewObservation(observation([
      {
        type: "message.updated",
        properties: { info: { id: "drifting-message", sessionID, role: "user" } },
      },
      {
        type: "message.updated",
        properties: { info: { id: "drifting-message", sessionID, role: "assistant" } },
      },
      {
        type: "message.part.updated",
        properties: {
          part: {
            id: "drifting-text",
            sessionID,
            messageID: "drifting-message",
            type: "text",
            text: "Which people should this product help first?",
          },
        },
      },
    ]))

    expect(result).toMatchObject({
      status: "blocked",
      code: "message-identity-conflict",
      ambiguousInterviewFirst: false,
      responsePredicatePostModel: false,
    })
    expect(JSON.stringify(result)).not.toContain("drifting-message")
  })

  it("rejects a part identity reused to promote linked user text", () => {
    const result = evaluateOpenCodeInterviewObservation(observation([
      userMessage("Create an app for neighbours to exchange practical skills"),
      {
        type: "message.part.updated",
        properties: {
          part: {
            id: "shared-text-part",
            sessionID,
            messageID: "user-message",
            type: "text",
            text: "Which people should this product help first?",
          },
        },
      },
      assistantMessage(),
      {
        type: "message.part.updated",
        properties: {
          part: {
            id: "shared-text-part",
            sessionID,
            messageID: "assistant-message",
            type: "text",
            text: "Which people should this product help first?",
          },
        },
      },
    ]))

    expect(result).toMatchObject({
      status: "blocked",
      code: "part-identity-conflict",
      ambiguousInterviewFirst: false,
      responsePredicatePostModel: false,
    })
    expect(JSON.stringify(result)).not.toContain("shared-text-part")
  })

  it("allows repeated updates for the same assistant message and part identities", () => {
    const result = evaluateOpenCodeInterviewObservation(observation([
      assistantMessage(),
      assistantMessage(),
      assistantText("Which people should this product help first?"),
      assistantText("Which people should this product help first?"),
    ]))

    expect(result).toMatchObject({
      status: "passed",
      code: "ready",
      ambiguousInterviewFirst: true,
      responsePredicatePostModel: true,
    })
  })

  it("rejects a part identity that changes type across updates", () => {
    const result = evaluateOpenCodeInterviewObservation(observation([
      assistantMessage(),
      {
        type: "message.part.updated",
        properties: {
          part: {
            id: "changing-part",
            sessionID,
            messageID: "assistant-message",
            type: "text",
            text: "Which people should this product help first?",
          },
        },
      },
      {
        type: "message.part.updated",
        properties: {
          part: {
            id: "changing-part",
            sessionID,
            messageID: "assistant-message",
            type: "patch",
          },
        },
      },
    ]))

    expect(result).toMatchObject({
      status: "blocked",
      code: "part-identity-conflict",
      ambiguousInterviewFirst: false,
      responsePredicatePostModel: false,
    })
    expect(JSON.stringify(result)).not.toContain("changing-part")
  })

  it("tombstones a removed part and rejects update-after-remove reuse", () => {
    const result = evaluateOpenCodeInterviewObservation(observation([
      assistantMessage(),
      assistantText("Which people should this product help first?"),
      {
        type: "message.part.removed",
        properties: {
          sessionID,
          messageID: "assistant-message",
          partID: "assistant-text",
        },
      },
      assistantText("Which people should this product help first?"),
    ]))

    expect(result).toMatchObject({
      status: "blocked",
      code: "part-lifecycle-invalid",
      ambiguousInterviewFirst: false,
      responsePredicatePostModel: false,
    })
    expect(JSON.stringify(result)).not.toContain("assistant-text")
  })

  it("rejects removal of an unknown or already removed part", () => {
    const unknown = evaluateOpenCodeInterviewObservation(observation([
      assistantMessage(),
      {
        type: "message.part.removed",
        properties: {
          sessionID,
          messageID: "assistant-message",
          partID: "unknown-part",
        },
      },
    ]))
    expect(unknown).toMatchObject({ status: "blocked", code: "part-lifecycle-invalid" })

    const repeated = evaluateOpenCodeInterviewObservation(observation([
      assistantMessage(),
      assistantText("Which people should this product help first?"),
      {
        type: "message.part.removed",
        properties: { sessionID, messageID: "assistant-message", partID: "assistant-text" },
      },
      {
        type: "message.part.removed",
        properties: { sessionID, messageID: "assistant-message", partID: "assistant-text" },
      },
    ]))
    expect(repeated).toMatchObject({ status: "blocked", code: "part-lifecycle-invalid" })
  })

  it("rejects a part removal with a conflicting parent message identity", () => {
    const result = evaluateOpenCodeInterviewObservation(observation([
      assistantMessage(),
      assistantText("Which people should this product help first?"),
      {
        type: "message.part.removed",
        properties: {
          sessionID,
          messageID: "different-message",
          partID: "assistant-text",
        },
      },
    ]))

    expect(result).toMatchObject({
      status: "blocked",
      code: "part-identity-conflict",
      ambiguousInterviewFirst: false,
      responsePredicatePostModel: false,
    })
  })

  it("rejects message updates after a message removal", () => {
    const result = evaluateOpenCodeInterviewObservation(observation([
      assistantMessage(),
      {
        type: "message.removed",
        properties: { sessionID, messageID: "assistant-message" },
      },
      assistantMessage(),
    ]))

    expect(result).toMatchObject({
      status: "blocked",
      code: "message-lifecycle-invalid",
      ambiguousInterviewFirst: false,
      responsePredicatePostModel: false,
    })

    const childAfterRemoval = evaluateOpenCodeInterviewObservation(observation([
      userMessage("Create an app for neighbours to exchange practical skills"),
      {
        type: "message.removed",
        properties: { sessionID, messageID: "user-message" },
      },
      {
        type: "message.part.updated",
        properties: {
          part: {
            id: "late-user-text",
            sessionID,
            messageID: "user-message",
            type: "text",
            text: "Which people should this product help first?",
          },
        },
      },
    ]))
    expect(childAfterRemoval).toMatchObject({ status: "blocked", code: "part-lifecycle-invalid" })

    const unknownMessageRemoval = evaluateOpenCodeInterviewObservation(observation([
      {
        type: "message.removed",
        properties: { sessionID, messageID: "unknown-message" },
      },
    ]))
    expect(unknownMessageRemoval).toMatchObject({ status: "blocked", code: "message-lifecycle-invalid" })
  })

  it("allows a known user part to transition once to removed", () => {
    const result = evaluateOpenCodeInterviewObservation(observation([
      userMessage("Create an app for neighbours to exchange practical skills"),
      {
        type: "message.part.updated",
        properties: {
          part: {
            id: "user-text",
            sessionID,
            messageID: "user-message",
            type: "text",
            text: "The user request is not an assistant response.",
          },
        },
      },
      {
        type: "message.part.removed",
        properties: { sessionID, messageID: "user-message", partID: "user-text" },
      },
      assistantMessage(),
      assistantText("Which people should this product help first?"),
    ]))

    expect(result).toMatchObject({
      status: "passed",
      code: "ready",
      ambiguousInterviewFirst: true,
      responsePredicatePostModel: true,
    })
  })

  it("fails closed for missing nested message and part payloads", () => {
    const missingMessageInfo = evaluateOpenCodeInterviewObservation(observation([
      { type: "message.updated", properties: {} },
    ]))
    expect(missingMessageInfo).toMatchObject({ status: "blocked", code: "observation-schema-invalid" })

    const missingPart = evaluateOpenCodeInterviewObservation(observation([
      assistantMessage(),
      { type: "message.part.updated", properties: {} },
    ]))
    expect(missingPart).toMatchObject({ status: "blocked", code: "observation-schema-invalid" })
  })

  it.each([
    ["solution", "I recommend a service architecture for this product?", "assistant-response-solution-content"],
    ["plan", "Here is the plan: first define the database, then build the API?", "assistant-response-plan-content"],
    ["command", "Run `npm install` and then execute the migration command?", "assistant-response-command-content"],
    ["file-change", "I will edit src/App.tsx to add the new screen?", "assistant-response-file-change-content"],
  ])("blocks assistant %s content even when it contains a question mark", (_kind, text, expectedCode) => {
    const result = evaluateOpenCodeInterviewObservation(observation([
      assistantMessage(),
      assistantText(text),
    ]))

    expect(result.status).toBe("blocked")
    expect(result.responsePredicatePostModel).toBe(false)
    expect(result.ambiguousInterviewFirst).toBe(false)
    expect(result.code).toBe(expectedCode)
  })

  it("blocks a pre-approval tool event without reflecting its raw fields", () => {
    const result = evaluateOpenCodeInterviewObservation(observation([
      assistantMessage(),
      {
        type: "tool.execute.before",
        properties: {
          sessionID,
          callID: "secret-call-id",
          tool: "edit",
          args: { filePath: "/private/project/src/App.tsx" },
        },
      },
      assistantText("Which people should this product help first?"),
    ]))

    expect(result).toMatchObject({
      status: "blocked",
      code: "pre-approval-mutation",
      preApprovalNoMutation: false,
      ambiguousInterviewFirst: false,
    })
    expect(JSON.stringify(result)).not.toContain("secret-call-id")
    expect(JSON.stringify(result)).not.toContain("/private/project")
  })

  it("treats an assistant patch part as a pre-approval mutation", () => {
    const result = evaluateOpenCodeInterviewObservation(observation([
      assistantMessage(),
      {
        type: "message.part.updated",
        properties: {
          part: {
            id: "assistant-patch",
            sessionID,
            messageID: "assistant-message",
            type: "patch",
            hash: "private-hash",
            files: ["src/App.tsx"],
          },
        },
      },
    ]))

    expect(result).toMatchObject({
      status: "blocked",
      code: "pre-approval-mutation",
      preApprovalNoMutation: false,
    })
    expect(JSON.stringify(result)).not.toContain("private-hash")
    expect(JSON.stringify(result)).not.toContain("src/App.tsx")
  })

  it("rejects an assistant part that has no preceding assistant message", () => {
    const result = evaluateOpenCodeInterviewObservation(observation([
      assistantText("Which people should this product help first?"),
    ]))

    expect(result).toMatchObject({
      status: "blocked",
      code: "assistant-response-order-invalid",
    })
  })

  it("rejects a foreign-session assistant part and a second assistant response", () => {
    const foreignPart = evaluateOpenCodeInterviewObservation(observation([
      assistantMessage(),
      {
        type: "message.part.updated",
        properties: {
          part: {
            id: "foreign-text",
            sessionID: "foreign-session",
            messageID: "assistant-message",
            type: "text",
            text: "Which people should this product help first?",
          },
        },
      },
    ]))
    expect(foreignPart).toMatchObject({ status: "blocked", code: "foreign-event" })

    const secondAssistant = evaluateOpenCodeInterviewObservation(observation([
      assistantMessage(),
      assistantText("Which people should this product help first?"),
      {
        type: "message.updated",
        properties: { info: { id: "second-assistant", sessionID, role: "assistant" } },
      },
    ]))
    expect(secondAssistant).toMatchObject({ status: "blocked", code: "multiple-assistant-responses" })
  })

  it("allows mutation only after the real permission reply approval event", () => {
    const result = evaluateOpenCodeInterviewObservation(observation([
      assistantMessage(),
      assistantText("Which people should this product help first?"),
      {
        type: "permission.replied",
        properties: { sessionID, permissionID: "permission-1", response: "once" },
      },
      {
        type: "tool.execute.before",
        properties: { sessionID, callID: "call-after-approval", tool: "edit" },
      },
    ]))

    expect(result).toMatchObject({
      status: "passed",
      code: "ready",
      ambiguousInterviewFirst: true,
      preApprovalNoMutation: true,
    })
  })

  it("uses the assistant response when transformed input is also present", () => {
    const result = evaluateOpenCodeInterviewObservation(observation([
      userMessage("[Persona Harness Product Interview] Question: Which users?"),
      assistantMessage(),
      assistantText("Which people should this product help first?"),
    ]))

    expect(result).toMatchObject({
      status: "passed",
      ambiguousInterviewFirst: true,
      responsePredicatePostModel: true,
    })
  })
})
