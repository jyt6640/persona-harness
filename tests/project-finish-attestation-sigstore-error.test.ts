import { describe, expect, it } from "vitest"

import {
  classifyProjectFinishTrustRootError,
  classifyProjectFinishVerificationError,
} from "../scripts/project-finish-attestation-sigstore-error.mjs"

describe("project finish attestation Sigstore safe failure classification", () => {
  it.each([
    ["ENOTFOUND", "dns-unavailable"],
    ["EAI_AGAIN", "dns-unavailable"],
    ["ECONNREFUSED", "network-unavailable"],
    ["UND_ERR_CONNECT_TIMEOUT", "network-unavailable"],
    ["ETIMEDOUT", "verification-timeout"],
  ] as const)("maps a bounded nested %s trust error to %s", (code, state) => {
    const error = {
      cause: {
        cause: { code, secret: "sk-live-do-not-emit" },
        code: "FETCH_ERROR",
      },
      code: "TUF_REFRESH_METADATA_ERROR",
    }

    expect(classifyProjectFinishTrustRootError(error)).toBe(state)
  })

  it("maps an unrecognized trust failure to trust-root-unavailable without serializing the error", () => {
    const error = {
      cause: { message: "https://signed.example.invalid/?token=secret" },
      code: "TUF_REFRESH_METADATA_ERROR",
    }

    expect(classifyProjectFinishTrustRootError(error)).toBe("trust-root-unavailable")
  })

  it.each([
    ["SIGNATURE_ERROR", "signature-invalid"],
    ["PUBLIC_KEY_ERROR", "signature-invalid"],
    ["CERTIFICATE_ERROR", "certificate-invalid"],
    ["UNTRUSTED_SIGNER_ERROR", "certificate-invalid"],
    ["TIMESTAMP_ERROR", "transparency-invalid"],
    ["TLOG_BODY_ERROR", "transparency-invalid"],
    ["TLOG_INCLUSION_PROOF_ERROR", "transparency-invalid"],
  ] as const)("maps Sigstore %s to %s", (code, state) => {
    expect(classifyProjectFinishVerificationError({ code })).toBe(state)
  })

  it("keeps unknown cryptographic failures fail-closed", () => {
    expect(classifyProjectFinishVerificationError({ code: "UNKNOWN_ERROR" })).toBe("crypto-failed")
  })
})
