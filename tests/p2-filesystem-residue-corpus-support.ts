import { createHash } from "node:crypto"
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"

type Category = "difficult-legitimate-untracked" | "likely-residue"
type CorpusRecord = { readonly category: Category; readonly expectedResidue: boolean; readonly fixtureFingerprint: string; readonly fixturePath: string; readonly id: string; readonly label: string }
type BaseCorpus = { readonly categories: readonly Category[]; readonly categoryLabels: Readonly<Record<Category, string>>; readonly enforcement: false; readonly mutationPolicy: { readonly kind: "frozen"; readonly successorSchemaVersion: "filesystem-residue-corpus.2"; readonly summary: string }; readonly preregistration: { readonly decision: string; readonly falseNegativeThreshold: 0; readonly falsePositiveThreshold: 0; readonly maximumWeightedErrorRate: 0; readonly minimumPrecision: 1; readonly minimumRecall: 1; readonly oracle: string }; readonly records: readonly CorpusRecord[]; readonly reportOnly: true; readonly schemaVersion: "filesystem-residue-corpus.1"; readonly sourceOnly: true }
type SuccessorCorpus = { readonly categories: readonly Category[]; readonly categoryLabels: Readonly<Record<Category, string>>; readonly enforcement: false; readonly mutationPolicy: { readonly baseCorpusFingerprint: string; readonly baseSchemaVersion: "filesystem-residue-corpus.1"; readonly kind: "append-only-successor"; readonly summary: string }; readonly preregistration: { readonly decision: string; readonly falseNegativeThreshold: 0; readonly falsePositiveThreshold: 0; readonly maximumWeightedErrorRate: 0; readonly minimumPrecision: 1; readonly minimumRecall: 1; readonly oracle: string }; readonly records: readonly CorpusRecord[]; readonly reportOnly: true; readonly schemaVersion: "filesystem-residue-corpus.2"; readonly sourceOnly: true }
type Fixture = { readonly category: Category; readonly expectedResidue: boolean; readonly fixtureId: string; readonly gitStatus: { readonly porcelainV1: readonly string[] }; readonly label: string; readonly paths: readonly string[] }
type Measurement = { readonly corpusSchemaVersion: "filesystem-residue-corpus.1" | "filesystem-residue-corpus.2"; readonly enforcement: false; readonly reportOnly: true; readonly schemaVersion: "filesystem-residue-measurement.1" | "filesystem-residue-measurement.2"; readonly sourceOnly: true }
type MutableCorpus = { categories: Category[]; categoryLabels: Record<Category, string>; enforcement: boolean; mutationPolicy?: { kind?: string; successorSchemaVersion?: string; baseCorpusFingerprint?: string; baseSchemaVersion?: string; summary?: string }; preregistration?: Record<string, unknown>; records: Array<{ category: Category; expectedResidue?: boolean; fixtureFingerprint: string; fixturePath: string; id: string; label: string }>; reportOnly: boolean; schemaVersion: string; sourceOnly: boolean }
type MutableFixture = { category: Category; expectedResidue: boolean; fixtureId: string; gitStatus: { porcelainV1: string[] }; label: string; paths: string[] }

export const corpusRoot = path.join(process.cwd(), "experiments", "p2-e3-filesystem-residue-corpus")
export const corpusPath = path.join(corpusRoot, "corpus.json")
export const corpusV2Path = path.join(corpusRoot, "corpus.v2.json")
export const evaluatorPath = path.join(corpusRoot, "evaluator", "measure.mjs")

export function readCorpus(filePath = corpusPath): BaseCorpus {
  const corpus = readJson(filePath)
  assertBaseCorpus(corpus)
  return corpus
}

export function readSuccessorCorpus(filePath = corpusV2Path): SuccessorCorpus {
  const corpus = readJson(filePath)
  assertSuccessor(corpus)
  return corpus
}

export function assertBaseCorpusManifest(corpus: BaseCorpus): void {
  if (corpus.schemaVersion !== "filesystem-residue-corpus.1" || corpus.reportOnly !== true || corpus.sourceOnly !== true || corpus.enforcement !== false) {
    throw new TypeError("Invalid base corpus flags")
  }
  if (corpus.mutationPolicy.kind !== "frozen" || corpus.mutationPolicy.successorSchemaVersion !== "filesystem-residue-corpus.2") {
    throw new TypeError("Invalid base mutation policy")
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
    throw new TypeError("Invalid base preregistration")
  }
  if (corpus.records.length !== 10) {
    throw new TypeError("Unexpected base record count")
  }

  const coverage: Record<Category, number> = { "difficult-legitimate-untracked": 0, "likely-residue": 0 }
  const ids = new Set<string>()

  for (const record of corpus.records) {
    assertRecord(record)
    if (ids.has(record.id)) {
      throw new TypeError(`Duplicate base record id: ${record.id}`)
    }
    ids.add(record.id)
    coverage[record.category] += 1
    if (!/^fixtures\/fsr-(?:l|r)\d{2}\.json$/u.test(record.fixturePath)) {
      throw new TypeError(`Unexpected base fixture path: ${record.id}`)
    }
    const fixturePath = path.join(corpusRoot, record.fixturePath)
    const fixture = readFixture(fixturePath)
    if (!sameRecord(record, fixture) || record.fixtureFingerprint !== sha256(readFileSync(fixturePath, "utf8"))) {
      throw new TypeError(`Base fixture mismatch: ${record.id}`)
    }
    ensureStatusAndPathParity(fixture)
  }

  if (coverage["likely-residue"] !== 5 || coverage["difficult-legitimate-untracked"] !== 5) {
    throw new TypeError("Unexpected base category coverage")
  }
}

export function assertSuccessorCorpusManifest(corpus: SuccessorCorpus): void {
  if (corpus.schemaVersion !== "filesystem-residue-corpus.2" || corpus.reportOnly !== true || corpus.sourceOnly !== true || corpus.enforcement !== false) {
    throw new TypeError("Invalid successor corpus flags")
  }
  if (corpus.mutationPolicy.kind !== "append-only-successor" || corpus.mutationPolicy.baseSchemaVersion !== "filesystem-residue-corpus.1") {
    throw new TypeError("Invalid successor mutation policy")
  }
  if (
    corpus.preregistration.decision !== "eligible-for-report-only-successor-preregistration" ||
    corpus.preregistration.falseNegativeThreshold !== 0 ||
    corpus.preregistration.falsePositiveThreshold !== 0 ||
    corpus.preregistration.maximumWeightedErrorRate !== 0 ||
    corpus.preregistration.minimumPrecision !== 1 ||
    corpus.preregistration.minimumRecall !== 1 ||
    corpus.preregistration.oracle !== "corpus-manifest-verified"
  ) {
    throw new TypeError("Invalid successor preregistration")
  }

  const base = readCorpus()
  if (corpus.mutationPolicy.baseCorpusFingerprint !== sha256(readFileSync(corpusPath, "utf8"))) {
    throw new TypeError("Invalid successor base binding")
  }
  if (corpus.records.length !== base.records.length + 1) {
    throw new TypeError("Unexpected successor record count")
  }

  for (let index = 0; index < base.records.length; index += 1) {
    const baseRecord = base.records[index]
    const successorRecord = corpus.records[index]
    if (successorRecord === undefined || JSON.stringify(baseRecord) !== JSON.stringify(successorRecord)) {
      throw new TypeError(`Successor base prefix mismatch: ${index}`)
    }
  }

  const appended = corpus.records[base.records.length]
  if (appended === undefined) {
    throw new TypeError("Missing successor appended record")
  }
  assertRecord(appended)
  if (appended.category !== "likely-residue" || appended.expectedResidue !== true) {
    throw new TypeError("Unexpected successor appended record")
  }
  if (base.records.some((record) => record.id === appended.id || record.fixturePath === appended.fixturePath)) {
    throw new TypeError("Successor appended record must use fresh ID and fixture")
  }
  const fixturePath = path.join(corpusRoot, appended.fixturePath)
  const fixture = readFixture(fixturePath)
  if (!sameRecord(appended, fixture) || appended.fixtureFingerprint !== sha256(readFileSync(fixturePath, "utf8"))) {
    throw new TypeError("Successor appended fixture mismatch")
  }
  ensureStatusAndPathParity(fixture)
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

export function expectMutationToFail(corpusFile: string, scenario: string, mutate: (tempRoot: string) => void, pattern: RegExp): void {
  const tempRoot = mkdtempSync(path.join(tmpdir(), "fsr-corpus-"))
  cpSync(corpusRoot, tempRoot, { recursive: true })
  try {
    mutate(tempRoot)
    const result = spawnSync("node", [evaluatorPath, "--corpus", path.join(tempRoot, path.basename(corpusFile))], { encoding: "utf8" })
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
  return JSON.parse(readFileSync(filePath, "utf8")) as MutableCorpus
}

export function mutableFixture(filePath: string): MutableFixture {
  return JSON.parse(readFileSync(filePath, "utf8")) as MutableFixture
}

export function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function readFixture(filePath: string): Fixture {
  const fixture = readJson(filePath)
  assertFixture(fixture)
  return fixture
}

function readJson(filePath: string): unknown {
  return readJsonFromString(readFileSync(filePath, "utf8"))
}

function readJsonFromString(text: string): unknown {
  return JSON.parse(text)
}

function assertBaseCorpus(value: unknown): asserts value is BaseCorpus {
  if (!isRecord(value) || value.schemaVersion !== "filesystem-residue-corpus.1" || value.reportOnly !== true || value.sourceOnly !== true || value.enforcement !== false) {
    throw new TypeError("Invalid base corpus")
  }
  if (!isRecord(value.mutationPolicy) || value.mutationPolicy.kind !== "frozen" || value.mutationPolicy.successorSchemaVersion !== "filesystem-residue-corpus.2") {
    throw new TypeError("Invalid base corpus mutation policy")
  }
  if (!isRecord(value.preregistration) || !Array.isArray(value.records) || !isRecord(value.categoryLabels) || !Array.isArray(value.categories)) {
    throw new TypeError("Invalid base corpus shape")
  }
}

function assertSuccessor(value: unknown): asserts value is SuccessorCorpus {
  if (!isRecord(value) || value.schemaVersion !== "filesystem-residue-corpus.2" || value.reportOnly !== true || value.sourceOnly !== true || value.enforcement !== false) {
    throw new TypeError("Invalid successor corpus")
  }
  if (!isRecord(value.mutationPolicy) || value.mutationPolicy.kind !== "append-only-successor" || value.mutationPolicy.baseSchemaVersion !== "filesystem-residue-corpus.1" || typeof value.mutationPolicy.baseCorpusFingerprint !== "string") {
    throw new TypeError("Invalid successor mutation policy")
  }
  if (!isRecord(value.preregistration) || !Array.isArray(value.records) || !isRecord(value.categoryLabels) || !Array.isArray(value.categories)) {
    throw new TypeError("Invalid successor corpus shape")
  }
}

function assertRecord(value: unknown): asserts value is CorpusRecord {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.label !== "string" || typeof value.fixturePath !== "string" || typeof value.fixtureFingerprint !== "string" || !value.fixtureFingerprint.startsWith("sha256:") || typeof value.expectedResidue !== "boolean" || (value.category !== "likely-residue" && value.category !== "difficult-legitimate-untracked")) {
    throw new TypeError("Invalid corpus record")
  }
}

function assertFixture(value: unknown): asserts value is Fixture {
  if (!isRecord(value) || typeof value.fixtureId !== "string" || typeof value.label !== "string" || typeof value.expectedResidue !== "boolean" || (value.category !== "likely-residue" && value.category !== "difficult-legitimate-untracked") || !isRecord(value.gitStatus) || !Array.isArray(value.gitStatus.porcelainV1) || !Array.isArray(value.paths)) {
    throw new TypeError("Invalid fixture")
  }
}

function assertMeasurement(value: unknown): asserts value is Measurement {
  if (!isRecord(value) || typeof value.schemaVersion !== "string" || typeof value.corpusSchemaVersion !== "string" || value.reportOnly !== true || value.sourceOnly !== true || value.enforcement !== false) {
    throw new TypeError("Invalid measurement")
  }
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

function sameRecord(left: CorpusRecord, right: Fixture): boolean {
  return left.id === right.fixtureId && left.category === right.category && left.label === right.label && left.expectedResidue === right.expectedResidue
}

export function sha256(text: string): string {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
