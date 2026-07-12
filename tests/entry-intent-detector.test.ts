import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { detectEntryIntent, measureEntryIntentCorpus } from "../src/runtime/entry-intent-detector.js"

type CorpusRecord = {
  readonly expected: boolean
  readonly id: string
  readonly language: "en" | "ko"
  readonly note: string
  readonly projectAttached: boolean
  readonly prompt: string
}

type Corpus = {
  readonly preregistration: {
    readonly falseNegativeCost: number
    readonly falsePositiveCost: number
    readonly maximumWeightedErrorRate: number
    readonly minimumPrecision: number
    readonly minimumRecall: number
  }
  readonly records: readonly CorpusRecord[]
  readonly schemaVersion: "entry-intent-corpus.1"
}

function corpus(): Corpus {
  return JSON.parse(
    readFileSync(join(process.cwd(), "experiments", "entry-intent-corpus", "corpus.json"), "utf8"),
  ) as Corpus
}

describe("entry intent detector", () => {
  it("matches every preregistered Korean and English corpus record", () => {
    for (const record of corpus().records) {
      expect(
        detectEntryIntent(record.prompt, { projectAttached: record.projectAttached }).detected,
        record.id,
      ).toBe(record.expected)
    }
  })

  it("meets the preregistered weighted decision boundary", () => {
    const input = corpus()
    const metrics = measureEntryIntentCorpus(input.records, input.preregistration)

    expect(input.preregistration.falseNegativeCost).toBeGreaterThan(input.preregistration.falsePositiveCost)
    expect(metrics.precision).toBeGreaterThanOrEqual(input.preregistration.minimumPrecision)
    expect(metrics.recall).toBeGreaterThanOrEqual(input.preregistration.minimumRecall)
    expect(metrics.weightedErrorRate).toBeLessThanOrEqual(input.preregistration.maximumWeightedErrorRate)
    expect(metrics.decision).toBe("pass")
  })

  it("returns bounded rationale codes without prompt content", () => {
    const result = detectEntryIntent("implement SecretPaymentService with token abc123", { projectAttached: true })

    expect(result.detected).toBe(true)
    expect(result.rationale).toEqual({
      codeNoun: "service",
      language: "en",
      mode: "explicit",
      verb: "implement",
    })
    expect(JSON.stringify(result)).not.toContain("SecretPaymentService")
    expect(JSON.stringify(result)).not.toContain("abc123")
  })
})
