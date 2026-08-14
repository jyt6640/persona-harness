import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import {
  resolveCompletionDecision,
  type CompletionDecisionInput,
} from "../src/core/completion-decision.js"

const externalPolicyBlocker = {
  code: "trusted-authority-required",
  summary: "A trusted external authority is required before completion can pass.",
} as const

describe("completion decision core", () => {
  it("passes only trusted external authority when external assurance is required", () => {
    const input = {
      authority: { assurance: "external", kind: "trusted" },
      policyBlocker: externalPolicyBlocker,
      requirement: "external",
    } satisfies CompletionDecisionInput

    expect(resolveCompletionDecision(input)).toEqual({
      blockers: [],
      passed: true,
      state: "externally-attested",
    })
  })

  it("blocks local cooperative evidence when external assurance is required", () => {
    const input = {
      authority: { assurance: "cooperative", kind: "trusted" },
      policyBlocker: externalPolicyBlocker,
      requirement: "external",
    } satisfies CompletionDecisionInput

    expect(resolveCompletionDecision(input)).toEqual({
      blockers: [externalPolicyBlocker],
      passed: false,
      state: "blocked",
    })
  })

  it("accepts trusted cooperative evidence only for the cooperative policy", () => {
    const input = {
      authority: { assurance: "cooperative", kind: "trusted" },
      policyBlocker: externalPolicyBlocker,
      requirement: "cooperative",
    } satisfies CompletionDecisionInput

    expect(resolveCompletionDecision(input)).toEqual({
      blockers: [],
      passed: true,
      state: "locally-verified",
    })
  })

  it("preserves an authority blocker instead of allowing untrusted evidence to pass", () => {
    const input = {
      authority: {
        code: "attestation-replayed",
        kind: "blocked",
        summary: "The attestation has already been consumed.",
      },
      policyBlocker: externalPolicyBlocker,
      requirement: "external",
    } satisfies CompletionDecisionInput

    expect(resolveCompletionDecision(input)).toEqual({
      blockers: [{
        code: "attestation-replayed",
        summary: "The attestation has already been consumed.",
      }],
      passed: false,
      state: "blocked",
    })
  })

  it("keeps the core free of CLI, runtime, provider, and executor imports", () => {
    const source = readFileSync(new URL("../src/core/completion-decision.ts", import.meta.url), "utf8")

    expect(source).not.toMatch(/^import\s/m)
  })
})
