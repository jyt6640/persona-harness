import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

type CorpusRecord = {
  readonly expectedWarning: boolean
  readonly id: string
  readonly ruleId: string
}

type NodeRun = {
  readonly status: number | null
  readonly stderr: string
  readonly stdout: string
}

const corpusDirectory = resolve("experiments/p2-e1-test-integrity-corpus")
const corpusPath = join(corpusDirectory, "corpus.json")
const measureScript = join(corpusDirectory, "measure.mjs")
const reportScript = join(corpusDirectory, "report.mjs")
let temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories) {
    rmSync(directory, { recursive: true, force: true })
  }
  temporaryDirectories = []
})

describe("P2 E1 report-only detector", () => {
  it("emits a deterministic source-only structural report for every frozen case", () => {
    // Given
    const firstRun = runNode(reportScript)
    const secondRun = runNode(reportScript)
    const records = readCorpusRecords()

    // When
    expect(firstRun.status).toBe(0)
    expect(secondRun.status).toBe(0)
    const report = readJsonOutput(firstRun)

    // Then
    expect(firstRun.stdout).toBe(secondRun.stdout)
    expect(objectValue(report, "report")["reportOnly"]).toBe(true)
    expect(objectValue(report, "report")["sourceOnly"]).toBe(true)
    expect(objectValue(report, "report")["enforcement"]).toBe(false)
    expect(objectValue(report, "report")["productRuntimeInvocation"]).toEqual({ permitted: false })

    const candidate = objectValue(objectValue(report, "report")["candidate"], "report.candidate")
    const evaluatedCaseIds = stringArray(candidate["evaluatedCaseIds"], "report.candidate.evaluatedCaseIds")
    const findings = arrayValue(candidate["findings"], "report.candidate.findings").map((finding, index) =>
      findingKey(finding, `report.candidate.findings[${index}]`),
    )
    const expectedFindingKeys = records
      .filter((record) => record.expectedWarning)
      .map((record) => `${record.id}:${record.ruleId}`)
      .sort()

    expect([...evaluatedCaseIds].sort()).toEqual(records.map((record) => record.id).sort())
    expect(findings.sort()).toEqual(expectedFindingKeys)
    expect(arrayValue(objectValue(report, "report")["detections"], "report.detections")).toHaveLength(expectedFindingKeys.length)

    const evaluation = objectValue(objectValue(report, "report")["evaluation"], "report.evaluation")
    expect(evaluation["decision"]).toBe("pass")
    expect(ruleMetric(evaluation, "E1-A1")).toMatchObject({
      falseNegatives: 0,
      falsePositives: 0,
      precision: 1,
      recall: 1,
    })
    expect(ruleMetric(evaluation, "E1-A2")).toMatchObject({
      falseNegatives: 0,
      falsePositives: 0,
      precision: 1,
      recall: 1,
    })

    for (const sourceFile of ["detector.mjs", "java-structure.mjs", "report.mjs"]) {
      const source = readFileSync(join(corpusDirectory, sourceFile), "utf8")
      expect(source).not.toContain("node:child_process")
      expect(source).not.toContain("../../src/")
    }
  })

  it("fails closed when the generated candidate omits a frozen positive", () => {
    // Given
    const reportRun = runNode(reportScript)
    expect(reportRun.status).toBe(0)
    const report = objectValue(readJsonOutput(reportRun), "report")
    const candidate = objectValue(report["candidate"], "report.candidate")
    const findings = arrayValue(candidate["findings"], "report.candidate.findings")
    const incompleteCandidate = {
      ...candidate,
      findings: findings.filter((finding, index) => {
        const findingValue = objectValue(finding, `report.candidate.findings[${index}]`)
        return stringValue(findingValue["caseId"], `report.candidate.findings[${index}].caseId`) !== "e1-a1-pos-empty-jupiter-001"
      }),
    }
    const candidatePath = writeTemporaryCandidate(incompleteCandidate)

    // When
    const measurementRun = runNode(measureScript, ["--candidate", candidatePath])

    // Then
    expect(measurementRun.status).toBe(1)
    expect(measurementRun.stderr).toBe("")
    const measurement = objectValue(readJsonOutput(measurementRun), "measurement")
    expect(measurement["decision"]).toBe("fail")
    expect(ruleMetric(objectValue(measurement["measurement"], "measurement.measurement"), "E1-A1")).toMatchObject({
      falseNegatives: 1,
      falsePositives: 0,
      decision: "fail",
    })
  })

  it("fails closed when the generated candidate reports a frozen negative", () => {
    // Given
    const reportRun = runNode(reportScript)
    expect(reportRun.status).toBe(0)
    const report = objectValue(readJsonOutput(reportRun), "report")
    const candidate = objectValue(report["candidate"], "report.candidate")
    const findings = arrayValue(candidate["findings"], "report.candidate.findings")
    const candidateWithFalsePositive = {
      ...candidate,
      findings: [
        ...findings,
        {
          caseId: "e1-a1-neg-interaction-only-005",
          ruleId: "E1-A1",
        },
      ],
    }
    const candidatePath = writeTemporaryCandidate(candidateWithFalsePositive)

    // When
    const measurementRun = runNode(measureScript, ["--candidate", candidatePath])

    // Then
    expect(measurementRun.status).toBe(1)
    expect(measurementRun.stderr).toBe("")
    const measurement = objectValue(readJsonOutput(measurementRun), "measurement")
    expect(measurement["decision"]).toBe("fail")
    expect(ruleMetric(objectValue(measurement["measurement"], "measurement.measurement"), "E1-A1")).toMatchObject({
      falseNegatives: 0,
      falsePositives: 1,
      decision: "fail",
    })
  })
})

function readCorpusRecords(): readonly CorpusRecord[] {
  const corpus = objectValue(JSON.parse(readFileSync(corpusPath, "utf8")), "corpus")
  return arrayValue(corpus["records"], "corpus.records").map((record, index) => {
    const value = objectValue(record, `corpus.records[${index}]`)
    return {
      expectedWarning: booleanValue(value["expectedWarning"], `corpus.records[${index}].expectedWarning`),
      id: stringValue(value["id"], `corpus.records[${index}].id`),
      ruleId: stringValue(value["ruleId"], `corpus.records[${index}].ruleId`),
    }
  })
}

function runNode(scriptPath: string, args: readonly string[] = []): NodeRun {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  })

  return {
    status: result.status,
    stderr: result.stderr,
    stdout: result.stdout,
  }
}

function readJsonOutput(run: NodeRun): unknown {
  expect(run.stdout).not.toBe("")
  return JSON.parse(run.stdout)
}

function writeTemporaryCandidate(candidate: Readonly<Record<string, unknown>>): string {
  const directory = mkdtempSync(join(tmpdir(), "persona-p2-e1-report-only-"))
  temporaryDirectories.push(directory)
  const candidatePath = join(directory, "candidate.json")
  writeFileSync(candidatePath, `${JSON.stringify(candidate, null, 2)}\n`)
  return candidatePath
}

function ruleMetric(evaluation: Readonly<Record<string, unknown>>, ruleId: string): Readonly<Record<string, unknown>> {
  const results = arrayValue(evaluation["results"], "evaluation.results")
  const matchingResult = results.find((result, index) => {
    const value = objectValue(result, `evaluation.results[${index}]`)
    return value["ruleId"] === ruleId
  })
  if (matchingResult === undefined) {
    throw new TypeError(`Missing metric for ${ruleId}`)
  }
  return objectValue(matchingResult, `evaluation.results.${ruleId}`)
}

function findingKey(value: unknown, name: string): string {
  const finding = objectValue(value, name)
  return `${stringValue(finding["caseId"], `${name}.caseId`)}:${stringValue(finding["ruleId"], `${name}.ruleId`)}`
}

function objectValue(value: unknown, name: string): Readonly<Record<string, unknown>> {
  if (!isRecord(value)) {
    throw new TypeError(`${name} must be an object`)
  }
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function arrayValue(value: unknown, name: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${name} must be an array`)
  }
  return value
}

function stringArray(value: unknown, name: string): readonly string[] {
  return arrayValue(value, name).map((item, index) => stringValue(item, `${name}[${index}]`))
}

function stringValue(value: unknown, name: string): string {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a string`)
  }
  return value
}

function booleanValue(value: unknown, name: string): boolean {
  if (typeof value !== "boolean") {
    throw new TypeError(`${name} must be a boolean`)
  }
  return value
}
