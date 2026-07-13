import { CASE_IDS, RULE_IDS, isRecord, sha256, stableJson } from "./contract.mjs"

export function evaluateCandidate({ candidate, corpus, validation }) {
  const errors = [...validation.errors]
  const base = {
    authorityEligible: false,
    commandsExecuted: 0,
    enforcement: false,
    evidenceTrust: "untrusted",
    finishAuthority: "not-authorized",
    networkAccess: false,
    productCliInvocations: 0,
    realProjectAccess: false,
    reportOnly: true,
    writeOperations: 0,
  }
  if (!validation.ok) return { ...base, decision: "fail", errors, ok: false }
  if (!isRecord(candidate)) {
    add(errors, "CANDIDATE_INVALID", "candidate", "candidate must be an object")
    return { ...base, decision: "fail", errors, ok: false }
  }
  const allowed = new Set(["schemaVersion", "candidateId", "corpusId", "canonicalSemanticsSha256", "evaluatedRecordIds", "findings", "provenance"])
  for (const key of Object.keys(candidate)) if (!allowed.has(key)) add(errors, "CANDIDATE_UNKNOWN_FIELD", `candidate.${key}`, "unknown candidate field")
  expect(errors, candidate.schemaVersion, corpus.evaluationContract?.candidateSchemaVersion, "CANDIDATE_SCHEMA", "candidate.schemaVersion")
  expect(errors, candidate.corpusId, corpus.corpusId, "CANDIDATE_CORPUS", "candidate.corpusId")
  expect(errors, candidate.canonicalSemanticsSha256, sha256(stableJson(validation.projection)), "CANDIDATE_SEMANTICS", "candidate.canonicalSemanticsSha256")
  const ids = Array.isArray(candidate.evaluatedRecordIds) ? candidate.evaluatedRecordIds : []
  expect(errors, JSON.stringify(ids), JSON.stringify(CASE_IDS), "CANDIDATE_IDS", "candidate.evaluatedRecordIds")
  const records = new Map(corpus.records.map((record) => [record.id, record]))
  const findings = Array.isArray(candidate.findings) ? candidate.findings : []
  const findingKeys = new Set()
  const actualByRule = new Map(RULE_IDS.map((rule) => [rule, new Set()]))
  for (const [index, finding] of findings.entries()) {
    if (!isRecord(finding)) {
      add(errors, "CANDIDATE_FINDING_INVALID", `candidate.findings[${index}]`, "finding must be an object")
      continue
    }
    const record = records.get(finding.caseId)
    const key = `${String(finding.caseId)}:${String(finding.ruleId)}`
    if (findingKeys.has(key)) add(errors, "CANDIDATE_DUPLICATE", `candidate.findings[${index}]`, "finding identity was replayed")
    findingKeys.add(key)
    if (record === undefined) add(errors, "CANDIDATE_CASE_UNKNOWN", `candidate.findings[${index}].caseId`, "finding case is not preregistered")
    else if (record.ruleId !== finding.ruleId) add(errors, "CANDIDATE_RULE_MISMATCH", `candidate.findings[${index}].ruleId`, "finding rule does not match the corpus case")
    actualByRule.get(finding.ruleId)?.add(finding.caseId)
  }
  validateProvenance(candidate.provenance, errors)
  const metrics = RULE_IDS.map((ruleId) => measureRule(corpus.records, actualByRule.get(ruleId) ?? new Set(), ruleId, corpus.evaluationContract))
  const decision = errors.length === 0 && metrics.every((metric) => metric.decision === "pass") ? "pass" : "fail"
  return { ...base, candidateId: candidate.candidateId, decision, errors, metrics, ok: errors.length === 0 }
}

function measureRule(records, actual, ruleId, contract) {
  const expected = records.filter((record) => record.ruleId === ruleId)
  const positives = new Set(expected.filter((record) => record.expectedWarning).map((record) => record.id))
  const truePositives = [...actual].filter((id) => positives.has(id)).length
  const falsePositives = [...actual].filter((id) => !positives.has(id)).length
  const falseNegatives = [...positives].filter((id) => !actual.has(id)).length
  const precision = truePositives + falsePositives === 0 ? 1 : truePositives / (truePositives + falsePositives)
  const recall = truePositives + falseNegatives === 0 ? 1 : truePositives / (truePositives + falseNegatives)
  const decision = precision >= contract.minimumPrecision && recall >= contract.minimumRecall && falsePositives <= contract.maximumFalsePositives && falseNegatives <= contract.maximumFalseNegatives ? "pass" : "fail"
  return { decision, falseNegatives, falsePositives, precision, recall, ruleId, truePositives }
}

function validateProvenance(value, errors) {
  if (!isRecord(value) || typeof value.issuer !== "string" || typeof value.digest !== "string" || value.externalAttestation !== null) {
    add(errors, "CANDIDATE_PROVENANCE", "candidate.provenance", "local provenance is diagnostic-only and must be explicit")
  }
}

function expect(errors, actual, expected, code, path) {
  if (stableJson(actual) !== stableJson(expected)) add(errors, code, path, "value does not match the canonical contract")
}

function add(errors, code, path, message) {
  errors.push({ code, path, message })
}
