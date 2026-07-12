import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const directory = dirname(fileURLToPath(import.meta.url))
const ruleIds = ["E1-A1", "E1-A2"]
const frozenFields = ["id", "ruleId", "expectedWarning", "category", "fixture", "anchor"]

if (isDirectExecution()) {
  main()
}

function main() {
  try {
    const options = parseArguments(process.argv.slice(2))
    const corpusPath = options.corpusPath ?? resolve(directory, "corpus.json")
    const corpus = readJson(corpusPath)
    const validation = validateCorpus(corpus, dirname(corpusPath))

    if (options.validateOnly) {
      writeOutput({
        schemaVersion: corpus.evaluationContract.outputSchemaVersion,
        mode: "validate",
        corpusId: corpus.corpusId,
        frozenLabelSetSha256: validation.frozenLabelSetSha256,
        validation,
        decision: "pass",
        boundary: corpus.boundary,
      })
      return
    }

    const candidatePath = options.candidatePath ?? resolve(dirname(corpusPath), "reference-evaluation.json")
    const candidate = readJson(candidatePath)
    const measurement = measureCandidate(corpus, candidate, validation)
    writeOutput({
      schemaVersion: corpus.evaluationContract.outputSchemaVersion,
      mode: "measure",
      corpusId: corpus.corpusId,
      frozenLabelSetSha256: validation.frozenLabelSetSha256,
      candidate: {
        id: candidate.candidateId ?? "external-candidate",
        kind: candidate.candidateKind ?? "external-candidate",
      },
      validation,
      measurement,
      decision: measurement.decision,
      boundary: corpus.boundary,
    })
    process.exitCode = measurement.decision === "pass" ? 0 : 1
  } catch (error) {
    process.stderr.write(`P2 E1 test-integrity corpus error: ${errorMessage(error)}\n`)
    process.exitCode = 1
  }
}

function parseArguments(args) {
  let candidatePath
  let corpusPath
  let validateOnly = false

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === "--validate") {
      validateOnly = true
      continue
    }
    if (argument === "--candidate" || argument === "--corpus") {
      const value = args[index + 1]
      if (typeof value !== "string" || value.length === 0) {
        throw new Error(`${argument} requires a path`)
      }
      if (argument === "--candidate") candidatePath = resolve(process.cwd(), value)
      if (argument === "--corpus") corpusPath = resolve(process.cwd(), value)
      index += 1
      continue
    }
    throw new Error(`Unknown argument: ${argument}`)
  }

  if (validateOnly && candidatePath !== undefined) {
    throw new Error("--validate cannot be combined with --candidate")
  }

  return { candidatePath, corpusPath, validateOnly }
}

function readJson(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`)
  }
  try {
    return JSON.parse(readFileSync(filePath, "utf8"))
  } catch (error) {
    throw new Error(`Invalid JSON at ${filePath}: ${errorMessage(error)}`)
  }
}

export function validateCorpus(corpus, corpusDirectory) {
  const value = objectValue(corpus, "corpus")
  const records = arrayValue(value.records, "corpus.records")
  const coverage = objectValue(value.coverage, "corpus.coverage")
  const mutationPolicy = objectValue(value.mutationPolicy, "corpus.mutationPolicy")
  const evaluationContract = objectValue(value.evaluationContract, "corpus.evaluationContract")

  requireString(value.schemaVersion, "corpus.schemaVersion")
  requireString(value.corpusId, "corpus.corpusId")
  if (value.languagePolicy !== "bilingual-free-java-structural") {
    throw new Error("corpus.languagePolicy must be bilingual-free-java-structural")
  }
  if (value.boundary !== "Results are corpus-only. They are not product-quality evidence and do not authorize warnings to force, block, promote, or change defaults.") {
    throw new Error("corpus.boundary must preserve the corpus-only non-authorization statement")
  }
  if (evaluationContract.candidateSchemaVersion !== "p2-e1-test-integrity-evaluation.1") {
    throw new Error("corpus.evaluationContract.candidateSchemaVersion is invalid")
  }
  if (evaluationContract.outputSchemaVersion !== "p2-e1-test-integrity-measurement.1") {
    throw new Error("corpus.evaluationContract.outputSchemaVersion is invalid")
  }

  const ids = new Set()
  const anchors = new Set()
  const fixturePaths = new Set()
  const recordsByRule = new Map(ruleIds.map((ruleId) => [ruleId, { positive: 0, negative: 0 }]))
  const categories = new Set()

  for (const record of records) {
    const checkedRecord = objectValue(record, "corpus.records[]")
    const id = requireString(checkedRecord.id, "corpus.records[].id")
    const ruleId = requireString(checkedRecord.ruleId, `record ${id}.ruleId`)
    const category = requireString(checkedRecord.category, `record ${id}.category`)
    const fixture = requireString(checkedRecord.fixture, `record ${id}.fixture`)
    const anchor = requireString(checkedRecord.anchor, `record ${id}.anchor`)

    if (!/^e1-a[12]-(?:pos|neg)-[a-z0-9-]+-\d{3}$/u.test(id)) {
      throw new Error(`record id is not stable: ${id}`)
    }
    if (!ruleIds.includes(ruleId)) {
      throw new Error(`record ${id} has unsupported ruleId ${ruleId}`)
    }
    if (typeof checkedRecord.expectedWarning !== "boolean") {
      throw new Error(`record ${id}.expectedWarning must be boolean`)
    }
    if (!fixture.startsWith("fixtures/") || fixture.includes("..") || !fixture.endsWith(".java")) {
      throw new Error(`record ${id}.fixture must name a local Java fixture`)
    }
    if (!anchor.startsWith("P2E1_CASE:")) {
      throw new Error(`record ${id}.anchor must be a P2E1 case marker`)
    }
    if (ids.has(id)) throw new Error(`duplicate record id: ${id}`)
    if (anchors.has(anchor)) throw new Error(`duplicate record anchor: ${anchor}`)
    ids.add(id)
    anchors.add(anchor)
    fixturePaths.add(fixture)
    categories.add(category)

    const fixturePath = resolve(corpusDirectory, fixture)
    if (!existsSync(fixturePath)) throw new Error(`record ${id} fixture is missing: ${fixture}`)
    if (!readFileSync(fixturePath, "utf8").includes(anchor)) {
      throw new Error(`record ${id} fixture does not contain its anchor`)
    }

    const ruleCount = recordsByRule.get(ruleId)
    if (ruleCount === undefined) throw new Error(`record ${id} cannot be counted`)
    if (checkedRecord.expectedWarning) ruleCount.positive += 1
    else ruleCount.negative += 1
  }

  if (records.length !== coverage.expectedCaseCount) {
    throw new Error(`corpus expectedCaseCount ${coverage.expectedCaseCount} does not match ${records.length}`)
  }
  const expectedByRule = objectValue(coverage.expectedByRule, "corpus.coverage.expectedByRule")
  for (const ruleId of ruleIds) {
    const expected = objectValue(expectedByRule[ruleId], `corpus.coverage.expectedByRule.${ruleId}`)
    const actual = recordsByRule.get(ruleId)
    if (actual === undefined || actual.positive !== expected.positive || actual.negative !== expected.negative) {
      throw new Error(`corpus coverage for ${ruleId} does not match preregistration`)
    }
  }
  const requiredCategories = arrayValue(coverage.requiredCategories, "corpus.coverage.requiredCategories")
  for (const category of requiredCategories) {
    if (typeof category !== "string" || !categories.has(category)) {
      throw new Error(`required category is absent: ${String(category)}`)
    }
  }
  if (categories.size !== requiredCategories.length) {
    throw new Error("corpus contains an unregistered category or duplicate required category")
  }

  if (mutationPolicy.evaluationState !== "preregistered-unmeasured") {
    throw new Error("corpus mutation policy must remain preregistered-unmeasured")
  }
  if (mutationPolicy.noRelabelAfterEvaluation !== true) {
    throw new Error("corpus mutation policy must prohibit relabeling after evaluation")
  }
  if (!sameStringArray(mutationPolicy.frozenFields, frozenFields)) {
    throw new Error("corpus mutation policy frozen fields do not match the contract")
  }

  const frozenLabelSetSha256 = fingerprintFrozenLabels(value)
  if (mutationPolicy.frozenLabelSetSha256 !== frozenLabelSetSha256) {
    throw new Error("corpus frozen label fingerprint does not match its records")
  }
  const fixtureSha256 = objectValue(mutationPolicy.fixtureSha256, "corpus.mutationPolicy.fixtureSha256")
  if (!sameStringSet(Object.keys(fixtureSha256), [...fixturePaths])) {
    throw new Error("corpus fixture fingerprint paths do not match its records")
  }
  for (const fixture of fixturePaths) {
    const expectedFingerprint = fixtureSha256[fixture]
    const actualFingerprint = sha256(readFileSync(resolve(corpusDirectory, fixture), "utf8"))
    if (expectedFingerprint !== actualFingerprint) {
      throw new Error(`fixture fingerprint mismatch: ${fixture}`)
    }
  }

  return {
    decision: "pass",
    caseCount: records.length,
    byRule: Object.fromEntries(recordsByRule),
    categories: [...categories].sort(),
    frozenLabelSetSha256,
    fixtureSha256,
  }
}

export function measureCandidate(corpus, candidate, validation) {
  const candidateValue = objectValue(candidate, "candidate")
  if (candidateValue.schemaVersion !== corpus.evaluationContract.candidateSchemaVersion) {
    throw new Error("candidate schemaVersion does not match the preregistration")
  }
  if (candidateValue.corpusId !== corpus.corpusId) {
    throw new Error("candidate corpusId does not match the preregistration")
  }
  if (candidateValue.frozenLabelSetSha256 !== validation.frozenLabelSetSha256) {
    throw new Error("candidate frozen label fingerprint does not match the preregistration")
  }

  const records = corpus.records
  const recordsById = new Map(records.map((record) => [record.id, record]))
  const evaluatedCaseIds = arrayValue(candidateValue.evaluatedCaseIds, "candidate.evaluatedCaseIds")
  if (!sameStringSet(evaluatedCaseIds, [...recordsById.keys()])) {
    throw new Error("candidate evaluatedCaseIds must cover every preregistered record exactly once")
  }

  const findings = arrayValue(candidateValue.findings, "candidate.findings")
  const findingKeys = new Set()
  const actualKeysByRule = new Map(ruleIds.map((ruleId) => [ruleId, new Set()]))

  for (const finding of findings) {
    const checkedFinding = objectValue(finding, "candidate.findings[]")
    const caseId = requireString(checkedFinding.caseId, "candidate.findings[].caseId")
    const ruleId = requireString(checkedFinding.ruleId, `candidate finding ${caseId}.ruleId`)
    const record = recordsById.get(caseId)
    if (record === undefined) throw new Error(`candidate finding references unknown case: ${caseId}`)
    if (record.ruleId !== ruleId) throw new Error(`candidate finding rule does not match case: ${caseId}`)
    const key = `${caseId}:${ruleId}`
    if (findingKeys.has(key)) throw new Error(`candidate has duplicate finding: ${key}`)
    findingKeys.add(key)
    actualKeysByRule.get(ruleId).add(caseId)
  }

  const results = ruleIds.map((ruleId) => {
    const ruleRecords = records.filter((record) => record.ruleId === ruleId)
    const expectedCaseIds = new Set(ruleRecords.filter((record) => record.expectedWarning).map((record) => record.id))
    const actualCaseIds = actualKeysByRule.get(ruleId)
    const truePositives = countSetIntersection(expectedCaseIds, actualCaseIds)
    const falsePositives = countSetDifference(actualCaseIds, expectedCaseIds)
    const falseNegatives = countSetDifference(expectedCaseIds, actualCaseIds)
    const trueNegatives = ruleRecords.filter((record) => !record.expectedWarning).length - falsePositives
    const precision = ratio(truePositives, truePositives + falsePositives)
    const recall = ratio(truePositives, truePositives + falseNegatives)
    const thresholds = corpus.evaluationContract.thresholds.perRule[ruleId]
    const decision =
      precision >= thresholds.minimumPrecision &&
      recall >= thresholds.minimumRecall &&
      falsePositives <= thresholds.maximumFalsePositives &&
      falseNegatives <= thresholds.maximumFalseNegatives
        ? "pass"
        : "fail"

    return {
      ruleId,
      caseCount: ruleRecords.length,
      truePositives,
      trueNegatives,
      falsePositives,
      falseNegatives,
      precision,
      recall,
      thresholds,
      decision,
    }
  })

  const overallTruePositives = results.reduce((sum, result) => sum + result.truePositives, 0)
  const overallFalsePositives = results.reduce((sum, result) => sum + result.falsePositives, 0)
  const overallFalseNegatives = results.reduce((sum, result) => sum + result.falseNegatives, 0)
  const overall = {
    caseCount: records.length,
    evaluatedCaseCount: evaluatedCaseIds.length,
    coverage: evaluatedCaseIds.length / records.length,
    truePositives: overallTruePositives,
    falsePositives: overallFalsePositives,
    falseNegatives: overallFalseNegatives,
    precision: ratio(overallTruePositives, overallTruePositives + overallFalsePositives),
    recall: ratio(overallTruePositives, overallTruePositives + overallFalseNegatives),
  }
  const decision =
    overall.coverage >= corpus.evaluationContract.thresholds.minimumCoverage &&
    results.every((result) => result.decision === "pass")
      ? "pass"
      : "fail"

  return { results, overall, decision }
}

function fingerprintFrozenLabels(corpus) {
  const labelPayload = {
    corpusId: corpus.corpusId,
    schemaVersion: corpus.schemaVersion,
    records: corpus.records.map((record) =>
      Object.fromEntries(frozenFields.map((field) => [field, record[field]])),
    ),
  }
  return sha256(stableJson(labelPayload))
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`
  }
  return JSON.stringify(value)
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`
}

function objectValue(value, name) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${name} must be an object`)
  }
  return value
}

function arrayValue(value, name) {
  if (!Array.isArray(value)) throw new Error(`${name} must be an array`)
  return value
}

function requireString(value, name) {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${name} must be a non-empty string`)
  return value
}

function sameStringArray(value, expected) {
  return Array.isArray(value) && value.length === expected.length && value.every((item, index) => item === expected[index])
}

function sameStringSet(value, expected) {
  if (!Array.isArray(value) || value.length !== expected.length) return false
  const actual = new Set(value)
  return actual.size === value.length && expected.every((item) => actual.has(item))
}

function countSetIntersection(left, right) {
  return [...left].filter((value) => right.has(value)).length
}

function countSetDifference(left, right) {
  return [...left].filter((value) => !right.has(value)).length
}

function ratio(numerator, denominator) {
  return denominator === 0 ? 1 : numerator / denominator
}

function writeOutput(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

function isDirectExecution() {
  const invokedPath = process.argv[1]
  return typeof invokedPath === "string" && resolve(invokedPath) === fileURLToPath(import.meta.url)
}
