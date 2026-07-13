import { createHash } from "node:crypto"
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"

type Category = "difficult-legitimate-untracked" | "likely-residue"
type CorpusRecord = { readonly category: Category; readonly expectedResidue: boolean; readonly fixtureFingerprint: string; readonly fixturePath: string; readonly id: string; readonly label: string }
type Corpus = { readonly categories: readonly Category[]; readonly categoryLabels: Readonly<Record<Category, string>>; readonly enforcement: false; readonly preregistration: { readonly decision: string; readonly falseNegativeThreshold: 0; readonly falsePositiveThreshold: 0; readonly maximumWeightedErrorRate: 0; readonly minimumPrecision: 1; readonly minimumRecall: 1; readonly oracle: string }; readonly records: readonly CorpusRecord[]; readonly reportOnly: true; readonly schemaVersion: "filesystem-residue-corpus.1"; readonly sourceOnly: true }
type Fixture = { readonly category: Category; readonly expectedResidue: boolean; readonly fixtureId: string; readonly gitStatus: { readonly porcelainV1: readonly string[] }; readonly label: string; readonly paths: readonly string[] }
type Measurement = { readonly corpusSchemaVersion: "filesystem-residue-corpus.1"; readonly coverage: Readonly<Record<Category, number>>; readonly enforcement: false; readonly frozen: { readonly fixtureFingerprints: readonly string[]; readonly ids: readonly string[]; readonly labels: readonly string[] }; readonly metrics: { readonly decision: "pass"; readonly falseNegatives: 0; readonly falsePositives: 0; readonly precision: 1; readonly recall: 1 }; readonly reportOnly: true; readonly schemaVersion: "filesystem-residue-measurement.1"; readonly sourceOnly: true; readonly thresholds: { readonly falseNegatives: 0; readonly falsePositives: 0 } }
type MutableCorpus = { categories: Category[]; categoryLabels: Record<Category, string>; enforcement: boolean; preregistration: { decision: string; falseNegativeThreshold: 0; falsePositiveThreshold: 0; maximumWeightedErrorRate: 0; minimumPrecision: 1; minimumRecall: 1; oracle: string }; records: Array<{ category: Category; expectedResidue?: boolean; fixtureFingerprint: string; fixturePath: string; id: string; label: string }>; reportOnly: boolean; schemaVersion: string; sourceOnly: boolean }
type MutableFixture = { category: Category; expectedResidue: boolean; fixtureId: string; gitStatus: { porcelainV1: string[] }; label: string; paths: string[] }

export const corpusRoot = path.join(process.cwd(), "experiments", "p2-e3-filesystem-residue-corpus")
export const corpusPath = path.join(corpusRoot, "corpus.json")
export const evaluatorPath = path.join(corpusRoot, "evaluator", "measure.mjs")

export function readCorpus(filePath = corpusPath): Corpus {
  const corpus = readJson(filePath)
  assertCorpus(corpus)
  return corpus
}

export function assertCorpusManifest(corpus: Corpus): void {
  assertCorpus(corpus)
  if (corpus.categories[0] !== "likely-residue" || corpus.categories[1] !== "difficult-legitimate-untracked") {
    throw new TypeError("Unexpected corpus categories")
  }
  if (corpus.categoryLabels["likely-residue"] !== "likely residue" || corpus.categoryLabels["difficult-legitimate-untracked"] !== "difficult legitimate untracked work") {
    throw new TypeError("Unexpected category labels")
  }
  if (
    corpus.preregistration.decision !== "eligible-for-report-only-preregistration" ||
    corpus.preregistration.falseNegativeThreshold !== 0 ||
    corpus.preregistration.falsePositiveThreshold !== 0 ||
    corpus.preregistration.maximumWeightedErrorRate !== 0 ||
    corpus.preregistration.minimumPrecision !== 1 ||
    corpus.preregistration.minimumRecall !== 1 ||
    corpus.preregistration.oracle !== "corpus-manifest-verified"
  ) {
    throw new TypeError("Unexpected preregistration")
  }
  if (corpus.records.length !== 10) {
    throw new TypeError("Unexpected corpus record count")
  }

  const coverage: Record<Category, number> = { "difficult-legitimate-untracked": 0, "likely-residue": 0 }
  const ids = new Set<string>()

  for (const record of corpus.records) {
    assertRecord(record)
    if (ids.has(record.id)) {
      throw new TypeError(`Duplicate record id: ${record.id}`)
    }
    ids.add(record.id)
    coverage[record.category] += 1
    if (!/^fixtures\/fsr-(?:l|r)\d{2}\.json$/u.test(record.fixturePath)) {
      throw new TypeError(`Unexpected fixture path: ${record.id}`)
    }

    const fixturePath = path.join(corpusRoot, record.fixturePath)
    const fixture = readFixture(fixturePath)
    if (
      fixture.fixtureId !== record.id ||
      fixture.category !== record.category ||
      fixture.label !== record.label ||
      fixture.expectedResidue !== record.expectedResidue
    ) {
      throw new TypeError(`Fixture mismatch: ${record.id}`)
    }
    if (record.fixtureFingerprint !== sha256(readFileSync(fixturePath, "utf8"))) {
      throw new TypeError(`Fixture fingerprint mismatch: ${record.id}`)
    }
    ensureStatusAndPathParity(fixture)
  }

  if (coverage["likely-residue"] !== 5 || coverage["difficult-legitimate-untracked"] !== 5) {
    throw new TypeError("Unexpected category coverage")
  }
}

export function runMeasurement(filePath = corpusPath): Measurement {
  const result = spawnSync("node", [evaluatorPath, "--corpus", filePath], { encoding: "utf8" })
  if (result.status !== 0) {
    throw new Error(`${result.stderr || result.stdout}`.trim())
  }
  const measurement = readJsonFromString(result.stdout)
  assertMeasurement(measurement)
  return measurement
}

export function expectMutationToFail(scenario: string, mutate: (tempRoot: string) => void, pattern: RegExp): void {
  const tempRoot = mkdtempSync(path.join(tmpdir(), "fsr-corpus-"))
  cpSync(corpusRoot, tempRoot, { recursive: true })
  try {
    mutate(tempRoot)
    const result = spawnSync("node", [evaluatorPath, "--corpus", path.join(tempRoot, "corpus.json")], { encoding: "utf8" })
    if (result.status === 0) {
      throw new Error(`${scenario}: expected failure`)
    }
    if (!pattern.test(`${result.stdout}\n${result.stderr}`)) {
      throw new Error(`${scenario}: did not match ${pattern.toString()}`)
    }
  } finally {
    rmSync(tempRoot, { force: true, recursive: true })
  }
}

export function mutableCorpus(filePath: string): MutableCorpus {
  const parsed: MutableCorpus = JSON.parse(readFileSync(filePath, "utf8"))
  return parsed
}

export function mutableFixture(filePath: string): MutableFixture {
  const parsed: MutableFixture = JSON.parse(readFileSync(filePath, "utf8"))
  return parsed
}

export function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function readFixture(filePath: string): Fixture {
  const fixture = readJson(filePath)
  assertFixture(fixture)
  return fixture
}

function assertCorpus(value: unknown): asserts value is Corpus {
  if (!isRecord(value) || value.schemaVersion !== "filesystem-residue-corpus.1" || value.reportOnly !== true || value.sourceOnly !== true || value.enforcement !== false || !Array.isArray(value.categories) || !isRecord(value.categoryLabels) || !Array.isArray(value.records)) {
    throw new TypeError("Invalid corpus")
  }
}

function assertRecord(value: unknown): asserts value is CorpusRecord {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.label !== "string" || typeof value.fixturePath !== "string" || (value.category !== "likely-residue" && value.category !== "difficult-legitimate-untracked") || typeof value.expectedResidue !== "boolean" || typeof value.fixtureFingerprint !== "string" || !value.fixtureFingerprint.startsWith("sha256:")) {
    throw new TypeError("Invalid record")
  }
}

function assertFixture(value: unknown): asserts value is Fixture {
  if (!isRecord(value) || typeof value.fixtureId !== "string" || typeof value.label !== "string" || (value.category !== "likely-residue" && value.category !== "difficult-legitimate-untracked") || typeof value.expectedResidue !== "boolean" || !isRecord(value.gitStatus) || !Array.isArray(value.gitStatus.porcelainV1) || !Array.isArray(value.paths)) {
    throw new TypeError("Invalid fixture")
  }
}

function assertMeasurement(value: unknown): asserts value is Measurement {
  if (!isRecord(value) || value.schemaVersion !== "filesystem-residue-measurement.1" || value.reportOnly !== true || value.sourceOnly !== true || value.enforcement !== false) {
    throw new TypeError("Invalid measurement")
  }
}

function readJson(filePath: string): unknown {
  return readJsonFromString(readFileSync(filePath, "utf8"))
}

function readJsonFromString(text: string): unknown {
  return JSON.parse(text)
}

function ensureStatusAndPathParity(fixture: Fixture): void {
  if (fixture.gitStatus.porcelainV1.length !== fixture.paths.length) {
    throw new TypeError(`Fixture path count mismatch: ${fixture.fixtureId}`)
  }
  for (let index = 0; index < fixture.paths.length; index += 1) {
    const statusEntry = fixture.gitStatus.porcelainV1[index]
    const pathEntry = fixture.paths[index]
    if (!statusEntry.startsWith("?? ") || statusEntry.slice(3) !== pathEntry) {
      throw new TypeError(`Fixture status/path mismatch: ${fixture.fixtureId}`)
    }
  }
}

function sha256(text: string): string {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
