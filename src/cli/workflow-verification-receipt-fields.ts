import { isRecord } from "../config/jsonc.js"
import {
  COMMAND_KEYS,
  ISSUER_KEYS,
  RESULT_KEYS,
  WORKSPACE_KEYS,
  type ReceiptDiagnostic,
  type VerificationCommandIdentity,
  type VerificationDigest,
  type VerificationIssuer,
  type VerificationResult,
  type VerificationWorkspaceIdentity,
} from "./workflow-verification-receipt-types.js"

export function checkKeys(
  record: Readonly<Record<string, unknown>>,
  allowed: readonly string[],
  path: string,
  diagnostics: ReceiptDiagnostic[],
): void {
  const allowedSet = new Set(allowed)
  for (const key of Object.keys(record)) {
    if (!allowedSet.has(key)) {
      diagnostics.push({ code: "unknown-field", message: `Unknown field: ${key}`, path: `${path}.${key}` })
    }
  }
  for (const key of allowed) {
    if (!(key in record) && key !== "completedAt" && key !== "receiptId") {
      diagnostics.push({ code: "missing-field", message: `Missing field: ${key}`, path: `${path}.${key}` })
    }
  }
}

export function readBindingFields(
  record: Readonly<Record<string, unknown>>,
  path: string,
  diagnostics: ReceiptDiagnostic[],
): {
  readonly attemptId: string
  readonly command: VerificationCommandIdentity
  readonly dirtyWorktreeDigest: VerificationDigest
  readonly finishId: string
  readonly phVersion: string
  readonly sessionId: string
  readonly sourceHead: string
  readonly workspaceIdentity: VerificationWorkspaceIdentity
} | undefined {
  const attemptId = readIdentifier(record.attemptId, "attemptId", path, diagnostics)
  const sessionId = readIdentifier(record.sessionId, "sessionId", path, diagnostics)
  const finishId = readIdentifier(record.finishId, "finishId", path, diagnostics)
  const sourceHead = readSourceHead(record.sourceHead, "sourceHead", path, diagnostics)
  const dirtyWorktreeDigest = readDigest(record.dirtyWorktreeDigest, "dirtyWorktreeDigest", path, diagnostics)
  const workspaceIdentity = readWorkspaceIdentity(record.workspaceIdentity, path, diagnostics)
  const command = readCommand(record.command, path, diagnostics)
  const phVersion = readVersion(record.phVersion, "phVersion", path, diagnostics)
  if (
    attemptId === undefined
    || sessionId === undefined
    || finishId === undefined
    || sourceHead === undefined
    || dirtyWorktreeDigest === undefined
    || workspaceIdentity === undefined
    || command === undefined
    || phVersion === undefined
  ) {
    return undefined
  }
  return { attemptId, command, dirtyWorktreeDigest, finishId, phVersion, sessionId, sourceHead, workspaceIdentity }
}

export function readIssuer(
  value: unknown,
  path: string,
  diagnostics: ReceiptDiagnostic[],
): VerificationIssuer | undefined {
  if (!isRecord(value)) {
    diagnostics.push({ code: "invalid-field", message: "issuer must be an object.", path: `${path}.issuer` })
    return undefined
  }
  checkKeys(value, ISSUER_KEYS, `${path}.issuer`, diagnostics)
  const kind = readEnum(value.kind, ["persona-harness", "external-attestor"], "issuer.kind", path, diagnostics)
  const id = readIdentifier(value.id, "issuer.id", path, diagnostics)
  return kind === undefined || id === undefined ? undefined : { id, kind }
}

export function readWorkspaceIdentity(
  value: unknown,
  path: string,
  diagnostics: ReceiptDiagnostic[],
): VerificationWorkspaceIdentity | undefined {
  if (!isRecord(value)) {
    diagnostics.push({ code: "invalid-field", message: "workspaceIdentity must be an object.", path: `${path}.workspaceIdentity` })
    return undefined
  }
  checkKeys(value, WORKSPACE_KEYS, `${path}.workspaceIdentity`, diagnostics)
  const rootDigest = readDigest(value.rootDigest, "workspaceIdentity.rootDigest", path, diagnostics)
  const deviceIdentity = readIdentifier(value.deviceIdentity, "workspaceIdentity.deviceIdentity", path, diagnostics)
  const platform = readEnum(value.platform, ["darwin", "linux", "win32", "unknown"], "workspaceIdentity.platform", path, diagnostics)
  return rootDigest === undefined || deviceIdentity === undefined || platform === undefined
    ? undefined
    : { deviceIdentity, platform, rootDigest }
}

export function readCommand(
  value: unknown,
  path: string,
  diagnostics: ReceiptDiagnostic[],
): VerificationCommandIdentity | undefined {
  if (!isRecord(value)) {
    diagnostics.push({ code: "invalid-field", message: "command must be an object.", path: `${path}.command` })
    return undefined
  }
  checkKeys(value, COMMAND_KEYS, `${path}.command`, diagnostics)
  const catalogId = readIdentifier(value.catalogId, "command.catalogId", path, diagnostics)
  const argvDigest = readDigest(value.argvDigest, "command.argvDigest", path, diagnostics)
  return catalogId === undefined || argvDigest === undefined ? undefined : { argvDigest, catalogId }
}

export function readResult(
  value: unknown,
  path: string,
  diagnostics: ReceiptDiagnostic[],
): VerificationResult | undefined {
  if (!isRecord(value)) {
    diagnostics.push({ code: "invalid-field", message: "result must be an object.", path: `${path}.result` })
    return undefined
  }
  checkKeys(value, RESULT_KEYS, `${path}.result`, diagnostics)
  const status = readEnum(value.status, ["pass", "fail"], "result.status", path, diagnostics)
  const testCount = readNonNegativeInteger(value.testCount, "result.testCount", path, diagnostics)
  const artifactDigests = readDigestArray(value.artifactDigests, "result.artifactDigests", path, diagnostics)
  return status === undefined || testCount === undefined || artifactDigests === undefined
    ? undefined
    : { artifactDigests, status, testCount }
}

function readDigestArray(
  value: unknown,
  field: string,
  path: string,
  diagnostics: ReceiptDiagnostic[],
): readonly VerificationDigest[] | undefined {
  if (!Array.isArray(value)) {
    diagnostics.push({ code: "invalid-field", message: `${field} must be an array.`, path: `${path}.${field}` })
    return undefined
  }
  const digests = value.map((entry, index) => readDigest(entry, `${field}[${index}]`, path, diagnostics))
  if (digests.some((digest) => digest === undefined)) {
    return undefined
  }
  const values = digests.filter((digest): digest is VerificationDigest => digest !== undefined)
  if (new Set(values).size !== values.length) {
    diagnostics.push({ code: "invalid-field", message: `${field} must not contain duplicate digests.`, path: `${path}.${field}` })
  }
  return values
}

export function readIdentifier(value: unknown, field: string, path: string, diagnostics: ReceiptDiagnostic[]): string | undefined {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(value)) {
    diagnostics.push({ code: "invalid-field", message: `${field} must be a bounded identifier.`, path: `${path}.${field}` })
    return undefined
  }
  return value
}

export function readOptionalIdentifier(value: unknown, field: string, path: string, diagnostics: ReceiptDiagnostic[]): string | null {
  if (value === undefined || value === null) {
    return null
  }
  return readIdentifier(value, field, path, diagnostics) ?? null
}

export function readSourceHead(value: unknown, field: string, path: string, diagnostics: ReceiptDiagnostic[]): string | undefined {
  if (typeof value !== "string" || !/^[0-9a-f]{40,64}$/iu.test(value)) {
    diagnostics.push({ code: "invalid-field", message: `${field} must be a Git object id.`, path: `${path}.${field}` })
    return undefined
  }
  return value.toLowerCase()
}

export function readDigest(value: unknown, field: string, path: string, diagnostics: ReceiptDiagnostic[]): VerificationDigest | undefined {
  if (typeof value !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(value)) {
    diagnostics.push({ code: "invalid-field", message: `${field} must be a sha256 digest.`, path: `${path}.${field}` })
    return undefined
  }
  return value.toLowerCase()
}

export function readVersion(value: unknown, field: string, path: string, diagnostics: ReceiptDiagnostic[]): string | undefined {
  if (typeof value !== "string" || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(value)) {
    diagnostics.push({ code: "invalid-field", message: `${field} must be a PH semver value.`, path: `${path}.${field}` })
    return undefined
  }
  return value
}

export function readTimestamp(value: unknown, field: string, path: string, diagnostics: ReceiptDiagnostic[]): string | undefined {
  if (typeof value !== "string" || !isCanonicalTimestamp(value)) {
    diagnostics.push({ code: "invalid-field", message: `${field} must be a canonical UTC timestamp.`, path: `${path}.${field}` })
    return undefined
  }
  return value
}

export function readOptionalTimestamp(value: unknown, field: string, path: string, diagnostics: ReceiptDiagnostic[]): string | null {
  if (value === undefined || value === null) {
    return null
  }
  return readTimestamp(value, field, path, diagnostics) ?? null
}

export function readNonNegativeInteger(value: unknown, field: string, path: string, diagnostics: ReceiptDiagnostic[]): number | undefined {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    diagnostics.push({ code: "invalid-field", message: `${field} must be a non-negative integer.`, path: `${path}.${field}` })
    return undefined
  }
  return value
}

export function readEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
  path: string,
  diagnostics: ReceiptDiagnostic[],
): T | undefined {
  if (typeof value === "string") {
    const match = allowed.find((entry) => entry === value)
    if (match !== undefined) {
      return match
    }
    if (value.startsWith("verification-receipt.") || value.startsWith("verification-attempt.")) {
      diagnostics.push({ code: "unsupported-schema", message: `Unsupported ${field}: ${value}`, path: `${path}.${field}` })
    } else {
      diagnostics.push({ code: "invalid-field", message: `${field} is not recognized.`, path: `${path}.${field}` })
    }
    return undefined
  }
  diagnostics.push({ code: "invalid-field", message: `${field} must be a string.`, path: `${path}.${field}` })
  return undefined
}

export function isCanonicalTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
}
