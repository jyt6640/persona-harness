import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { parseFinishAttestationStatement } from "../src/cli/workflow-finish-attestation.js"

const bundlePath = join(process.cwd(), "tests", "fixtures", "finish-attestation", "protected-main-29511625395.bundle.json")

describe("finish-attestation.1 statement parser", () => {
  it("parses the independently downloaded protected-main statement without granting authority", () => {
    const statement = realStatement()
    const result = parseFinishAttestationStatement(statement)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.predicate.receipt.repository).toBe("jyt6640/persona-harness")
      expect(result.value.predicate.receipt.source.head).toBe("84901174235f0a9c7bc08f0dbd5be6d94c02d500")
      expect(result.value.predicate.receipt.test).toEqual({
        artifactDigest: "sha256:15916a7027b02cb5934c16e3dd6d7a07ea26b28a321874f47c733f23cfc877ee",
        count: 1227,
        failed: 0,
        identity: "vitest:repository",
        passed: 1221,
        skipped: 6,
      })
    }
  })

  it.each([
    ["event", (statement: Record<string, unknown>) => updateReceipt(statement, { event: "workflow_dispatch" })],
    ["repository", (statement: Record<string, unknown>) => updateReceipt(statement, { repository: "attacker/repo" })],
    ["ref", (statement: Record<string, unknown>) => updateReceipt(statement, { ref: "refs/heads/feature" })],
    ["runner", (statement: Record<string, unknown>) => updateReceipt(statement, { runner: { environment: "self-hosted", label: "custom", os: "Linux" } })],
    ["zero tests", (statement: Record<string, unknown>) => updateReceipt(statement, { test: { count: 0, failed: 0, passed: 0, skipped: 0 } })],
    ["test identity", (statement: Record<string, unknown>) => updateReceipt(statement, { test: { artifactDigest: "sha256:" + "0".repeat(64), count: 1, failed: 0, identity: "local", passed: 1, skipped: 0 } })],
    ["command result id", (statement: Record<string, unknown>) => updateFirstCommandResult(statement, { id: "other-command" })],
  ])("rejects a mutated %s policy claim", (_name, mutate) => {
    const result = parseFinishAttestationStatement(mutate(realStatement()))

    expect(result.ok).toBe(false)
  })

  it("rejects a subject digest that no longer binds the signed receipt bytes", () => {
    const statement = realStatement()
    const subject = readArray(statement.subject)
    const first = readRecord(subject[0])
    const digest = readRecord(first.digest)
    digest.sha256 = "0".repeat(64)

    expect(parseFinishAttestationStatement(statement).ok).toBe(false)
  })
})

function realStatement(): Record<string, unknown> {
  const bundle = JSON.parse(readFileSync(bundlePath, "utf8")) as Record<string, unknown>
  const envelope = readRecord(bundle.dsseEnvelope)
  const payload = envelope.payload
  if (typeof payload !== "string") throw new Error("real bundle payload is unavailable")
  return JSON.parse(Buffer.from(payload, "base64").toString("utf8")) as Record<string, unknown>
}

function updateReceipt(statement: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const predicate = readRecord(statement.predicate)
  return { ...statement, predicate: { ...predicate, receipt: { ...readRecord(predicate.receipt), ...patch } } }
}

function updateFirstCommandResult(statement: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const predicate = readRecord(statement.predicate)
  const receipt = readRecord(predicate.receipt)
  const command = readRecord(receipt.command)
  const results = [...readArray(command.results)]
  results[0] = { ...readRecord(results[0]), ...patch }
  return updateReceipt(statement, { command: { ...command, results } })
}

function readRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new TypeError("expected record")
  return value as Record<string, unknown>
}

function readArray(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) throw new TypeError("expected array")
  return value
}
