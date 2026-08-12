import { describe, expect, it } from "vitest"

import type { Part, UserMessage } from "@opencode-ai/sdk"

import {
  createRuntimeContextSections,
  renderRuntimeContextSections,
  runtimeContextDigest,
} from "../src/runtime/runtime-context.js"
import { hasObservedRuntimeContextToolOutput } from "../src/runtime/messages.js"
import { PendingInjectionStore, MAX_TRACKED_RUNTIME_SESSIONS } from "../src/runtime/store.js"
import type { PendingInjection, TransformMessagesOutput } from "../src/runtime/types.js"

function runtimeSections(profile: readonly string[], skillName?: string) {
  return createRuntimeContextSections({
    profile,
    overlay: {
      metadata: { enabled: false, sources: [], diagnostics: [] },
      summaryLines: [],
    },
    rules: {
      policies: [],
      selectedRuleMetadata: [],
      selectedRules: [],
    },
    skills: skillName === undefined
      ? []
      : [{ name: skillName, domain: "programming", path: `skills/${skillName}`, reason: "test" }],
  })
}

function pendingInjection(targetFile: string, sections: ReturnType<typeof runtimeSections>): PendingInjection {
  return {
    targetFile,
    fileRole: "service",
    selectedHarnessConfigDiagnostics: [],
    selectedRules: [],
    selectedRuleMetadata: [],
    selectedSharedSkills: [],
    selectedPolicyOverlay: { enabled: false, sources: [], diagnostics: [] },
    policies: [],
    block: "legacy block must not be rendered",
    semanticSections: sections,
    contextDigest: runtimeContextDigest(sections),
  }
}

describe("runtime context delivery contract", () => {
  it("renders the payload from ordered semantic sections rather than the legacy block", () => {
    const sections = runtimeSections(["profile line"], "programming")

    const rendered = renderRuntimeContextSections(sections)

    expect(rendered).toContain("[Persona Harness Runtime Context]")
    expect(rendered).toContain("[profile]")
    expect(rendered).toContain("profile line")
    expect(rendered).toContain("[skills]")
    expect(rendered).not.toContain("legacy block must not be rendered")
  })

  it("deduplicates sections while retaining a context that contains a new section", () => {
    const store = new PendingInjectionStore()
    const first = pendingInjection("first", runtimeSections(["shared profile"]))
    const second = pendingInjection("second", runtimeSections(["shared profile"], "new-skill"))

    expect(store.set("section-session", first).kind).toBe("offered")
    expect(store.set("section-session", second).kind).toBe("offered")

    expect(store.take("section-session")?.semanticSections.map((section) => section.kind)).toEqual(["profile"])
    expect(store.take("section-session")?.semanticSections.map((section) => section.kind)).toEqual(["skills"])
    expect(store.set("section-session", second).kind).toBe("duplicate-suppressed")
  })

  it("clears pending and delivery state at session cleanup", () => {
    const store = new PendingInjectionStore()
    const injection = pendingInjection("cleanup", runtimeSections(["profile"]))

    store.set("cleanup-session", injection)
    store.clearSession("cleanup-session")

    expect(store.pendingCount("cleanup-session")).toBe(0)
    expect(store.delivery("cleanup-session", injection.contextDigest)).toBeUndefined()
  })

  it("bounds retained session state", () => {
    const store = new PendingInjectionStore()
    const injection = pendingInjection("bounded", runtimeSections(["profile"]))

    for (let index = 0; index <= MAX_TRACKED_RUNTIME_SESSIONS; index += 1) {
      store.set(`session-${index}`, injection)
    }

    expect(store.delivery("session-0", injection.contextDigest)).toBeUndefined()
    expect(store.delivery(`session-${MAX_TRACKED_RUNTIME_SESSIONS}`, injection.contextDigest)).toBeDefined()
  })
})

function modelInput(sessionID: string): TransformMessagesOutput {
  const message: UserMessage = {
    id: "user-message",
    sessionID,
    role: "user",
    time: { created: Date.now() },
    agent: "build",
    model: { providerID: "test", modelID: "test" },
  }
  const textPart: Part = {
    id: "user-text",
    sessionID,
    messageID: message.id,
    type: "text",
    text: "계속 구현해줘.",
  }
  return { messages: [{ info: message, parts: [textPart] }] }
}

function withToolDeliveryMarker(output: TransformMessagesOutput, marker: unknown): void {
  const message = output.messages[0]
  if (message === undefined) {
    throw new Error("expected a user message")
  }
  message.parts.unshift({
    id: "tool-part",
    sessionID: message.info.sessionID,
    messageID: message.info.id,
    type: "tool",
    callID: "after-call",
    tool: "read",
    state: {
      status: "completed",
      output: "tool result",
      metadata: { personaHarnessRuntimeContext: marker },
    },
  } as unknown as Part)
}

describe("PH-owned tool delivery observation", () => {
  it("requires the PH marker in the message collection before suppressing model fallback", () => {
    const injection = pendingInjection("message-observed", runtimeSections(["profile"]))
    const output = modelInput("message-session")

    withToolDeliveryMarker(output, {
      schemaVersion: "runtime-context-tool-delivery.1",
      digest: injection.contextDigest,
      sectionDigests: injection.semanticSections.map((section) => section.digest),
    })

    expect(hasObservedRuntimeContextToolOutput(output, "message-session", injection)).toBe(true)
    expect(hasObservedRuntimeContextToolOutput(modelInput("message-session"), "message-session", injection)).toBe(false)
  })
})
