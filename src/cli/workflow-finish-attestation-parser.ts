import { isRecord } from "../config/jsonc.js"
import { FINISH_ATTESTATION_PREDICATE_TYPE, type FinishAttestationDiagnostic, type FinishAttestationParseResult, type FinishAttestationPredicate, type FinishAttestationStatement } from "./workflow-finish-attestation-types.js"
import { readFinishAttestationReceipt } from "./workflow-finish-attestation-receipt-parser.js"

export function parseFinishAttestationStatement(value: unknown): FinishAttestationParseResult {
  const diagnostics: FinishAttestationDiagnostic[] = []
  const statement = readStatement(value, diagnostics)
  if (statement === undefined) return { diagnostics, ok: false }
  return { diagnostics: [], ok: true, value: statement }
}

function readStatement(value: unknown, diagnostics: FinishAttestationDiagnostic[]): FinishAttestationStatement | undefined {
  if (!isRecord(value) || !exactKeys(value, ["_type", "predicate", "predicateType", "subject"])) {
    diagnostics.push(invalid("statement", "Attestation statement has unknown or missing fields."))
    return undefined
  }
  if (value._type !== "https://in-toto.io/Statement/v1") {
    diagnostics.push(wrong("statement._type", "Attestation statement type is not the fixed in-toto statement type."))
    return undefined
  }
  if (value.predicateType !== FINISH_ATTESTATION_PREDICATE_TYPE) {
    diagnostics.push(wrong("predicateType", "Attestation predicate type is not the fixed finish-attestation.1 type."))
    return undefined
  }
  const subject = readSubject(value.subject, diagnostics)
  const predicate = readPredicate(value.predicate, diagnostics)
  if (subject === undefined || predicate === undefined) return undefined
  return { _type: "https://in-toto.io/Statement/v1", predicate, predicateType: FINISH_ATTESTATION_PREDICATE_TYPE, subject: [subject] }
}

function readSubject(value: unknown, diagnostics: FinishAttestationDiagnostic[]): FinishAttestationStatement["subject"][number] | undefined {
  if (!Array.isArray(value) || value.length !== 1) {
    diagnostics.push(invalid("subject", "Exactly one receipt.json subject is required."))
    return undefined
  }
  const subject = value[0]
  if (!isRecord(subject) || !exactKeys(subject, ["digest", "name"])) {
    diagnostics.push(invalid("subject", "Subject must contain only name and sha256 digest."))
    return undefined
  }
  if (subject.name !== "receipt.json") {
    diagnostics.push(wrong("subject.name", "Only receipt.json may be attested for finish authority."))
    return undefined
  }
  if (!isRecord(subject.digest) || !exactKeys(subject.digest, ["sha256"]) || !isHexDigest(subject.digest.sha256)) {
    diagnostics.push(invalid("subject.digest", "Subject digest must be a sha256 hex digest."))
    return undefined
  }
  return { digest: { sha256: subject.digest.sha256 }, name: "receipt.json" }
}

function readPredicate(value: unknown, diagnostics: FinishAttestationDiagnostic[]): FinishAttestationPredicate | undefined {
  if (!isRecord(value) || !exactKeys(value, ["authorityBoundary", "authorityEligible", "predicateType", "receipt", "receiptDigest"])) {
    diagnostics.push(invalid("predicate", "Predicate has unknown or missing fields."))
    return undefined
  }
  if (value.authorityBoundary !== "external-attested" || value.authorityEligible !== true) {
    diagnostics.push(wrong("predicate.authority", "Only the external-attested authority boundary may be considered."))
    return undefined
  }
  if (value.predicateType !== FINISH_ATTESTATION_PREDICATE_TYPE || !isDigest(value.receiptDigest)) {
    diagnostics.push(wrong("predicate", "Predicate type or receipt digest is not fixed."))
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

function exactKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  const expected = new Set(keys)
  return Object.keys(value).length === keys.length && Object.keys(value).every((key) => expected.has(key))
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/u.test(value)
}

function isHexDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value)
}

function invalid(path: string, message: string): FinishAttestationDiagnostic {
  return { code: "invalid-field", message, path }
}

function wrong(path: string, message: string): FinishAttestationDiagnostic {
  return { code: "wrong-policy", message, path }
}
