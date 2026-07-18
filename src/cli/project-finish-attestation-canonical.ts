import { canonicalJson, sha256Digest } from "./workflow-finish-attestation-canonical.js"

export function canonicalProjectFinishAttestationBytes(value: unknown): Buffer {
  return Buffer.from(`${canonicalJson(value)}\n`)
}

export function canonicalProjectFinishAttestationReceiptDigest(value: unknown): string {
  return sha256Digest(canonicalProjectFinishAttestationBytes(value))
}
