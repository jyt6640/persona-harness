import {
  error,
  isRecord,
  parseJson,
  readJson,
  readText,
  readTextAt,
  resolveSafe,
  sameJson,
  sha256,
} from "./io.mjs"

export const EXPECTED_LOCK_SHA256 = "sha256:d9afb29665fb32cb93c813a939a5e1b172d4674f9dcf2205e16bee9fdaddfe22"
export const BASE_SCHEMA = "filesystem-residue-corpus.1"
export const SUCCESSOR_SCHEMA = "filesystem-residue-corpus.2"

const FACTS = {
  authorityEligible: false,
  childProcessInvocations: 0,
  enforcement: false,
  networkAccess: false,
  productCliInvocations: 0,
  realProjectAccess: false,
  reportOnly: true,
  writeOperations: 0,
}

export function validateCorpus(root, selection = "all") {
  const errors = []
  const lockFile = readJson(root, "canonical-lock.json", errors, "canonical-lock.json")
  if (lockFile === undefined) return result(selection, errors)
  if (lockFile.schemaVersion !== "filesystem-residue-canonical-lock.1" || lockFile.corpusId !== "filesystem-residue-report") {
    error(errors, "LOCK_SHAPE", "canonical-lock.json", "canonical lock shape is invalid")
  }

  const lockText = readText(root, "canonical-lock.json", errors, "canonical-lock.json")
  if (lockText !== undefined && sha256(lockText) !== EXPECTED_LOCK_SHA256) {
    error(errors, "CANONICAL_LOCK_DRIFT", "canonical-lock.json", "canonical lock bytes differ from the immutable reference")
  }

  if (selection !== "base" && selection !== "successor" && selection !== "all") {
    error(errors, "SELECTION_INVALID", "selection", "selection must be base, successor, or all")
  }

  let base
  if (selection === "base" || selection === "successor" || selection === "all") {
    base = validateBase(root, lockFile, errors)
  }
  if (selection === "successor" || selection === "all") {
    validateSuccessor(root, lockFile, base, errors)
  }
  return result(selection, errors)
}

export function evaluateCorpus(root, selection = "all") {
  const validation = validateCorpus(root, selection)
  if (!validation.ok) {
    return { ...validation, decision: "invalid-corpus" }
  }

  const counts = {}
  const variants = selection === "base" ? ["base"] : selection === "successor" ? ["successor"] : ["base", "successor"]
  for (const variant of variants) {
    const corpus = readJson(root, variant === "base" ? "corpus.json" : "successor.json", [], variant)
    if (corpus === undefined) continue
    counts[`${variant}RecordCount`] = Array.isArray(corpus.records) ? corpus.records.length : 0
  }
  return {
    ...validation,
    decision: "report-only-diagnostic",
    ...counts,
    note: "Synthetic residue classification is diagnostic-only and not workflow authority.",
  }
}

function validateBase(root, lock, errors) {
  const corpus = readCorpus(root, "corpus.json", BASE_SCHEMA, lock?.base, errors)
  if (corpus === undefined) return undefined
  if (corpus.records.length !== 4) {
    error(errors, "BASE_APPEND_FORBIDDEN", "corpus.records", "frozen base record count changed")
  }
  validateRecords(root, corpus, lock?.base, errors)
  validateSemantic(corpus, lock?.base, "base", errors)
  return corpus
}

function validateSuccessor(root, lock, base, errors) {
  const corpus = readCorpus(root, "successor.json", SUCCESSOR_SCHEMA, lock?.successor, errors)
  if (corpus === undefined) return undefined
  if (corpus.records.length !== 5) {
    error(errors, "SUCCESSOR_RECORD_COUNT", "successor.records", "successor must contain the four-record base prefix and one fresh record")
  }

  const lineage = corpus.lineage
  const expectedBase = lock?.base?.corpusSemanticSha256
  if (!isRecord(lineage) || lineage.baseSchemaVersion !== BASE_SCHEMA || lineage.baseCorpusId !== "filesystem-residue-report" || lineage.baseSemanticSha256 !== expectedBase || lineage.baseRecordCount !== 4 || lineage.appendMode !== "one-preregistered-record") {
    error(errors, "SUCCESSOR_LINEAGE_MISMATCH", "successor.lineage", "successor lineage is not bound to the canonical base")
  }

  if (base !== undefined && Array.isArray(base.records)) {
    for (let index = 0; index < Math.min(base.records.length, corpus.records.length); index += 1) {
      if (!sameJson(base.records[index], corpus.records[index])) {
        error(errors, "SUCCESSOR_PREFIX_MISMATCH", `successor.records[${index}]`, "successor changed the ordered base prefix")
      }
    }
  }
  validateRecords(root, corpus, lock?.successor, errors)

  const appended = corpus.records[4]
  if (isRecord(appended) && Array.isArray(base?.records)) {
    const baseIds = new Set(base.records.map((record) => record.id))
    const basePaths = new Set(base.records.map((record) => record.fixturePath))
    if (baseIds.has(appended.id)) error(errors, "DUPLICATE_RECORD_ID", "successor.records[4].id", "successor reused a base record ID")
    if (basePaths.has(appended.fixturePath)) error(errors, "DUPLICATE_FIXTURE_PATH", "successor.records[4].fixturePath", "successor reused a base fixture path")
  }
  validateSemantic(corpus, lock?.successor, "successor", errors)
  return corpus
}

function readCorpus(root, fileName, schema, lockSection, errors) {
  const corpus = readJson(root, fileName, errors, fileName)
  if (corpus === undefined) return undefined
  if (!isRecord(corpus) || corpus.schemaVersion !== schema || corpus.corpusId !== "filesystem-residue-report") {
    error(errors, "CORPUS_SHAPE", fileName, "corpus schema or identity is invalid")
    return undefined
  }
  if (corpus.canonicalLockSha256 !== EXPECTED_LOCK_SHA256) {
    error(errors, "CANONICAL_LOCK_BINDING", `${fileName}.canonicalLockSha256`, "corpus is not bound to the canonical lock")
  }
  if (!isRecord(lockSection)) error(errors, "LOCK_SECTION_MISSING", fileName, "canonical lock section is missing")
  return corpus
}

function validateRecords(root, corpus, lockSection, errors) {
  if (!Array.isArray(corpus.records) || !isRecord(lockSection)) return
  const expectedIds = Array.isArray(lockSection.orderedRecordIds) ? lockSection.orderedRecordIds : []
  const expectedRecords = Array.isArray(lockSection.records) ? lockSection.records : []
  const expectedFixtures = new Map((Array.isArray(lockSection.fixtureFiles) ? lockSection.fixtureFiles : []).filter(isRecord).map((file) => [file.path, file.sha256]))
  const seenIds = new Set()
  const seenPaths = new Set()

  for (let index = 0; index < corpus.records.length; index += 1) {
    const record = corpus.records[index]
    if (!isRecord(record)) {
      error(errors, "RECORD_SHAPE", `records[${index}]`, "record must be an object")
      continue
    }
    if (typeof record.id !== "string" || typeof record.fixturePath !== "string") {
      error(errors, "RECORD_SHAPE", `records[${index}]`, "record ID and fixture path are required")
      continue
    }
    if (seenIds.has(record.id)) error(errors, "DUPLICATE_RECORD_ID", `records[${index}].id`, "record ID is duplicated")
    if (seenPaths.has(record.fixturePath)) error(errors, "DUPLICATE_FIXTURE_PATH", `records[${index}].fixturePath`, "fixture path is duplicated")
    seenIds.add(record.id)
    seenPaths.add(record.fixturePath)
    if (expectedIds[index] !== record.id) error(errors, "ORDER_OR_ID_DRIFT", `records[${index}].id`, "record order or ID differs from the canonical lock")

    const absolute = resolveSafe(root, record.fixturePath, errors, `records[${index}].fixturePath`)
    if (absolute === undefined) continue
    const fixtureText = readTextAt(absolute, record.fixturePath, errors)
    if (fixtureText === undefined) continue
    const fixture = parseJson(fixtureText, record.fixturePath, errors)
    if (!isRecord(fixture)) continue
    const actualHash = sha256(fixtureText)
    if (record.fixtureSha256 !== actualHash || expectedFixtures.get(record.fixturePath) !== actualHash) {
      error(errors, "FIXTURE_HASH", record.fixturePath, "fixture bytes do not match the canonical hash")
    }
    if (fixture.fixtureId !== record.id || fixture.kind !== "filesystem-residue" || fixture.category !== record.category || fixture.label !== record.label || fixture.expectedResidue !== record.expectedResidue || fixture.pathSafety !== "relative-no-follow") {
      error(errors, "FIXTURE_RECORD_MISMATCH", record.fixturePath, "fixture semantics do not match the corpus record")
    }
    if (!Array.isArray(fixture.syntheticStatus) || !Array.isArray(fixture.paths) || fixture.syntheticStatus.length !== fixture.paths.length || fixture.syntheticStatus.some((status, pathIndex) => typeof status !== "string" || !status.startsWith("?? ") || status.slice(3) !== fixture.paths[pathIndex])) {
      error(errors, "FIXTURE_STATUS_MISMATCH", record.fixturePath, "synthetic status and path lists differ")
    }
  }
  if (expectedRecords.length !== corpus.records.length || expectedRecords.some((record, index) => !sameJson(record, corpus.records[index]))) {
    error(errors, "CANONICAL_SEMANTICS_MISMATCH", "records", "record metadata differs from the canonical lock")
  }
}

function validateSemantic(corpus, lockSection, variant, errors) {
  if (!isRecord(lockSection)) return
  const projection = semanticProjection(corpus, variant)
  const expected = expectedProjection(lockSection, variant)
  if (!sameJson(projection, expected) || sha256(JSON.stringify(projection)) !== lockSection.corpusSemanticSha256) {
    error(errors, "CANONICAL_SEMANTICS_MISMATCH", variant, "corpus semantics differ from the immutable canonical lock")
  }
}

function semanticProjection(corpus, variant) {
  const projection = { ...corpus }
  delete projection.canonicalLockSha256
  return projection
}

function expectedProjection(section, variant) {
  const metadata = section.metadata
  const projection = {
    schemaVersion: section.schemaVersion,
    corpusId: "filesystem-residue-report",
    reportOnly: metadata?.reportOnly,
    sourceOnly: metadata?.sourceOnly,
    enforcement: metadata?.enforcement,
    authorityEligible: metadata?.authorityEligible,
    childProcessInvocations: metadata?.childProcessInvocations,
    productCliInvocations: metadata?.productCliInvocations,
    networkAccess: metadata?.networkAccess,
    realProjectAccess: metadata?.realProjectAccess,
    writeOperations: metadata?.writeOperations,
    payloadRoot: section.payloadRoot,
  }
  if (variant === "successor") projection.lineage = metadata?.lineage
  projection.mutationPolicy = metadata?.mutationPolicy
  projection.preregistration = metadata?.preregistration
  projection.categories = metadata?.categories
  projection.categoryLabels = metadata?.categoryLabels
  projection.records = section.records
  return projection
}

function result(selection, errors) {
  return {
    schemaVersion: "filesystem-residue-validation.1",
    selection,
    ...FACTS,
    errors,
    ok: errors.length === 0,
  }
}
