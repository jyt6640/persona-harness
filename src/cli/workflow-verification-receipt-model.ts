import { isRecord } from "../config/jsonc.js"
import {
  ATTEMPT_KEYS,
  RECEIPT_KEYS,
  VERIFICATION_ATTEMPT_SCHEMA,
  VERIFICATION_ATTEMPT_STATUSES,
  VERIFICATION_AUTHORITY_CLASSES,
  VERIFICATION_RECEIPT_SCHEMA,
  type ReceiptDiagnostic,
  type ReceiptParseResult,
  type VerificationAttempt,
  type VerificationReceipt,
} from "./workflow-verification-receipt-types.js"
import {
  checkKeys,
  readBindingFields,
  readDigest,
  readEnum,
  readIdentifier,
  readIssuer,
  readOptionalIdentifier,
  readOptionalTimestamp,
  readResult,
  readTimestamp,
  readVersion,
  readWorkspaceIdentity,
} from "./workflow-verification-receipt-fields.js"

export { VERIFICATION_ATTEMPT_SCHEMA, VERIFICATION_ATTEMPT_STATUSES, VERIFICATION_AUTHORITY_CLASSES, VERIFICATION_RECEIPT_SCHEMA } from "./workflow-verification-receipt-types.js"
export type {
  ReceiptDiagnostic,
  ReceiptDiagnosticCode,
  ReceiptParseResult,
  VerificationAttempt,
  VerificationCommandIdentity,
  VerificationDigest,
  VerificationIssuer,
  VerificationReceipt,
  VerificationResult,
  VerificationWorkspaceIdentity,
} from "./workflow-verification-receipt-types.js"

export function parseVerificationReceipt(text: string, path: string): ReceiptParseResult<VerificationReceipt> {
  const parsed = parseJson(text, path)
  if (!parsed.ok) return parsed
  if (!isRecord(parsed.value)) return failure([{ code: "invalid-shape", message: "Receipt root must be a JSON object.", path }])

  const diagnostics: ReceiptDiagnostic[] = []
  checkKeys(parsed.value, RECEIPT_KEYS, path, diagnostics)
  const schemaVersion = readEnum(parsed.value.schemaVersion, [VERIFICATION_RECEIPT_SCHEMA], "schemaVersion", path, diagnostics)
  const receiptId = readIdentifier(parsed.value.receiptId, "receiptId", path, diagnostics)
  const authorityClass = readEnum(parsed.value.authorityClass, VERIFICATION_AUTHORITY_CLASSES, "authorityClass", path, diagnostics)
  const issuer = readIssuer(parsed.value.issuer, path, diagnostics)
  const issuerVerificationState = readEnum(
    parsed.value.issuerVerificationState,
    ["cooperative-unverified", "external-attested-unverified"],
    "issuerVerificationState",
    path,
    diagnostics,
  )
  const binding = readBindingFields(parsed.value, path, diagnostics)
  const result = readResult(parsed.value.result, path, diagnostics)
  const issuedAt = readTimestamp(parsed.value.issuedAt, "issuedAt", path, diagnostics)
  const expiresAt = readTimestamp(parsed.value.expiresAt, "expiresAt", path, diagnostics)
  const provenanceDigest = readDigest(parsed.value.provenanceDigest, "provenanceDigest", path, diagnostics)

  if (authorityClass !== undefined && issuer !== undefined && issuerVerificationState !== undefined) {
    const localMismatch = authorityClass === "local-fresh-cooperative"
      && (issuer.kind !== "persona-harness" || issuerVerificationState !== "cooperative-unverified")
    const externalMismatch = authorityClass === "external-attested"
      && (issuer.kind !== "external-attestor" || issuerVerificationState !== "external-attested-unverified")
    if (localMismatch || externalMismatch) {
      diagnostics.push({
        code: "authority-issuer-mismatch",
        message: "authorityClass, issuer.kind, and issuerVerificationState do not describe the same future authority class.",
        path,
      })
    }
  }
  if (issuedAt !== undefined && expiresAt !== undefined) {
    const issuedTime = Date.parse(issuedAt)
    const expiresTime = Date.parse(expiresAt)
    if (expiresTime <= issuedTime || expiresTime - issuedTime > 24 * 60 * 60 * 1000) {
      diagnostics.push({
        code: "invalid-lifecycle",
        message: "Receipt expiry must be after issuance and no more than 24 hours later.",
        path,
      })
    }
  }
  if (
    diagnostics.length > 0
    || schemaVersion === undefined
    || receiptId === undefined
    || authorityClass === undefined
    || issuer === undefined
    || issuerVerificationState === undefined
    || binding === undefined
    || result === undefined
    || issuedAt === undefined
    || expiresAt === undefined
    || provenanceDigest === undefined
  ) {
    return failure(diagnostics)
  }
  return success({
    ...binding,
    authorityClass,
    expiresAt,
    issuedAt,
    issuer,
    issuerVerificationState,
    provenanceDigest,
    receiptId,
    result,
    schemaVersion,
  })
}

export function parseVerificationAttempt(text: string, path: string): ReceiptParseResult<VerificationAttempt> {
  const parsed = parseJson(text, path)
  if (!parsed.ok) return parsed
  if (!isRecord(parsed.value)) return failure([{ code: "invalid-shape", message: "Attempt root must be a JSON object.", path }])

  const diagnostics: ReceiptDiagnostic[] = []
  checkKeys(parsed.value, ATTEMPT_KEYS, path, diagnostics)
  const schemaVersion = readEnum(parsed.value.schemaVersion, [VERIFICATION_ATTEMPT_SCHEMA], "schemaVersion", path, diagnostics)
  const binding = readBindingFields(parsed.value, path, diagnostics)
  const status = readEnum(parsed.value.status, VERIFICATION_ATTEMPT_STATUSES, "status", path, diagnostics)
  const startedAt = readTimestamp(parsed.value.startedAt, "startedAt", path, diagnostics)
  const completedAt = readOptionalTimestamp(parsed.value.completedAt, "completedAt", path, diagnostics)
  const receiptId = readOptionalIdentifier(parsed.value.receiptId, "receiptId", path, diagnostics)
  const provenanceDigest = readDigest(parsed.value.provenanceDigest, "provenanceDigest", path, diagnostics)

  if (status === "completed" && (completedAt === null || receiptId === null)) {
    diagnostics.push({ code: "invalid-lifecycle", message: "A completed attempt must bind completedAt and receiptId.", path })
  }
  if (status !== undefined && status !== "completed" && (completedAt !== null || receiptId !== null)) {
    diagnostics.push({ code: "invalid-lifecycle", message: "Only a completed attempt may bind completedAt or receiptId.", path })
  }
  if (
    diagnostics.length > 0
    || schemaVersion === undefined
    || binding === undefined
    || status === undefined
    || startedAt === undefined
    || provenanceDigest === undefined
  ) {
    return failure(diagnostics)
  }
  return success({
    attemptId: binding.attemptId,
    command: binding.command,
    completedAt,
    dirtyWorktreeDigest: binding.dirtyWorktreeDigest,
    finishId: binding.finishId,
    phVersion: binding.phVersion,
    provenanceDigest,
    receiptId,
    schemaVersion,
    sessionId: binding.sessionId,
    sourceHead: binding.sourceHead,
    startedAt,
    status,
    workspaceIdentity: binding.workspaceIdentity,
  })
}

function parseJson(text: string, path: string): ReceiptParseResult<unknown> {
  try {
    const value: unknown = JSON.parse(text)
    return success(value)
  } catch (error) {
    if (error instanceof SyntaxError) {
      return failure([{ code: "invalid-json", message: "Receipt or attempt is not valid JSON.", path }])
    }
    throw error
  }
}

function success<T>(value: T): ReceiptParseResult<T> {
  return { diagnostics: [], ok: true, value }
}

function failure<T>(diagnostics: readonly ReceiptDiagnostic[]): ReceiptParseResult<T> {
  return { diagnostics, ok: false }
}
