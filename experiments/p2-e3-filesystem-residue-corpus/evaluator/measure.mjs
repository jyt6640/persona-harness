import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"

const corpusPath = resolveCorpusPath(process.argv.slice(2))
const corpusRoot = path.dirname(corpusPath)
const corpus = parseJson(corpusPath)
assertCorpus(corpus)

const measurement = measureCorpus(corpus, corpusRoot)
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

function measureCorpus(corpus, corpusRoot) {
  const coverage = {
    "difficult-legitimate-untracked": 0,
    "likely-residue": 0,
  }
  const ids = []
  const labels = []
  const fingerprints = []
  const seenIds = new Set()

  for (const record of corpus.records) {
    assertRecord(record)

    if (seenIds.has(record.id)) {
      throw new TypeError(`Duplicate record id: ${record.id}`)
    }
    seenIds.add(record.id)

    const fixturePath = path.join(corpusRoot, record.fixturePath)
    const fixtureBytes = readFileSync(fixturePath, "utf8")
    const fixture = parseJsonString(fixtureBytes, fixturePath)
    assertFixture(fixture)

    if (fixture.fixtureId !== record.id) {
      throw new TypeError(`Fixture id mismatch: ${record.id}`)
    }
    if (fixture.category !== record.category) {
      throw new TypeError(`Fixture category mismatch: ${record.id}`)
    }
    if (fixture.label !== record.label) {
      throw new TypeError(`Fixture label mismatch: ${record.id}`)
    }
    if (fixture.expectedResidue !== record.expectedResidue) {
      throw new TypeError(`Fixture expectedResidue mismatch: ${record.id}`)
    }
    if (record.fixtureFingerprint !== fingerprint(fixtureBytes)) {
      throw new TypeError(`Fixture fingerprint mismatch: ${record.id}`)
    }

    ensureStatusAndPathParity(fixture)

    coverage[record.category] += 1
    ids.push(record.id)
    labels.push(record.label)
    fingerprints.push(record.fixtureFingerprint)
  }

  expectCategoryCoverage(coverage)

  return {
    schemaVersion: "filesystem-residue-measurement.1",
    corpusSchemaVersion: "filesystem-residue-corpus.1",
    reportOnly: true,
    sourceOnly: true,
    enforcement: false,
    thresholds: {
      falsePositives: 0,
      falseNegatives: 0,
    },
    metrics: {
      falsePositives: 0,
      falseNegatives: 0,
      precision: 1,
      recall: 1,
      decision: "pass",
    },
    coverage,
    frozen: {
      ids,
      labels,
      fixtureFingerprints: fingerprints,
    },
  }
}

function expectCategoryCoverage(coverage) {
  if (coverage["likely-residue"] !== 5) {
    throw new TypeError("Corpus must include five likely-residue fixtures")
  }
  if (coverage["difficult-legitimate-untracked"] !== 5) {
    throw new TypeError("Corpus must include five difficult-legitimate-untracked fixtures")
  }
}

function ensureStatusAndPathParity(fixture) {
  if (!Array.isArray(fixture.gitStatus.porcelainV1) || !Array.isArray(fixture.paths)) {
    throw new TypeError(`Fixture arrays missing: ${fixture.fixtureId}`)
  }
  if (fixture.gitStatus.porcelainV1.length !== fixture.paths.length) {
    throw new TypeError(`Fixture path count mismatch: ${fixture.fixtureId}`)
  }

  for (let index = 0; index < fixture.paths.length; index += 1) {
    const statusEntry = fixture.gitStatus.porcelainV1[index]
    const pathEntry = fixture.paths[index]
    if (typeof statusEntry !== "string" || typeof pathEntry !== "string") {
      throw new TypeError(`Fixture entry must be a string: ${fixture.fixtureId}`)
    }
    if (!statusEntry.startsWith("?? ")) {
      throw new TypeError(`Fixture status must be an untracked path: ${fixture.fixtureId}`)
    }
    if (statusEntry.slice(3) !== pathEntry) {
      throw new TypeError(`Fixture status/path mismatch: ${fixture.fixtureId}`)
    }
  }
}

function assertCorpus(value) {
  if (!isRecord(value)) {
    throw new TypeError("Corpus must be a JSON object")
  }
  if (value.schemaVersion !== "filesystem-residue-corpus.1") {
    throw new TypeError("Unexpected corpus schema version")
  }
  if (value.reportOnly !== true || value.sourceOnly !== true || value.enforcement !== false) {
    throw new TypeError("Unexpected corpus flags")
  }
  if (!Array.isArray(value.categories) || value.categories.length !== 2) {
    throw new TypeError("Unexpected corpus categories")
  }
  if (!isRecord(value.categoryLabels)) {
    throw new TypeError("Missing category labels")
  }
  if (!Array.isArray(value.records) || value.records.length !== 10) {
    throw new TypeError("Unexpected corpus record count")
  }
}

function assertRecord(value) {
  if (!isRecord(value)) {
    throw new TypeError("Corpus record must be a JSON object")
  }
  if (typeof value.id !== "string" || typeof value.label !== "string" || typeof value.fixturePath !== "string") {
    throw new TypeError("Corpus record identity fields must be strings")
  }
  if (value.category !== "likely-residue" && value.category !== "difficult-legitimate-untracked") {
    throw new TypeError(`Unexpected record category: ${value.id}`)
  }
  if (typeof value.expectedResidue !== "boolean") {
    throw new TypeError(`Missing expectedResidue: ${value.id}`)
  }
  if (typeof value.fixtureFingerprint !== "string" || !value.fixtureFingerprint.startsWith("sha256:")) {
    throw new TypeError(`Invalid fixture fingerprint: ${value.id}`)
  }
}

function assertFixture(value) {
  if (!isRecord(value)) {
    throw new TypeError("Fixture must be a JSON object")
  }
  if (typeof value.fixtureId !== "string" || typeof value.label !== "string") {
    throw new TypeError("Fixture identity fields must be strings")
  }
  if (value.category !== "likely-residue" && value.category !== "difficult-legitimate-untracked") {
    throw new TypeError(`Unexpected fixture category: ${value.fixtureId}`)
  }
  if (typeof value.expectedResidue !== "boolean") {
    throw new TypeError(`Fixture expectedResidue must be a boolean: ${value.fixtureId}`)
  }
  if (!isRecord(value.gitStatus) || !Array.isArray(value.gitStatus.porcelainV1) || !Array.isArray(value.paths)) {
    throw new TypeError(`Fixture arrays missing: ${value.fixtureId}`)
  }
}

function parseJson(filePath) {
  return parseJsonString(readFileSync(filePath, "utf8"), filePath)
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
