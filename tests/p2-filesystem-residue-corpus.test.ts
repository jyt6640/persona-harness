import { describe, expect, it } from "vitest"

import {
  assertCorpusManifest,
  expectMutationToFail,
  mutableCorpus,
  mutableFixture,
  readCorpus,
  runMeasurement,
  writeJson,
} from "./p2-filesystem-residue-corpus-support.js"

describe("filesystem residue corpus", () => {
  it("keeps the preregistered corpus report-only, source-only, and zero-FP/FN", () => {
    const corpus = readCorpus()

    assertCorpusManifest(corpus)
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
    expect(corpus.records.map((record) => record.label)).toEqual([
      "build artifact spill",
      "cache lockfile residue",
      "log spill residue",
      "editor backup residue",
      "temp staging residue",
      "experiment corpus fixture",
      "preregistration draft",
      "scratch path fixture",
      "note bundle",
      "review appendix",
    ])

    expect(runMeasurement()).toEqual({
      corpusSchemaVersion: "filesystem-residue-corpus.1",
      coverage: {
        "difficult-legitimate-untracked": 5,
        "likely-residue": 5,
      },
      enforcement: false,
      frozen: {
        fixtureFingerprints: corpus.records.map((record) => record.fixtureFingerprint),
        ids: corpus.records.map((record) => record.id),
        labels: corpus.records.map((record) => record.label),
      },
      metrics: {
        decision: "pass",
        falseNegatives: 0,
        falsePositives: 0,
        precision: 1,
        recall: 1,
      },
      reportOnly: true,
      schemaVersion: "filesystem-residue-measurement.1",
      sourceOnly: true,
      thresholds: {
        falseNegatives: 0,
        falsePositives: 0,
      },
    })
  })

  it("fails closed when a candidate record is incomplete, relabeled, or a fixture mutates", () => {
    expectMutationToFail(
      "missing expectedResidue",
      (tempRoot) => {
        const corpus = mutableCorpus(`${tempRoot}/corpus.json`)
        delete corpus.records[0].expectedResidue
        writeJson(`${tempRoot}/corpus.json`, corpus)
      },
      /expectedResidue/u,
    )

    expectMutationToFail(
      "relabelled record",
      (tempRoot) => {
        const corpus = mutableCorpus(`${tempRoot}/corpus.json`)
        corpus.records[0].label = "moved residue label"
        writeJson(`${tempRoot}/corpus.json`, corpus)
      },
      /label/u,
    )

    expectMutationToFail(
      "mutated fixture payload",
      (tempRoot) => {
        const fixture = mutableFixture(`${tempRoot}/fixtures/fsr-r01.json`)
        fixture.paths[0] = "dist/mutated-output.json"
        writeJson(`${tempRoot}/fixtures/fsr-r01.json`, fixture)
      },
      /fingerprint|paths/u,
    )
  })
})
