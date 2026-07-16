import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

describe("finish-attestation package contract", () => {
  it("packages the fixed product-owned verifier worker without gh authority code", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      readonly files?: readonly string[]
    }
    const worker = readFileSync("scripts/verify-finish-attestation.mjs", "utf8")

    expect(packageJson.files ?? []).toContain("scripts/verify-finish-attestation.mjs")
    expect(worker).toContain("@sigstore/tuf")
    expect(worker).toContain("forceCache: false")
    expect(worker).not.toContain("gh ")
    expect(worker).not.toContain("process.env")
    expect(worker).not.toContain("spawn")
    expect(worker).not.toContain("shell")
  })
})
