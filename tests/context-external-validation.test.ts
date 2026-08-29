import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

import {
  CONTEXT_EXTERNAL_VALIDATION_INITIAL_STATUS,
  CONTEXT_EXTERNAL_VALIDATION_RESULT_SCHEMA,
  evaluateContextExternalValidationStatus,
} from "../src/context-external-validation/index.js"

describe("Context external-validation status", () => {
  it("keeps the committed empty status explicitly inconclusive", () => {
    const committed = JSON.parse(readFileSync(resolve(process.cwd(), "docs/current/context-external-validation-status.json"), "utf8"))

    expect(committed).toEqual(CONTEXT_EXTERNAL_VALIDATION_INITIAL_STATUS)
    expect(evaluateContextExternalValidationStatus(committed)).toEqual(readyResult({
      acceptedStartCount: 0,
      independentStartCount: 0,
      observationCount: 0,
      phase: "not-started",
      productVerdict: "INCONCLUSIVE",
    }))
  })

  it("requires a frozen protocol before preregistration or observation can begin", () => {
    expect(evaluateContextExternalValidationStatus({
      observations: [],
      productVerdict: "INCONCLUSIVE",
      protocol: null,
      schemaVersion: "persona-context-external-validation-status.1",
      status: "preregistered",
    })).toEqual(blocked("context-external-validation-status-invalid"))
  })

  it("keeps partial observations inconclusive until the denominator is complete", () => {
    const completed = completedStatus()
    const observing = {
      ...completed,
      observations: completed.observations.slice(0, 1),
      productVerdict: "INCONCLUSIVE",
      status: "observing",
    }

    expect(evaluateContextExternalValidationStatus(observing)).toEqual(readyResult({
      acceptedStartCount: 1,
      independentStartCount: 1,
      observationCount: 1,
      phase: "observing",
      productVerdict: "INCONCLUSIVE",
    }))
  })

  it("keeps every enrolled participant in the completed denominator", () => {
    const status = completedStatus()

    expect(evaluateContextExternalValidationStatus({ ...status, observations: status.observations.slice(0, 2) })).toEqual(
      blocked("context-external-validation-status-invalid"),
    )
  })

  it("fails closed for privacy-unsafe, hidden, or mismatched records", () => {
    const unsafeParticipant = preregisteredStatus()
    unsafeParticipant.protocol.cohort[0] = { id: "alice@example.com", relationship: "independent" }
    expect(evaluateContextExternalValidationStatus(unsafeParticipant)).toEqual(blocked("context-external-validation-status-invalid"))

    const candidateMismatch = completedStatus()
    candidateMismatch.observations[0] = {
      ...candidateMismatch.observations[0],
      candidate: { ...candidateMismatch.protocol.candidate, commit: "ffffffffffffffffffffffffffffffffffffffff" },
    }
    expect(evaluateContextExternalValidationStatus(candidateMismatch)).toEqual(blocked("context-external-validation-status-invalid"))

    const hiddenIntervention = completedStatus()
    hiddenIntervention.observations[0] = { ...hiddenIntervention.observations[0], intervention: "maintainer-operated" }
    expect(evaluateContextExternalValidationStatus(hiddenIntervention)).toEqual(blocked("context-external-validation-status-invalid"))

    const rawProtocolField = preregisteredStatus()
    expect(evaluateContextExternalValidationStatus({
      ...rawProtocolField,
      protocol: { ...rawProtocolField.protocol, rawPrompt: "unbounded content is not a protocol metric" },
    })).toEqual(blocked("context-external-validation-status-invalid"))
  })

  it("derives a verdict only from a complete bounded cohort", () => {
    const go = completedStatus()
    expect(evaluateContextExternalValidationStatus(go)).toEqual(readyResult({
      acceptedStartCount: 3,
      independentStartCount: 3,
      observationCount: 3,
      phase: "completed",
      productVerdict: "PRODUCT_GO",
    }))

    const noGo = completedStatus()
    noGo.observations[1] = { ...noGo.observations[1], correctionReduced: false, policySurvived: false }
    noGo.observations[2] = { ...noGo.observations[2], correctionReduced: false, policySurvived: false }
    noGo.productVerdict = "PRODUCT_NO_GO"
    expect(evaluateContextExternalValidationStatus(noGo)).toMatchObject({ productVerdict: "PRODUCT_NO_GO", status: "ready" })

    const mismatchedClaim = completedStatus()
    mismatchedClaim.observations[1] = { ...mismatchedClaim.observations[1], correctionReduced: false, policySurvived: false }
    mismatchedClaim.observations[2] = { ...mismatchedClaim.observations[2], correctionReduced: false, policySurvived: false }
    expect(evaluateContextExternalValidationStatus(mismatchedClaim)).toEqual(blocked("context-external-validation-verdict-mismatch"))
  })

  it("keeps the parser and evaluator free of host, workflow, authority, and process imports", () => {
    const sourceFiles = [
      "src/context-external-validation/context-external-validation-parser.ts",
      "src/context-external-validation/context-external-validation.ts",
    ]
    const source = sourceFiles.map((file) => readFileSync(resolve(process.cwd(), file), "utf8")).join("\n")
    const importPaths = [...source.matchAll(/from\s+["']([^"']+)["']/gu)].map((match) => match[1] ?? "")

    for (const rejected of ["../cli", "../runtime", "authority", "child_process", "github", "network", "workflow"]) {
      expect(importPaths.every((path) => !path.includes(rejected))).toBe(true)
    }
  })
})

function blocked(code: "context-external-validation-status-invalid" | "context-external-validation-verdict-mismatch") {
  return {
    code,
    schemaVersion: CONTEXT_EXTERNAL_VALIDATION_RESULT_SCHEMA,
    status: "blocked",
  }
}

function readyResult(input: {
  acceptedStartCount: number
  independentStartCount: number
  observationCount: number
  phase: "not-started" | "observing" | "completed"
  productVerdict: "INCONCLUSIVE" | "PRODUCT_GO"
}) {
  return {
    ...input,
    schemaVersion: CONTEXT_EXTERNAL_VALIDATION_RESULT_SCHEMA,
    status: "ready",
  }
}

function preregisteredStatus() {
  return {
    observations: [],
    productVerdict: "INCONCLUSIVE",
    protocol: protocol(),
    schemaVersion: "persona-context-external-validation-status.1",
    status: "preregistered",
  }
}

function completedStatus() {
  const protocolValue = protocol()
  return {
    observations: protocolValue.cohort.map((participant, index) => observation(participant.id, index, protocolValue)),
    productVerdict: "PRODUCT_GO",
    protocol: protocolValue,
    schemaVersion: "persona-context-external-validation-status.1",
    status: "completed",
  }
}

function protocol() {
  return {
    candidate: {
      commit: "9e8dcc3e72fab52dcb71c12c1a45cd3846929be8",
      packageVersion: "0.8.36",
      tarSha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    },
    cohort: [
      { id: "P-01", relationship: "independent" },
      { id: "P-02", relationship: "independent" },
      { id: "P-03", relationship: "independent" },
    ],
    interventionPolicy: "none",
    maximumMinutesPerStart: 30,
    schemaVersion: "persona-context-external-validation-protocol.1",
    taskDigest: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
    tokenReference: "same-task-context-off",
  }
}

function observation(
  participantId: string,
  index: number,
  protocolValue: ReturnType<typeof protocol>,
) {
  return {
    candidate: protocolValue.candidate,
    conflictResolution: "accurate",
    contradictionIncreased: false,
    correctionReduced: index < 2,
    durationMinutes: 20,
    intervention: "none",
    overreachIncreased: false,
    outcome: "completed",
    participantId,
    policySurvived: index === 2,
    startState: "accepted-start",
    taskDigest: protocolValue.taskDigest,
    taskRegressed: false,
    tokenOverheadPermille: 1_100,
  }
}
