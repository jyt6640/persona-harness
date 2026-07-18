import { canonicalProjectFinishAttestationReceiptDigest } from "./project-finish-attestation-canonical.js"
import {
  PROJECT_FINISH_ATTESTATION_COMMAND_CATALOG,
  PROJECT_FINISH_ATTESTATION_POLICY,
  type ProjectFinishAttestationCommand,
  type ProjectFinishAttestationDiagnostic,
  type ProjectFinishAttestationReceipt,
} from "./project-finish-attestation-types.js"
import {
  exactKeys,
  isDigest,
  isPositiveInteger,
  isPositiveOrZeroInteger,
  isRecord,
  isString,
} from "./workflow-finish-attestation-receipt-fields.js"

export function readProjectFinishAttestationGradle(
  value: unknown,
  diagnostics: ProjectFinishAttestationDiagnostic[],
): ProjectFinishAttestationReceipt["gradle"] | undefined {
  if (
    !isRecord(value)
    || !exactKeys(value, ["catalog", "catalogDigest", "catalogId", "console", "noBuildCache", "noDaemon", "wrapperPath"])
    || !Array.isArray(value.catalog)
    || !isDigest(value.catalogDigest)
    || value.catalogId !== PROJECT_FINISH_ATTESTATION_POLICY.catalogId
    || value.console !== "plain"
    || value.noBuildCache !== true
    || value.noDaemon !== true
    || value.wrapperPath !== "./gradlew"
  ) {
    diagnostics.push(wrong("predicate.receipt.gradle"))
    return undefined
  }
  const catalog = value.catalog.map((entry, index) => readCommand(entry, `predicate.receipt.gradle.catalog[${index}]`, diagnostics))
  if (catalog.some((entry) => entry === undefined)) return undefined
  const fixedCatalog = catalog.filter(isCommand)
  if (
    canonicalProjectFinishAttestationReceiptDigest(fixedCatalog)
      !== canonicalProjectFinishAttestationReceiptDigest(PROJECT_FINISH_ATTESTATION_COMMAND_CATALOG)
    || value.catalogDigest !== canonicalProjectFinishAttestationReceiptDigest(PROJECT_FINISH_ATTESTATION_COMMAND_CATALOG)
  ) {
    diagnostics.push(wrong("predicate.receipt.gradle.catalog"))
    return undefined
  }
  return {
    catalog: fixedCatalog,
    catalogDigest: value.catalogDigest,
    catalogId: PROJECT_FINISH_ATTESTATION_POLICY.catalogId,
    console: "plain",
    noBuildCache: true,
    noDaemon: true,
    wrapperPath: "./gradlew",
  }
}

export function readProjectFinishAttestationTest(
  value: unknown,
  diagnostics: ProjectFinishAttestationDiagnostic[],
): ProjectFinishAttestationReceipt["test"] | undefined {
  if (
    !isRecord(value)
    || !exactKeys(value, ["commandId", "count", "failed", "junitDigest", "passed", "skipped"])
    || value.commandId !== "test"
    || !isPositiveInteger(value.count)
    || value.failed !== 0
    || !isPositiveInteger(value.passed)
    || !isPositiveOrZeroInteger(value.skipped)
    || !isDigest(value.junitDigest)
    || value.count !== value.passed + value.failed + value.skipped
  ) {
    diagnostics.push(wrong("predicate.receipt.test"))
    return undefined
  }
  return {
    commandId: "test",
    count: value.count,
    failed: 0,
    junitDigest: value.junitDigest,
    passed: value.passed,
    skipped: value.skipped,
  }
}

export function readProjectFinishAttestationBuild(
  value: unknown,
  diagnostics: ProjectFinishAttestationDiagnostic[],
): ProjectFinishAttestationReceipt["build"] | undefined {
  if (
    !isRecord(value)
    || !exactKeys(value, ["artifactDigest", "commandId", "outcome"])
    || value.commandId !== "build"
    || value.outcome !== "passed"
    || !isDigest(value.artifactDigest)
  ) {
    diagnostics.push(wrong("predicate.receipt.build"))
    return undefined
  }
  return { artifactDigest: value.artifactDigest, commandId: "build", outcome: "passed" }
}

function readCommand(
  value: unknown,
  path: string,
  diagnostics: ProjectFinishAttestationDiagnostic[],
): ProjectFinishAttestationCommand | undefined {
  if (
    !isRecord(value)
    || !exactKeys(value, ["argv", "id"])
    || !Array.isArray(value.argv)
    || !value.argv.every(isString)
    || (value.id !== "test" && value.id !== "build")
  ) {
    diagnostics.push({ code: "invalid-field", path })
    return undefined
  }
  return { argv: value.argv, id: value.id }
}

function isCommand(
  value: ProjectFinishAttestationCommand | undefined,
): value is ProjectFinishAttestationCommand {
  return value !== undefined
}

function wrong(path: string): ProjectFinishAttestationDiagnostic {
  return { code: "wrong-policy", path }
}
