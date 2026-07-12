import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { spawnSync } from "node:child_process"

import { afterEach, describe, expect, it } from "vitest"

type CorpusRecord = {
  readonly anchor: string
  readonly category: string
  readonly expectedWarning: boolean
  readonly fixture: string
  readonly id: string
  readonly ruleId: "E1-A1" | "E1-A2"
}

type Corpus = {
  readonly coverage: {
    readonly expectedByRule: Readonly<Record<"E1-A1" | "E1-A2", { readonly negative: number; readonly positive: number }>>
    readonly expectedCaseCount: number
    readonly requiredCategories: readonly string[]
  }
  readonly languagePolicy: string
  readonly mutationPolicy: {
    readonly evaluationState: string
    readonly fixtureSha256: Readonly<Record<string, string>>
    readonly frozenFields: readonly string[]
    readonly frozenLabelSetSha256: string
    readonly noRelabelAfterEvaluation: boolean
  }
  readonly records: readonly CorpusRecord[]
  readonly schemaVersion: string
}

type MeasurementOutput = {
  readonly decision: "pass" | "fail"
  readonly measurement?: {
    readonly decision: "pass" | "fail"
    readonly results: readonly {
      readonly falseNegatives: number
      readonly falsePositives: number
      readonly ruleId: "E1-A1" | "E1-A2"
    }[]
  }
  readonly validation: {
    readonly byRule: Readonly<Record<"E1-A1" | "E1-A2", { readonly negative: number; readonly positive: number }>>
    readonly caseCount: number
    readonly categories: readonly string[]
    readonly fixtureSha256: Readonly<Record<string, string>>
    readonly frozenLabelSetSha256: string
  }
}

const corpusDirectory = resolve("experiments/p2-e1-test-integrity-corpus")
const corpusPath = join(corpusDirectory, "corpus.json")
const referencePath = join(corpusDirectory, "reference-evaluation.json")
const measureScript = join(corpusDirectory, "measure.mjs")
let temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories) {
    rmSync(directory, { recursive: true, force: true })
  }
  temporaryDirectories = []
})

describe("P2 E1 test-integrity corpus", () => {
  it("keeps stable record ids, structural shapes, and fixture anchors", () => {
    const corpus = readJson<Corpus>(corpusPath)
    const ids = new Set<string>()
    const anchors = new Set<string>()

    expect(corpus.schemaVersion).toBe("p2-e1-test-integrity-corpus.1")
    expect(corpus.languagePolicy).toBe("bilingual-free-java-structural")
    expect(corpus.records).toHaveLength(corpus.coverage.expectedCaseCount)

    for (const record of corpus.records) {
      expect(record.id).toMatch(/^e1-a[12]-(?:pos|neg)-[a-z0-9-]+-\d{3}$/u)
      expect(record.ruleId).toMatch(/^E1-A[12]$/u)
      expect(typeof record.expectedWarning).toBe("boolean")
      expect(record.fixture).toMatch(/^fixtures\/[A-Za-z0-9]+\.java$/u)
      expect(record.fixture).not.toContain("..")
      expect(record.anchor).toBe(`P2E1_CASE:${record.id}`)
      expect(ids.has(record.id), record.id).toBe(false)
      expect(anchors.has(record.anchor), record.anchor).toBe(false)
      expect(readFileSync(join(corpusDirectory, record.fixture), "utf8"), record.id).toContain(record.anchor)
      ids.add(record.id)
      anchors.add(record.anchor)
    }
  })

  it("covers every preregistered rule polarity and difficult-negative category", () => {
    const corpus = readJson<Corpus>(corpusPath)
    const actualByRule: Record<"E1-A1" | "E1-A2", { negative: number; positive: number }> = {
      "E1-A1": { negative: 0, positive: 0 },
      "E1-A2": { negative: 0, positive: 0 },
    }

    for (const record of corpus.records) {
      if (record.expectedWarning) actualByRule[record.ruleId].positive += 1
      else actualByRule[record.ruleId].negative += 1
    }

    expect(actualByRule).toEqual(corpus.coverage.expectedByRule)
    expect([...new Set(corpus.records.map((record) => record.category))].sort()).toEqual(
      [...corpus.coverage.requiredCategories].sort(),
    )
  })

  it("validates the frozen mutation policy and fixture fingerprints deterministically", () => {
    const corpus = readJson<Corpus>(corpusPath)
    const result = runMeasure(["--validate"])

    expect(result.status).toBe(0)
    expect(result.output.decision).toBe("pass")
    expect(corpus.mutationPolicy.evaluationState).toBe("preregistered-unmeasured")
    expect(corpus.mutationPolicy.noRelabelAfterEvaluation).toBe(true)
    expect(corpus.mutationPolicy.frozenFields).toEqual([
      "id",
      "ruleId",
      "expectedWarning",
      "category",
      "fixture",
      "anchor",
    ])
    expect(result.output.validation.caseCount).toBe(21)
    expect(result.output.validation.byRule).toEqual(corpus.coverage.expectedByRule)
    expect(result.output.validation.categories).toEqual([...corpus.coverage.requiredCategories].sort())
    expect(result.output.validation.frozenLabelSetSha256).toBe(corpus.mutationPolicy.frozenLabelSetSha256)
    expect(result.output.validation.fixtureSha256).toEqual(corpus.mutationPolicy.fixtureSha256)
  })

  it("passes the oracle self-check and fails an incomplete candidate under strict thresholds", () => {
    const passing = runMeasure([])

    expect(passing.status).toBe(0)
    expect(passing.output.decision).toBe("pass")
    expect(passing.output.measurement?.decision).toBe("pass")
    expect(passing.output.measurement?.results).toEqual([
      expect.objectContaining({ ruleId: "E1-A1", falseNegatives: 0, falsePositives: 0 }),
      expect.objectContaining({ ruleId: "E1-A2", falseNegatives: 0, falsePositives: 0 }),
    ])

    const incompleteCandidate = readJson<{
      readonly findings: readonly { readonly caseId: string; readonly ruleId: string }[]
    }>(referencePath)
    const temporaryDirectory = mkdtempSync(join(tmpdir(), "persona-p2-e1-incomplete-"))
    temporaryDirectories.push(temporaryDirectory)
    const incompletePath = join(temporaryDirectory, "candidate.json")
    writeFileSync(
      incompletePath,
      `${JSON.stringify(
        {
          ...readJson<Record<string, unknown>>(referencePath),
          findings: incompleteCandidate.findings.filter((finding) => finding.caseId !== "e1-a1-pos-empty-jupiter-001"),
        },
        null,
        2,
      )}\n`,
    )

    const failing = runMeasure(["--candidate", incompletePath])

    expect(failing.status).toBe(1)
    expect(failing.output.decision).toBe("fail")
    expect(failing.output.measurement?.decision).toBe("fail")
    expect(failing.output.measurement?.results).toContainEqual(
      expect.objectContaining({ ruleId: "E1-A1", falseNegatives: 1, falsePositives: 0 }),
    )
  })
})

function readJson<Value>(filePath: string): Value {
  return JSON.parse(readFileSync(filePath, "utf8")) as Value
}

function runMeasure(args: readonly string[]): { readonly output: MeasurementOutput; readonly status: number | null } {
  const result = spawnSync(process.execPath, [measureScript, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  })

  expect(result.stderr).toBe("")
  return {
    output: JSON.parse(result.stdout) as MeasurementOutput,
    status: result.status,
  }
}
