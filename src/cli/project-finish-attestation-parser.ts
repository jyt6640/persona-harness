import { canonicalProjectFinishAttestationReceiptDigest } from "./project-finish-attestation-canonical.js"
import { readProjectFinishAttestationReceipt } from "./project-finish-attestation-receipt.js"
import {
  PROJECT_FINISH_ATTESTATION_POLICY,
  PROJECT_FINISH_ATTESTATION_PREDICATE_TYPE,
  PROJECT_FINISH_ATTESTATION_SCHEMA,
  type ProjectFinishAttestationDiagnostic,
  type ProjectFinishAttestationParseResult,
  type ProjectFinishAttestationStatement,
} from "./project-finish-attestation-types.js"
import { exactKeys, isRecord, isString } from "./workflow-finish-attestation-receipt-fields.js"

export function parseProjectFinishAttestationStatement(value: unknown): ProjectFinishAttestationParseResult {
  if (!isRecord(value) || !exactKeys(value, ["_type", "predicate", "predicateType", "subject"])) {
    return failure("statement")
  }
  if (
    value._type !== "https://in-toto.io/Statement/v1"
    || value.predicateType !== PROJECT_FINISH_ATTESTATION_PREDICATE_TYPE
  ) {
    return wrongFailure("statement")
  }
  const diagnostics: ProjectFinishAttestationDiagnostic[] = []
  const subject = readSubject(value.subject, diagnostics)
  const predicate = readPredicate(value.predicate, diagnostics)
  if (subject === undefined || predicate === undefined) return { diagnostics, ok: false }
  const recomputed = canonicalProjectFinishAttestationReceiptDigest(predicate.receipt)
  if (
    recomputed !== predicate.receiptDigest
    || recomputed !== `sha256:${subject[0].digest.sha256}`
  ) {
    return {
      diagnostics: [...diagnostics, { code: "binding-mismatch", path: "subject" }],
      ok: false,
    }
  }
  return {
    ok: true,
    value: {
      _type: "https://in-toto.io/Statement/v1",
      predicate,
      predicateType: PROJECT_FINISH_ATTESTATION_PREDICATE_TYPE,
      subject,
    },
  }
}

function readSubject(
  value: unknown,
  diagnostics: ProjectFinishAttestationDiagnostic[],
): ProjectFinishAttestationStatement["subject"] | undefined {
  if (!Array.isArray(value) || value.length !== 1) {
    diagnostics.push(invalid("subject"))
    return undefined
  }
  const subject = value[0]
  if (
    !isRecord(subject)
    || !exactKeys(subject, ["digest", "name"])
    || subject.name !== PROJECT_FINISH_ATTESTATION_POLICY.subjectName
  ) {
    diagnostics.push(wrongDiagnostic("subject"))
    return undefined
  }
  const digest = subject.digest
  if (
    !isRecord(digest)
    || !exactKeys(digest, ["sha256"])
    || !isString(digest.sha256)
    || !/^[a-f0-9]{64}$/u.test(digest.sha256)
  ) {
    diagnostics.push(invalid("subject.digest"))
    return undefined
  }
  return [{
    digest: { sha256: digest.sha256 },
    name: PROJECT_FINISH_ATTESTATION_POLICY.subjectName,
  }]
}

function readPredicate(
  value: unknown,
  diagnostics: ProjectFinishAttestationDiagnostic[],
): ProjectFinishAttestationStatement["predicate"] | undefined {
  if (
    !isRecord(value)
    || !exactKeys(value, ["policyMarker", "receipt", "receiptDigest", "schemaVersion"])
  ) {
    diagnostics.push(invalid("predicate"))
    return undefined
  }
  if (
    value.policyMarker !== PROJECT_FINISH_ATTESTATION_POLICY.policyMarker
    || value.schemaVersion !== PROJECT_FINISH_ATTESTATION_SCHEMA
    || !isString(value.receiptDigest)
    || !/^sha256:[a-f0-9]{64}$/u.test(value.receiptDigest)
  ) {
    diagnostics.push(wrongDiagnostic("predicate"))
    return undefined
  }
  const receipt = readProjectFinishAttestationReceipt(value.receipt, diagnostics)
  if (receipt === undefined) return undefined
  return {
    policyMarker: PROJECT_FINISH_ATTESTATION_POLICY.policyMarker,
    receipt,
    receiptDigest: value.receiptDigest,
    schemaVersion: PROJECT_FINISH_ATTESTATION_SCHEMA,
  }
}

function failure(path: string): ProjectFinishAttestationParseResult {
  return { diagnostics: [invalid(path)], ok: false }
}

function invalid(path: string): ProjectFinishAttestationDiagnostic {
  return { code: "invalid-field", path }
}

function wrongFailure(path: string): ProjectFinishAttestationParseResult {
  return { diagnostics: [{ code: "wrong-policy", path }], ok: false }
}

function wrongDiagnostic(path: string): ProjectFinishAttestationDiagnostic {
  return { code: "wrong-policy", path }
}
