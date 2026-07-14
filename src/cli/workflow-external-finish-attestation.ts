import { createHash } from "node:crypto"
import { fileURLToPath } from "node:url"
import { existsSync, readFileSync } from "node:fs"
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
    verifier.verify(entity, { subjectAlternativeName: expectedSan })
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

function readPredicate(bundle: BundleLatest): unknown {
  if (bundle.content.$case !== "dsseEnvelope") throw new Error("unsupported attestation content")
  const payload = Buffer.from(bundle.content.dsseEnvelope.payload).toString("utf8")
  const statement: unknown = JSON.parse(payload)
  if (!isRecord(statement) || statement.predicateType !== FINISH_ATTESTATION_PREDICATE_TYPE) throw new Error("unexpected predicate type")
  return statement.predicate
}

function validatePredicate(predicate: unknown, receipt: FinishAttestation, receiptBytes: Buffer): void {
  if (!isRecord(predicate) || predicate.schemaVersion !== FINISH_ATTESTATION_SCHEMA || !isRecord(predicate.receipt)) throw new Error("invalid predicate")
  if (JSON.stringify(predicate.receipt) !== JSON.stringify(receipt)) throw new Error("receipt predicate mismatch")
  if (predicate.receiptDigest !== `sha256:${sha256(receiptBytes)}` || predicate.replayNonce !== receipt.nonce || predicate.replayState !== "unconsumed") {
    throw new Error("predicate binding mismatch")
  }
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex")
}

function blocked(reason: string, diagnostics: readonly FinishAttestationDiagnostic[]): ExternalFinishAttestationAssessment {
  return { status: "blocked", authorityEligible: false, reason, diagnostics }
}
