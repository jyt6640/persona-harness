import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"

const corpusPath = resolveCorpusPath(process.argv.slice(2))
const corpusRoot = path.dirname(corpusPath)
const corpusText = readFileSync(corpusPath, "utf8")
const corpus = parseJsonString(corpusText, corpusPath)
assertCorpusShape(corpus)

const measurement = measureCorpus(corpusPath, corpusRoot, corpus, corpusText)
process.stdout.write(`${JSON.stringify(measurement, null, 2)}\n`)

function resolveCorpusPath(args) {
  const corpusIndex = args.indexOf("--corpus")
  if (corpusIndex === -1) {
    return path.join(process.cwd(), "experiments", "p2-e3-filesystem-residue-corpus", "corpus.json")
  }

  const value = args[corpusIndex + 1]
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError("--corpus requires a file path")
  }
  return path.resolve(process.cwd(), value)
}

function measureCorpus(corpusPath, corpusRoot, corpus, corpusText) {
  switch (corpus.schemaVersion) {
    case "filesystem-residue-corpus.1":
      return measureFrozenCorpus(corpusText, corpus, corpusRoot)
    case "filesystem-residue-corpus.2":
      return measureAppendOnlySuccessor(corpusPath, corpusRoot, corpusText, corpus)
    default:
      throw new TypeError(`Unsupported corpus schema: ${corpus.schemaVersion}`)
  }
}

function measureFrozenCorpus(corpusText, corpus, corpusRoot) {
  assertFrozenCorpus(corpus)
  verifyRecords(corpus.records, corpusRoot)

  return {
    schemaVersion: "filesystem-residue-measurement.1",
    corpusSchemaVersion: "filesystem-residue-corpus.1",
    corpusFingerprint: fingerprint(corpusText),
    reportOnly: true,
    sourceOnly: true,
    enforcement: false,
  }
}

function measureAppendOnlySuccessor(corpusPath, corpusRoot, corpusText, corpus) {
  assertSuccessorCorpus(corpus)
  const basePath = path.join(corpusRoot, "corpus.json")
  const baseText = readFileSync(basePath, "utf8")
  const base = parseJsonString(baseText, basePath)
  assertFrozenCorpus(base)
  verifyRecords(base.records, corpusRoot)
  verifyAppendOnlySuccessor(base, corpus, corpusRoot)

  return {
    schemaVersion: "filesystem-residue-measurement.2",
    corpusSchemaVersion: "filesystem-residue-corpus.2",
    corpusFingerprint: fingerprint(corpusText),
    baseCorpusFingerprint: fingerprint(baseText),
    reportOnly: true,
    sourceOnly: true,
    enforcement: false,
  }
}

function verifyRecords(records, corpusRoot) {
  const coverage = {
    "difficult-legitimate-untracked": 0,
    "likely-residue": 0,
  }
  const seenIds = new Set()

  for (const record of records) {
    assertRecord(record)
    if (seenIds.has(record.id)) {
      throw new TypeError(`Duplicate record id: ${record.id}`)
    }
    seenIds.add(record.id)
    coverage[record.category] += 1

    const fixturePath = path.join(corpusRoot, record.fixturePath)
    const fixtureText = readFileSync(fixturePath, "utf8")
    const fixture = parseJsonString(fixtureText, fixturePath)
    assertFixture(fixture)

    if (!sameRecord(record, fixture)) {
      throw new TypeError(`Fixture mismatch: ${record.id}`)
    }
    if (record.fixtureFingerprint !== fingerprint(fixtureText)) {
      throw new TypeError(`Fixture fingerprint mismatch: ${record.id}`)
    }
    ensureStatusAndPathParity(fixture)
  }

  if (coverage["likely-residue"] !== 5 || coverage["difficult-legitimate-untracked"] !== 5) {
    throw new TypeError("Unexpected category coverage")
  }
}

function verifyAppendOnlySuccessor(base, successor, corpusRoot) {
  if (successor.mutationPolicy.baseSchemaVersion !== base.schemaVersion) {
    throw new TypeError("Successor base schema binding mismatch")
  }
  if (successor.mutationPolicy.baseCorpusFingerprint !== fingerprint(readFileSync(path.join(corpusRoot, "corpus.json"), "utf8"))) {
    throw new TypeError("Successor base fingerprint mismatch")
  }
  if (successor.records.length !== base.records.length + 1) {
    throw new TypeError("Unexpected successor record count")
  }

  for (let index = 0; index < base.records.length; index += 1) {
    if (JSON.stringify(base.records[index]) !== JSON.stringify(successor.records[index])) {
      throw new TypeError(`Successor base prefix mismatch: ${index}`)
    }
  }

  const appended = successor.records[base.records.length]
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
  const fixtureText = readFileSync(fixturePath, "utf8")
  const fixture = parseJsonString(fixtureText, fixturePath)
  assertFixture(fixture)
  if (!sameRecord(appended, fixture) || appended.fixtureFingerprint !== fingerprint(fixtureText)) {
    throw new TypeError("Successor appended fixture mismatch")
  }
  ensureStatusAndPathParity(fixture)
}

function assertCorpusShape(value) {
  if (!isRecord(value) || typeof value.schemaVersion !== "string" || !Array.isArray(value.records)) {
    throw new TypeError("Invalid corpus shape")
  }
}

function assertFrozenCorpus(value) {
  if (!isRecord(value) || value.schemaVersion !== "filesystem-residue-corpus.1" || value.reportOnly !== true || value.sourceOnly !== true || value.enforcement !== false) {
    throw new TypeError("Invalid frozen corpus")
  }
  if (!isRecord(value.mutationPolicy) || value.mutationPolicy.kind !== "frozen" || value.mutationPolicy.successorSchemaVersion !== "filesystem-residue-corpus.2") {
    throw new TypeError("Invalid frozen mutation policy")
  }
  if (!isRecord(value.preregistration) || !isRecord(value.categoryLabels) || !Array.isArray(value.categories)) {
    throw new TypeError("Invalid frozen corpus payload")
  }
  if (value.records.length !== 10) {
    throw new TypeError("Unexpected frozen record count")
  }
}

function assertSuccessorCorpus(value) {
  if (!isRecord(value) || value.schemaVersion !== "filesystem-residue-corpus.2" || value.reportOnly !== true || value.sourceOnly !== true || value.enforcement !== false) {
    throw new TypeError("Invalid successor corpus")
  }
  if (!isRecord(value.mutationPolicy) || value.mutationPolicy.kind !== "append-only-successor" || value.mutationPolicy.baseSchemaVersion !== "filesystem-residue-corpus.1" || typeof value.mutationPolicy.baseCorpusFingerprint !== "string") {
    throw new TypeError("Invalid successor mutation policy")
  }
  if (!isRecord(value.preregistration) || !isRecord(value.categoryLabels) || !Array.isArray(value.categories)) {
    throw new TypeError("Invalid successor corpus payload")
  }
  if (value.records.length !== 11) {
    throw new TypeError("Unexpected successor record count")
  }
}

function assertRecord(value) {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.label !== "string" || typeof value.fixturePath !== "string" || typeof value.fixtureFingerprint !== "string" || !value.fixtureFingerprint.startsWith("sha256:") || typeof value.expectedResidue !== "boolean" || (value.category !== "likely-residue" && value.category !== "difficult-legitimate-untracked")) {
    throw new TypeError("Invalid record")
  }
}

function assertFixture(value) {
  if (!isRecord(value) || typeof value.fixtureId !== "string" || typeof value.label !== "string" || typeof value.expectedResidue !== "boolean" || (value.category !== "likely-residue" && value.category !== "difficult-legitimate-untracked") || !isRecord(value.gitStatus) || !Array.isArray(value.gitStatus.porcelainV1) || !Array.isArray(value.paths)) {
    throw new TypeError("Invalid fixture")
  }
}

function ensureStatusAndPathParity(fixture) {
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

function sameRecord(left, right) {
  return left.id === right.fixtureId && left.category === right.category && left.label === right.label && left.expectedResidue === right.expectedResidue
}

function parseJsonString(text, filePath) {
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new TypeError(`Invalid JSON in ${filePath}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function fingerprint(text) {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
