import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

const PROJECT_DIR = process.argv[2] === undefined ? process.cwd() : resolve(process.argv[2])
const STATUS_PATH = "docs/injection-value-status.json"
const DECISIONS = new Set(["open", "continue-java-mvp", "freeze-expansion", "inconclusive"])

function parseNonNegativeInteger(value, fieldName) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid ${fieldName}: expected non-negative integer`)
  }
  return value
}

function parseStatus(source) {
  const parsed = JSON.parse(source)
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid injection value status: expected object")
  }

  const status = {
    requiredPairs: parseNonNegativeInteger(parsed.requiredPairs, "requiredPairs"),
    currentPairs: parseNonNegativeInteger(parsed.currentPairs, "currentPairs"),
    onPositive: parseNonNegativeInteger(parsed.onPositive, "onPositive"),
    neutralOrMixed: parseNonNegativeInteger(parsed.neutralOrMixed, "neutralOrMixed"),
    offPositive: parseNonNegativeInteger(parsed.offPositive, "offPositive"),
    decision: typeof parsed.decision === "string" ? parsed.decision : "",
  }

  if (status.requiredPairs < 1) {
    throw new Error("Invalid requiredPairs: expected at least 1")
  }
  if (!DECISIONS.has(status.decision)) {
    throw new Error(`Invalid decision: ${status.decision || "(empty)"}`)
  }

  return status
}

function expectedDecision(status) {
  if (status.currentPairs < status.requiredPairs) {
    return "open"
  }
  if (status.onPositive >= 2) {
    return "continue-java-mvp"
  }
  if (status.neutralOrMixed + status.offPositive >= 2) {
    return "freeze-expansion"
  }
  return "inconclusive"
}

async function main() {
  const source = await readFile(resolve(PROJECT_DIR, STATUS_PATH), "utf8")
  const status = parseStatus(source)
  const diagnostics = []
  const countedPairs = status.onPositive + status.neutralOrMixed + status.offPositive
  const decision = expectedDecision(status)

  if (countedPairs !== status.currentPairs) {
    diagnostics.push(`WARN: currentPairs is ${status.currentPairs}, but classified pairs sum to ${countedPairs}.`)
  }
  if (status.currentPairs > status.requiredPairs) {
    diagnostics.push(`WARN: currentPairs ${status.currentPairs} exceeds requiredPairs ${status.requiredPairs}.`)
  }
  if (status.decision !== decision) {
    diagnostics.push(`WARN: decision is ${status.decision}, expected ${decision}.`)
  }

  const finding = diagnostics.length > 0 ? "WARN" : "PASS"
  console.log(`Injection value diagnostics finding: ${finding}`)
  console.log(`Injection value diagnostics count: ${diagnostics.length}`)
  console.log(`Injection value current window: ${status.currentPairs}/${status.requiredPairs}`)
  console.log(`Injection value expected decision: ${decision}`)
  if (diagnostics.length > 0) {
    console.log("")
    for (const diagnostic of diagnostics) {
      console.log(`- ${diagnostic}`)
    }
  }
  console.log("")
  console.log("This is a decision-state check. It does not certify product quality.")
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
