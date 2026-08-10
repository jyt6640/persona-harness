import { createHash } from "node:crypto"

import { describe, expect, it } from "vitest"

import { decodeStagedPackageArtifactSnappy } from "../scripts/staged-package-artifact-provenance-network.mjs"
import { StagedPackageArtifactProvenanceError } from "../scripts/staged-package-artifact-provenance-policy.mjs"

const COMPRESSED_JSON = Buffer.from(
  "N4h7InN1YmplY3QiOiJwZXJzb25hLWhhcm5lc3MiLCJwcm9vZgEaPG9ydGFibGUtc25hcHB5In0=",
  "base64",
)
const EXPECTED_JSON = Buffer.from('{"subject":"persona-harness","proof":"portable-snappy"}', "utf8")

function expectProvenanceError(run: () => void, code: string): void {
  try {
    run()
    throw new Error("expected a provenance error")
  } catch (error) {
    expect(error).toBeInstanceOf(StagedPackageArtifactProvenanceError)
    expect(error).toMatchObject({ code })
  }
}

describe("staged package artifact Snappy transport", () => {
  it("decodes a native-compatible Snappy vector without a native consumer dependency", () => {
    const decoded = decodeStagedPackageArtifactSnappy(COMPRESSED_JSON, 1024)

    expect(decoded).toEqual(EXPECTED_JSON)
    expect(createHash("sha256").update(decoded).digest("hex")).toBe(
      "b66ef64fe46613ee2ec12d238e0885e06eb91b8183a50d81f6cfd917e5da8cdf",
    )
  })

  it("keeps malformed and declared-over-limit input fail closed", () => {
    expectProvenanceError(
      () => decodeStagedPackageArtifactSnappy(COMPRESSED_JSON, 54),
      "artifact-provenance-unavailable",
    )
    expectProvenanceError(
      () => decodeStagedPackageArtifactSnappy(Buffer.from([0x80]), 1024),
      "artifact-provenance-network-invalid",
    )
  })
})
