import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const BUNDLE_FIXTURE_PATH = "tests/fixtures/finish-attestation/protected-main-29511625395.bundle.json"
const MANIFEST_FIXTURE_PATH = "tests/fixtures/finish-attestation/protected-main-29511625395.manifest.json"
const FRESH_BUNDLE_FIXTURE_PATH = "tests/fixtures/finish-attestation/protected-main-29547139231.bundle.json"
const FRESH_MANIFEST_FIXTURE_PATH = "tests/fixtures/finish-attestation/protected-main-29547139231.manifest.json"

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

  it("tracks the original signed fixture and keeps it outside the runtime package", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      readonly files?: readonly string[]
    }
    const trackedPaths = execFileSync("git", ["ls-files", "--error-unmatch", BUNDLE_FIXTURE_PATH, MANIFEST_FIXTURE_PATH], {
      cwd: process.cwd(),
      encoding: "utf8",
    }).trim().split("\n")
    const manifest = JSON.parse(readFileSync(MANIFEST_FIXTURE_PATH, "utf8")) as {
      readonly artifactId: number
      readonly artifactZipSha256: string
      readonly bundleSha256: string
      readonly jobId: string
      readonly runId: string
      readonly sourceHead: string
      readonly testFacts: {
        readonly count: number
        readonly failed: number
        readonly passed: number
        readonly skipped: number
      }
    }
    const bundleDigest = createHash("sha256").update(readFileSync(BUNDLE_FIXTURE_PATH)).digest("hex")
    const runtimeFiles = packageJson.files ?? []

    expect(trackedPaths).toEqual([BUNDLE_FIXTURE_PATH, MANIFEST_FIXTURE_PATH])
    expect(manifest).toMatchObject({
      artifactId: 8380944195,
      artifactZipSha256: "448afbba6db79c1c6fe591fbe7ccc4d63bbdaea515695cf3135cf067e62c9f84",
      bundleSha256: "262a8d40669ac3ecc96cd48b753ae2413e448e64813bde8e1eb5455df5774db0",
      jobId: "87666253022",
      runId: "29511625395",
      sourceHead: "84901174235f0a9c7bc08f0dbd5be6d94c02d500",
      testFacts: { count: 1227, failed: 0, passed: 1221, skipped: 6 },
    })
    expect(bundleDigest).toBe(manifest.bundleSha256)
    expect(runtimeFiles.some((path) => path.startsWith("tests/fixtures/"))).toBe(false)
  })

  it("tracks the current protected-main signed fixture and binds its immutable manifest", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      readonly files?: readonly string[]
    }
    const trackedPaths = execFileSync("git", ["ls-files", "--error-unmatch", FRESH_BUNDLE_FIXTURE_PATH, FRESH_MANIFEST_FIXTURE_PATH], {
      cwd: process.cwd(),
      encoding: "utf8",
    }).trim().split("\n")
    const manifest = JSON.parse(readFileSync(FRESH_MANIFEST_FIXTURE_PATH, "utf8")) as {
      readonly artifactId: number
      readonly artifactZipSha256: string
      readonly bundleSha256: string
      readonly jobId: string
      readonly runId: string
      readonly sourceHead: string
      readonly testFacts: {
        readonly count: number
        readonly failed: number
        readonly passed: number
        readonly skipped: number
      }
    }
    const bundleDigest = createHash("sha256").update(readFileSync(FRESH_BUNDLE_FIXTURE_PATH)).digest("hex")
    const runtimeFiles = packageJson.files ?? []

    expect(trackedPaths).toEqual([FRESH_BUNDLE_FIXTURE_PATH, FRESH_MANIFEST_FIXTURE_PATH])
    expect(manifest).toMatchObject({
      artifactId: 8394443498,
      artifactZipSha256: "3fa86796d084097f24d840b9277ad05354f103ba62df3f4590dcd385b228678e",
      bundleSha256: "3669383e48d3dc31bc22f0964ed056e9445365fc1233037a911db974d0e54e07",
      jobId: "87781776913",
      runId: "29547139231",
      sourceHead: "24383ca61eb806c0f107e8f64af1911845eb159a",
      testFacts: { count: 1274, failed: 0, passed: 1268, skipped: 6 },
    })
    expect(bundleDigest).toBe(manifest.bundleSha256)
    expect(runtimeFiles.some((path) => path.startsWith("tests/fixtures/"))).toBe(false)
  })
})
