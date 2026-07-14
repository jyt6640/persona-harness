import { createHash } from "node:crypto"
import { fileURLToPath } from "node:url"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { bundleFromJSON, assertBundleLatest, type BundleLatest } from "@sigstore/bundle"
import { TrustedRoot } from "@sigstore/protobuf-specs"
import { toSignedEntity, toTrustMaterial, Verifier } from "@sigstore/verify"

import { isRecord } from "../config/jsonc.js"
import { resolveSafeEvidenceRootResult } from "../config/harness-config.js"
import { captureGitIdentity, captureWorkspaceIdentity } from "./ci-reverification-identity.js"
import { personaHarnessVersion } from "./version.js"
import { parseFinishAttestation } from "./workflow-external-finish-attestation-model.js"
import {
  FINISH_ATTESTATION_PREDICATE_TYPE,
  FINISH_ATTESTATION_SCHEMA,
  type ExternalFinishAttestationAssessment,
  type FinishAttestation,
  type FinishAttestationDiagnostic,
} from "./workflow-external-finish-attestation-types.js"

export {
  CLEAN_CI_ARGV,
  CLEAN_CI_CATALOG_ID,
  CLEAN_CI_REF,
  CLEAN_CI_REPOSITORY,
  CLEAN_CI_WORKFLOW,
  FINISH_ATTESTATION_PREDICATE_TYPE,
  FINISH_ATTESTATION_SCHEMA,
} from "./workflow-external-finish-attestation-types.js"
export { parseFinishAttestation } from "./workflow-external-finish-attestation-model.js"
export type {
  ExternalFinishAttestationAssessment,
  FinishAttestation,
  FinishAttestationDiagnostic,
  FinishAttestationParseResult,
} from "./workflow-external-finish-attestation-types.js"

const ATTESTATION_DIR = "external-finish-attestation"
const PRODUCT_TRUST_ROOT_URL = new URL("../assets/github-sigstore-trusted-root.jsonl", import.meta.url)
export function assessExternalFinishAttestation(
  projectDir: string,
  now = new Date(),
): ExternalFinishAttestationAssessment {
  const evidenceRoot = resolveSafeEvidenceRootResult(projectDir)
  if (!evidenceRoot.ok) return blocked("configured evidence root is unsafe", [])
  const directory = join(evidenceRoot.path, ATTESTATION_DIR)
  const receiptPath = join(directory, "receipt.json")
  const bundlePath = join(directory, "bundle.json")
  if (!existsSync(receiptPath) || !existsSync(bundlePath)) return blocked("no external attestation bundle is present", [])
  let receiptBytes: Buffer
  let bundle: BundleLatest
  try {
    receiptBytes = readFileSync(receiptPath)
    const parsedReceipt = parseFinishAttestation(receiptBytes.toString("utf8"), "external-finish-attestation/receipt.json")
    if (!parsedReceipt.ok) return blocked("attestation receipt is invalid", parsedReceipt.diagnostics)
    const consumed = readConsumedState(directory)
    if (consumed === "invalid") return blocked("external attestation replay state is invalid", [])
    if (consumed === "consumed") return blocked("external attestation has already been consumed", [])
    const rootPath = fileURLToPath(PRODUCT_TRUST_ROOT_URL)
    if (!existsSync(rootPath)) return blocked("product-owned Sigstore trust root is unavailable", [])
    const rootLine = readFileSync(rootPath, "utf8").split(/\r?\n/gu).find((line) => line.trim().length > 0)
    if (rootLine === undefined) return blocked("product-owned Sigstore trust root is empty", [])
    const parsedBundle = bundleFromJSON(JSON.parse(readFileSync(bundlePath, "utf8")))
    assertBundleLatest(parsedBundle)
    bundle = parsedBundle
    const root = TrustedRoot.fromJSON(JSON.parse(rootLine))
    const entity = toSignedEntity(bundle, receiptBytes)
    const verifier = new Verifier(toTrustMaterial(root))
    const expectedSan = `https://github.com/${parsedReceipt.value.repository}/${parsedReceipt.value.workflow}@${parsedReceipt.value.ref}`
    const signer = verifier.verify(entity, { subjectAlternativeName: expectedSan })
    if (signer.identity?.extensions?.issuer !== "https://token.actions.githubusercontent.com") {
      return blocked("external attestation issuer is not GitHub Actions OIDC", [])
    }
    const predicate = readPredicate(bundle)
    validatePredicate(predicate, parsedReceipt.value, receiptBytes)
    const workspace = captureWorkspaceIdentity(projectDir)
    if (workspace.status !== "available") return blocked("local workspace identity is unavailable", [])
    const git = captureGitIdentity(projectDir, workspace.value)
    if (!git.available || git.head !== parsedReceipt.value.sourceHead || git.status?.entryCount !== 0) {
      return blocked("local source is not the clean source bound by the attestation", [])
    }
    if (parsedReceipt.value.phVersion !== personaHarnessVersion()) return blocked("Persona Harness version binding differs", [])
    if (Date.parse(parsedReceipt.value.expiresAt) <= now.getTime()) return blocked("external attestation is expired", [])
    return { status: "trusted", authorityEligible: true, reason: "verified clean-CI external attestation", diagnostics: [], receipt: parsedReceipt.value }
  } catch {
    return blocked("cryptographic external attestation verification failed", [])
  }
}

export function consumeExternalFinishAttestation(projectDir: string): ExternalFinishAttestationAssessment {
  const assessment = assessExternalFinishAttestation(projectDir)
  if (assessment.status !== "trusted" || assessment.receipt === undefined) return assessment
  const evidenceRoot = resolveSafeEvidenceRootResult(projectDir)
  if (!evidenceRoot.ok) return blocked("configured evidence root is unsafe", [])
  const directory = join(evidenceRoot.path, ATTESTATION_DIR)
  const receiptPath = join(directory, "receipt.json")
  const consumedPath = join(directory, "consumed.json")
  try {
    writeFileSync(
      consumedPath,
      `${JSON.stringify({
        schemaVersion: "finish-attestation-replay.1",
        receiptDigest: `sha256:${sha256(readFileSync(receiptPath))}`,
        nonce: assessment.receipt.nonce,
      }, null, 2)}\n`,
      { encoding: "utf8", flag: "wx" },
    )
    return assessment
  } catch {
    return blocked("external attestation replay claim could not be acquired", [])
  }
}

function readPredicate(bundle: BundleLatest): unknown {
  if (bundle.content.$case !== "dsseEnvelope") throw new Error("unsupported attestation content")
  const payload = Buffer.from(bundle.content.dsseEnvelope.payload).toString("utf8")
  const statement: unknown = JSON.parse(payload)
  if (!isRecord(statement) || statement.predicateType !== FINISH_ATTESTATION_PREDICATE_TYPE) throw new Error("unexpected predicate type")
  return statement.predicate
}

function validatePredicate(predicate: unknown, receipt: FinishAttestation, receiptBytes: Buffer): void {
  if (!isRecord(predicate) || predicate.schemaVersion !== FINISH_ATTESTATION_SCHEMA || !isRecord(predicate.receipt)) throw new Error("invalid predicate")
  if (canonicalJson(predicate.receipt) !== canonicalJson(receipt)) throw new Error("receipt predicate mismatch")
  if (predicate.receiptDigest !== `sha256:${sha256(receiptBytes)}` || predicate.replayNonce !== receipt.nonce || predicate.replayState !== "unconsumed") {
    throw new Error("predicate binding mismatch")
  }
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(",")}]`
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`
  }
  return JSON.stringify(value)
}

function readConsumedState(directory: string): "absent" | "consumed" | "invalid" {
  const path = join(directory, "consumed.json")
  if (!existsSync(path)) return "absent"
  try {
    const value: unknown = JSON.parse(readFileSync(path, "utf8"))
    if (!isRecord(value) || value.schemaVersion !== "finish-attestation-replay.1" || typeof value.receiptDigest !== "string" || typeof value.nonce !== "string") {
      return "invalid"
    }
    return "consumed"
  } catch {
    return "invalid"
  }
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex")
}

function blocked(reason: string, diagnostics: readonly FinishAttestationDiagnostic[]): ExternalFinishAttestationAssessment {
  return { status: "blocked", authorityEligible: false, reason, diagnostics }
}
