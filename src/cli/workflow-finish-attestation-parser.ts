import { canonicalJson, sha256Digest } from "./workflow-finish-attestation-canonical.js"
import { readFinishAttestationReceipt } from "./workflow-finish-attestation-receipt.js"
import {
  FINISH_ATTESTATION_PREDICATE_TYPE,
  type FinishAttestationDiagnostic,
  type FinishAttestationStatement,
} from "./workflow-finish-attestation-types.js"
import { exactKeys, isDigest, isRecord, isString } from "./workflow-finish-attestation-receipt-fields.js"

export type FinishAttestationParseResult =
  | { readonly ok: false; readonly diagnostics: readonly FinishAttestationDiagnostic[] }
  | { readonly ok: true; readonly value: FinishAttestationStatement }

export function parseFinishAttestationStatement(value: unknown): FinishAttestationParseResult {
  const diagnostics: FinishAttestationDiagnostic[] = []
  if (!isRecord(value) || !exactKeys(value, ["_type", "predicate", "predicateType", "subject"])) {
    return failure("statement", "Statement has unknown or missing fields.")
  }
  if (value._type !== "https://in-toto.io/Statement/v1" || value.predicateType !== FINISH_ATTESTATION_PREDICATE_TYPE) {
    return failure("statement", "Statement type or predicate type does not match policy.")
  }
  const subject = readSubject(value.subject, diagnostics)
  const predicate = readPredicate(value.predicate, diagnostics)
  if (subject === undefined || predicate === undefined) return { diagnostics, ok: false }
  const receiptBytes = Buffer.from(`${canonicalJson(predicate.receipt)}\n`)
  const receiptDigest = sha256Digest(receiptBytes)
  if (receiptDigest !== predicate.receiptDigest || receiptDigest !== `sha256:${subject[0].digest.sha256}`) {
    diagnostics.push({ code: "binding-mismatch", message: "Subject and predicate must bind canonical receipt bytes.", path: "subject" })
    return { diagnostics, ok: false }
  }
  return {
    ok: true,
    value: {
      predicate,
      predicateType: FINISH_ATTESTATION_PREDICATE_TYPE,
      subject,
    },
  }
}

function readSubject(
  value: unknown,
  diagnostics: FinishAttestationDiagnostic[],
): FinishAttestationStatement["subject"] | undefined {
  if (!Array.isArray(value) || value.length !== 1) {
    diagnostics.push({ code: "invalid-field", message: "Statement must have one receipt subject.", path: "subject" })
    return undefined
  }
  const subject = value[0]
  if (!isRecord(subject) || !exactKeys(subject, ["digest", "name"]) || subject.name !== "receipt.json") {
    diagnostics.push({ code: "wrong-policy", message: "Statement subject must be receipt.json.", path: "subject" })
    return undefined
  }
  const digest = subject.digest
  if (!isRecord(digest) || !exactKeys(digest, ["sha256"]) || !isString(digest.sha256) || !/^[a-f0-9]{64}$/u.test(digest.sha256)) {
    diagnostics.push({ code: "invalid-field", message: "Statement subject digest is invalid.", path: "subject.digest" })
    return undefined
  }
  return [{ digest: { sha256: digest.sha256 }, name: "receipt.json" }]
}

function readPredicate(
  value: unknown,
  diagnostics: FinishAttestationDiagnostic[],
): FinishAttestationStatement["predicate"] | undefined {
  if (!isRecord(value) || !exactKeys(value, ["authorityBoundary", "authorityEligible", "predicateType", "receipt", "receiptDigest"])) {
    diagnostics.push({ code: "invalid-field", message: "Predicate has unknown or missing fields.", path: "predicate" })
    return undefined
  }
  if (value.authorityBoundary !== "external-attested" || value.authorityEligible !== true || value.predicateType !== FINISH_ATTESTATION_PREDICATE_TYPE || !isDigest(value.receiptDigest)) {
    diagnostics.push({ code: "wrong-policy", message: "Predicate does not match immutable authority policy.", path: "predicate" })
    return undefined
  }
  const receipt = readFinishAttestationReceipt(value.receipt, diagnostics)
  if (receipt === undefined) return undefined
  return {
    authorityBoundary: "external-attested",
    authorityEligible: true,
    predicateType: FINISH_ATTESTATION_PREDICATE_TYPE,
    receipt,
    receiptDigest: value.receiptDigest,
  }
}

function failure(path: string, message: string): FinishAttestationParseResult {
  return { diagnostics: [{ code: "invalid-field", message, path }], ok: false }
}
