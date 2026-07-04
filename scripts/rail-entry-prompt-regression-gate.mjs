#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const GATE = "rail-entry-prompt-regression"
const PLAN_SCHEMA = "rail-entry-prompt-regression-plan.1"
const SUMMARY_SCHEMA = "rail-entry-prompt-regression-summary.1"
const ARCHIVE_ROOT = "/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs"
const STAGE9_ARCHIVE = `${ARCHIVE_ROOT}/stage9-banner-only-rail-entry-ab-10-20260703T053234Z`
const MINIMUM_PAIRS = 5
const MINIMUM_DELTA_PERCENTAGE_POINTS = 0

function usage() {
  return [
    "Usage:",
    "  node scripts/rail-entry-prompt-regression-gate.mjs init --archive <dir> [--scenario <id>]",
    "  node scripts/rail-entry-prompt-regression-gate.mjs check --archive <dir>",
    "",
    "This prepares or checks an operator-run rail-entry wording regression gate.",
    "It does not run OpenCode and does not create product-efficacy, token, app-quality, or default-change evidence.",
  ].join("\n")
}

function optionValue(args, name) {
  const index = args.indexOf(name)
  if (index === -1) {
    return undefined
  }
  const value = args[index + 1]
  return value === undefined || value.startsWith("--") ? undefined : value
}

function requireOption(args, name) {
  const value = optionValue(args, name)
  if (value === undefined) {
    throw new Error(`${name} is required`)
  }
  return value
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"))
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function createPlan(archiveDir, scenario) {
  return {
    schema: PLAN_SCHEMA,
    createdAt: new Date().toISOString(),
    gate: GATE,
    scenario,
    archiveRoot: ARCHIVE_ROOT,
    stage9Reference: {
      archive: STAGE9_ARCHIVE,
      h1Judgment: "not-supported-for-this-fixture",
      offRailEntry: "10/10",
      onRailEntry: "10/10",
      pairedDeltaPercentagePoints: 0,
      lesson: "With PH installed and bootstrap artifacts present in both conditions, runtimeInjection ON did not improve rail entry in Stage 9. This gate checks wording non-inferiority only.",
    },
    conditions: {
      current: "current/control wording fixture",
      candidate: "candidate wording fixture",
    },
    criteria: {
      minimumPairs: MINIMUM_PAIRS,
      minimumDeltaPercentagePoints: MINIMUM_DELTA_PERCENTAGE_POINTS,
      invalidRunPolicy: "invalidRunCount must be 0 for PASS; otherwise FAIL/PARTIAL and rerun or explain",
      primaryOutcome: "rail-entry-non-inferiority",
    },
    matchingRequirements: [
      "README sha256 matches within each pair",
      "TASK sha256 matches within each pair",
      "start commit matches within each pair",
      "same prompt family and no explicit rail mention unless preregistered",
    ],
    expectedFiles: [
      "measurement-plan.json",
      "KILL_CRITERIA.md",
      "summary.json",
      "RESULT.md",
      "raw OpenCode logs when real runs are executed",
    ],
    outputContract: {
      summarySchema: SUMMARY_SCHEMA,
      summaryPath: `${archiveDir}/summary.json`,
    },
    boundaries: [
      "operator-run gate; normal tests do not run OpenCode",
      "rail-entry non-inferiority only",
      "not product efficacy, token-saving, app-quality, reliability, or default-change evidence",
      "no evidence schema expansion",
    ],
  }
}

function killCriteriaText() {
  return `# Rail-Entry Prompt Regression Gate Criteria

Status: preregister before running real OpenCode sessions.

Purpose: rail-entry wording regression/non-inferiority only.

Minimum design:

- n >= ${MINIMUM_PAIRS} paired rows.
- Conditions: current/control wording vs candidate wording.
- Pair matching: README sha256, TASK sha256, and start commit must match inside each pair.
- Invalid run count must be 0 for PASS. If invalid runs occur, rerun or record FAIL/PARTIAL with exact invalid accounting.
- Primary outcome: rail entry within first 10 tool calls.
- PASS criterion: candidate rail-entry rate is non-inferior to current/control; default threshold is candidate-current >= ${MINIMUM_DELTA_PERCENTAGE_POINTS} percentage points.

Boundaries:

- This is not product efficacy, token-saving, app-quality, broad reliability, closure guarantee, or default-change evidence.
- Telemetry, if collected, is snapshot-only unless a separate preregistered measurement says otherwise.
- Do not use this gate to claim runtimeInjection benefit; Stage 9 banner-only H1 was OFF 10/10 and ON 10/10, not-supported-for-this-fixture.
`
}

function summaryTemplate(archiveDir) {
  return {
    schema: SUMMARY_SCHEMA,
    archive: archiveDir,
    gate: GATE,
    validity: {
      finalAcceptedValidPairs: 0,
      invalidRunCount: 0,
      invalidRuns: [],
    },
    railEntry: {
      candidate: 0,
      current: 0,
      deltaPercentagePoints: 0,
      nonInferiorityCriterionMet: false,
      pairedCounts: {
        both: 0,
        candidateOnly: 0,
        comparable: 0,
        currentOnly: 0,
        neither: 0,
      },
      totalPairs: 0,
    },
    pairRows: [],
    boundaries: [
      "rail-entry non-inferiority only",
      "no product/token/app-quality/reliability/default-change claim",
    ],
  }
}

function init(args) {
  const archiveDir = resolve(requireOption(args, "--archive"))
  const scenario = optionValue(args, "--scenario") ?? "rail-entry-wording-regression"
  mkdirSync(archiveDir, { recursive: true })
  writeJson(`${archiveDir}/measurement-plan.json`, createPlan(archiveDir, scenario))
  writeFileSync(`${archiveDir}/KILL_CRITERIA.md`, killCriteriaText())
  writeJson(`${archiveDir}/summary-template.json`, summaryTemplate(archiveDir))
  console.log(`Rail-entry prompt regression gate initialized: ${archiveDir}`)
  console.log(`Minimum pairs: ${MINIMUM_PAIRS}`)
  console.log("Primary outcome: rail-entry non-inferiority only")
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function numericField(record, name) {
  const value = record[name]
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function booleanField(record, name) {
  const value = record[name]
  return typeof value === "boolean" ? value : undefined
}

function validatePairRows(summary, diagnostics) {
  if (!Array.isArray(summary.pairRows)) {
    diagnostics.push("pairRows must be an array")
    return
  }
  for (const row of summary.pairRows) {
    if (!isRecord(row)) {
      diagnostics.push("each pairRows entry must be an object")
      continue
    }
    if (booleanField(row, "readmeSha256Matched") !== true) {
      diagnostics.push(`pair ${row.pair ?? "unknown"} README sha256 did not match`)
    }
    if (booleanField(row, "taskSha256Matched") !== true) {
      diagnostics.push(`pair ${row.pair ?? "unknown"} TASK sha256 did not match`)
    }
    if (booleanField(row, "startCommitMatched") !== true) {
      diagnostics.push(`pair ${row.pair ?? "unknown"} start commit did not match`)
    }
  }
}

function validateSummary(plan, summary) {
  const diagnostics = []
  if (summary.schema !== SUMMARY_SCHEMA) {
    diagnostics.push(`summary.schema must be ${SUMMARY_SCHEMA}`)
  }
  if (summary.gate !== GATE) {
    diagnostics.push(`summary.gate must be ${GATE}`)
  }
  if (!isRecord(summary.validity)) {
    diagnostics.push("validity must be an object")
  }
  if (!isRecord(summary.railEntry)) {
    diagnostics.push("railEntry must be an object")
  }
  if (!isRecord(summary.validity) || !isRecord(summary.railEntry)) {
    return diagnostics
  }

  const minimumPairs = numericField(plan.criteria, "minimumPairs") ?? MINIMUM_PAIRS
  const minimumDelta = numericField(plan.criteria, "minimumDeltaPercentagePoints") ?? MINIMUM_DELTA_PERCENTAGE_POINTS
  const acceptedPairs = numericField(summary.validity, "finalAcceptedValidPairs")
  const invalidRuns = numericField(summary.validity, "invalidRunCount")
  const current = numericField(summary.railEntry, "current")
  const candidate = numericField(summary.railEntry, "candidate")
  const totalPairs = numericField(summary.railEntry, "totalPairs")
  const delta = numericField(summary.railEntry, "deltaPercentagePoints")
  const criterionMet = booleanField(summary.railEntry, "nonInferiorityCriterionMet")

  if (acceptedPairs === undefined || acceptedPairs < minimumPairs) {
    diagnostics.push(`finalAcceptedValidPairs must be >= ${minimumPairs}`)
  }
  if (invalidRuns !== 0) {
    diagnostics.push("invalid runs must be 0")
  }
  if (totalPairs === undefined || acceptedPairs === undefined || totalPairs !== acceptedPairs) {
    diagnostics.push("railEntry.totalPairs must equal validity.finalAcceptedValidPairs")
  }
  if (current === undefined || candidate === undefined || delta === undefined) {
    diagnostics.push("railEntry current, candidate, and deltaPercentagePoints must be numbers")
  } else {
    const computedDelta = ((candidate - current) / Math.max(current, totalPairs ?? 1)) * 100
    if (Math.abs(computedDelta - delta) > 0.001) {
      diagnostics.push("railEntry.deltaPercentagePoints does not match candidate/current counts")
    }
    if (delta < minimumDelta) {
      diagnostics.push("candidate rail entry is below current/control")
    }
    if (criterionMet !== delta >= minimumDelta) {
      diagnostics.push("nonInferiorityCriterionMet does not match configured threshold")
    }
  }
  validatePairRows(summary, diagnostics)
  return diagnostics
}

function check(args) {
  const archiveDir = resolve(requireOption(args, "--archive"))
  const planPath = `${archiveDir}/measurement-plan.json`
  const summaryPath = `${archiveDir}/summary.json`
  if (!existsSync(planPath)) {
    throw new Error(`Missing ${planPath}; run init first`)
  }
  if (!existsSync(summaryPath)) {
    throw new Error(`Missing ${summaryPath}; write summary.json after the real run`)
  }
  const plan = readJson(planPath)
  const summary = readJson(summaryPath)
  if (!isRecord(plan) || !isRecord(plan.criteria)) {
    throw new Error("measurement-plan.json is not a supported rail-entry gate plan")
  }
  if (!isRecord(summary)) {
    throw new Error("summary.json must be an object")
  }
  const diagnostics = validateSummary(plan, summary)
  const status = diagnostics.length === 0 ? "PASS" : "FAIL"
  console.log(`Rail-entry prompt regression gate: ${status}`)
  if (isRecord(summary.railEntry)) {
    console.log(`current rail entry: ${summary.railEntry.current ?? "unknown"}/${summary.railEntry.totalPairs ?? "unknown"}`)
    console.log(`candidate rail entry: ${summary.railEntry.candidate ?? "unknown"}/${summary.railEntry.totalPairs ?? "unknown"}`)
    console.log(`candidate-current delta: ${summary.railEntry.deltaPercentagePoints ?? "unknown"}pp`)
  }
  for (const diagnostic of diagnostics) {
    console.log(`- ${diagnostic}`)
  }
  process.exitCode = diagnostics.length === 0 ? 0 : 1
}

function main() {
  const [command, ...args] = process.argv.slice(2)
  if (command === "init") {
    init(args)
    return
  }
  if (command === "check") {
    check(args)
    return
  }
  console.log(usage())
  process.exitCode = 1
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
