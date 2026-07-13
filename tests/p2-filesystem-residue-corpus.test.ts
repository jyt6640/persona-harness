import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import {
  assertBaseCorpusManifest,
  assertSuccessorCorpusManifest,
  corpusPath,
  corpusV2Path,
  expectMutationToFail,
  mutableCorpus,
  mutableFixture,
  readCorpus,
  readSuccessorCorpus,
  runMeasurement,
  sha256,
  writeJson,
} from "./p2-filesystem-residue-corpus-support.js"

describe("filesystem residue corpus", () => {
  it("keeps the frozen base corpus report-only and mutation-policy bounded", () => {
    const corpus = readCorpus()

    assertBaseCorpusManifest(corpus)
    expect(corpus.mutationPolicy).toEqual({
      kind: "frozen",
      successorSchemaVersion: "filesystem-residue-corpus.2",
      summary: "Existing records and fixtures are immutable; add new cases only in a new schema-versioned append-only successor.",
    })
    expect(corpus.records.map((record) => record.id)).toEqual([
      "fsr-r01",
      "fsr-r02",
      "fsr-r03",
      "fsr-r04",
      "fsr-r05",
      "fsr-l01",
      "fsr-l02",
      "fsr-l03",
      "fsr-l04",
      "fsr-l05",
    ])
    expect(runMeasurement(corpusPath)).toEqual({
      schemaVersion: "filesystem-residue-measurement.1",
      corpusSchemaVersion: "filesystem-residue-corpus.1",
      corpusFingerprint: sha256(readFileSync(corpusPath, "utf8")),
      reportOnly: true,
      sourceOnly: true,
      enforcement: false,
    })
  })

  it("rejects an appended record when the schema remains .1", () => {
    expectMutationToFail(
      corpusPath,
      "naive append to frozen .1 corpus",
      (tempRoot) => {
        const tempCorpusPath = `${tempRoot}/corpus.json`
        const corpus = mutableCorpus(tempCorpusPath)
        corpus.records.push({
          category: "likely-residue",
          expectedResidue: true,
          fixtureFingerprint: "sha256:naive-append",
          fixturePath: "fixtures/fsr-r06.json",
          id: "fsr-r06",
          label: "append-only successor residue",
        })
        writeJson(tempCorpusPath, corpus)
      },
      /schemaVersion|record count|mutation policy|append-only/u,
    )
  })

  it("accepts a correctly bound append-only successor and rejects base drift", () => {
    const successor = readSuccessorCorpus()

    assertSuccessorCorpusManifest(successor)
    expect(successor.mutationPolicy).toEqual({
      kind: "append-only-successor",
      baseSchemaVersion: "filesystem-residue-corpus.1",
      baseCorpusFingerprint: sha256(readFileSync(corpusPath, "utf8")),
      summary: "Append-only successor: the .1 prefix is immutable, byte-identical, and ordered before the appended record.",
    })
    expect(successor.records.map((record) => record.id)).toEqual([
      "fsr-r01",
      "fsr-r02",
      "fsr-r03",
      "fsr-r04",
      "fsr-r05",
      "fsr-l01",
      "fsr-l02",
      "fsr-l03",
      "fsr-l04",
      "fsr-l05",
      "fsr-r06",
    ])
    expect(runMeasurement(corpusV2Path)).toEqual({
      schemaVersion: "filesystem-residue-measurement.2",
      corpusSchemaVersion: "filesystem-residue-corpus.2",
      corpusFingerprint: sha256(readFileSync(corpusV2Path, "utf8")),
      baseCorpusFingerprint: sha256(readFileSync(corpusPath, "utf8")),
      reportOnly: true,
      sourceOnly: true,
      enforcement: false,
    })

    for (const [scenario, mutate, pattern] of [
      [
        "altered successor prefix record",
        (tempRoot: string) => {
          const corpus = mutableCorpus(`${tempRoot}/corpus.v2.json`)
          corpus.records[0].label = "changed base label"
          writeJson(`${tempRoot}/corpus.v2.json`, corpus)
        },
        /prefix|fixture|record/i,
      ],
      [
        "deleted successor prefix record",
        (tempRoot: string) => {
          const corpus = mutableCorpus(`${tempRoot}/corpus.v2.json`)
          corpus.records.splice(2, 1)
          writeJson(`${tempRoot}/corpus.v2.json`, corpus)
        },
        /prefix|record count|append-only/i,
      ],
      [
        "reordered successor prefix record",
        (tempRoot: string) => {
          const corpus = mutableCorpus(`${tempRoot}/corpus.v2.json`)
          const [first, second] = corpus.records
          if (first === undefined || second === undefined) {
            throw new TypeError("missing prefix records")
          }
          corpus.records[0] = second
          corpus.records[1] = first
          writeJson(`${tempRoot}/corpus.v2.json`, corpus)
        },
        /prefix|ordered/i,
      ],
      [
        "reused successor id and fixture",
        (tempRoot: string) => {
          const corpus = mutableCorpus(`${tempRoot}/corpus.v2.json`)
          corpus.records[10].id = "fsr-r01"
          corpus.records[10].fixturePath = "fixtures/fsr-r01.json"
          writeJson(`${tempRoot}/corpus.v2.json`, corpus)
        },
        /fresh ID|fixture|duplicate/i,
      ],
      [
        "mismatched successor base fingerprint",
        (tempRoot: string) => {
          const corpus = mutableCorpus(`${tempRoot}/corpus.v2.json`)
          if (corpus.mutationPolicy === undefined) {
            throw new TypeError("missing mutation policy")
          }
          corpus.mutationPolicy.baseCorpusFingerprint = "sha256:deadbeef"
          writeJson(`${tempRoot}/corpus.v2.json`, corpus)
        },
        /base binding|fingerprint/i,
      ],
      [
        "missing successor preregistration",
        (tempRoot: string) => {
          const corpus = mutableCorpus(`${tempRoot}/corpus.v2.json`)
          delete corpus.preregistration
          writeJson(`${tempRoot}/corpus.v2.json`, corpus)
        },
        /preregistration|schema|shape|Invalid successor corpus/i,
      ],
      [
        "mutated successor fixture payload",
        (tempRoot: string) => {
          const fixture = mutableFixture(`${tempRoot}/fixtures/fsr-r06.json`)
          fixture.paths[0] = "dist/changed.json"
          writeJson(`${tempRoot}/fixtures/fsr-r06.json`, fixture)
        },
        /fixture|status|path|fingerprint/i,
      ],
    ] as const) {
      expectMutationToFail(corpusV2Path, scenario, mutate, pattern)
    }
  })
})
