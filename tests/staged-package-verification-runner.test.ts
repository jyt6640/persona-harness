import { createHash } from "node:crypto"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

import { afterEach, describe, expect, it } from "vitest"

import {
  runStagedPackageVerification,
  type StagedPackageVerificationOptions,
} from "../scripts/staged-package-verification.mjs"

const fixtureRoots: string[] = []
const SOURCE_SHA = "a".repeat(40)

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function createFixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "persona-staged-package-verification-"))
  fixtureRoots.push(root)
  return root
}

function packCurrentRepository(root: string): string {
  const packDirectory = join(root, "pack")
  mkdirSync(packDirectory)
  const result = spawnSync("npm", ["pack", "--json", "--pack-destination", packDirectory], {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  })

  expect(result.status).toBe(0)
  const parsed: unknown = JSON.parse(result.stdout)
  expect(Array.isArray(parsed)).toBe(true)
  const entry = Array.isArray(parsed) && isRecord(parsed[0]) ? parsed[0] : undefined
  const filename = entry?.["filename"]
  expect(typeof filename).toBe("string")
  return join(packDirectory, typeof filename === "string" ? filename : "missing.tgz")
}

function writeFacts(root: string, tarballPath: string): StagedPackageVerificationOptions {
  const packageJson: unknown = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"))
  expect(typeof packageJson).toBe("object")
  const version = isRecord(packageJson) ? packageJson["version"] : undefined
  expect(typeof version).toBe("string")
  const packageVersion = typeof version === "string" ? version : "0.0.0"
  const tarballBytes = readFileSync(tarballPath)
  const sha1 = createHash("sha1").update(tarballBytes).digest("hex")
  const sha256 = createHash("sha256").update(tarballBytes).digest("hex")
  const integrity = `sha512-${createHash("sha512").update(tarballBytes).digest("base64")}`
  const planPath = join(root, "plan.json")
  const preflightPath = join(root, "preflight.json")
  const registryFactsPath = join(root, "registry.json")

  writeFileSync(planPath, `${JSON.stringify({
    canonicalMainHead: SOURCE_SHA,
    packageName: "persona-harness",
    packageVersion,
    promotionTarget: "latest",
    schemaVersion: "staged-package-plan.1",
    sourceHead: SOURCE_SHA,
    sourceTag: `v${packageVersion}`,
    stagedTag: "next",
  })}\n`)
  writeFileSync(preflightPath, `${JSON.stringify({
    exactVersion: "absent",
    outputDigest: `sha256:${"b".repeat(64)}`,
    packageName: "persona-harness",
    schemaVersion: "staged-package-preflight.1",
    version: packageVersion,
  })}\n`)
  writeFileSync(registryFactsPath, `${JSON.stringify({
    distTags: { latest: "0.0.0", next: packageVersion },
    gitHead: SOURCE_SHA,
    integrity,
    packageName: "persona-harness",
    schemaVersion: "staged-package-registry-facts.1",
    shasum: sha1,
    version: packageVersion,
  })}\n`)

  return {
    planPath,
    preflightPath,
    provenanceRunner: () => ({ output: "verified", status: 0 }),
    registryFactsPath,
    tarballPath,
  }
}

afterEach(() => {
  for (const fixtureRoot of fixtureRoots.splice(0)) {
    rmSync(fixtureRoot, { force: true, recursive: true })
  }
})

describe("staged package verification runner", () => {
  it("runs a fresh exact-version installed black-box while retaining a non-promoting result", () => {
    const root = createFixtureRoot()
    const options = writeFacts(root, packCurrentRepository(root))

    const result = runStagedPackageVerification(options)

    expect(result.verificationStatus).toBe("verified")
    expect(result.promotionAuthorized).toBe(false)
    expect(result.promotionDecision).toBe("release-approval-required")
    expect(result.installed).toMatchObject({
      authorityBlocked: "verified",
      cliHelp: "verified",
      exactVersion: "verified",
      npmTest: "verified",
      sourceCheckoutIndependent: "verified",
      version: "verified",
      workflowHelp: "verified",
    })
  })

  it("fails closed when the provenance verifier reports a bounded failure", () => {
    const root = createFixtureRoot()
    const secret = "sk-live-aaaaaaaaaaaaaaaaaaaaaaaa"
    const options = writeFacts(root, packCurrentRepository(root))
    const result = runStagedPackageVerification({
      ...options,
      provenanceRunner: () => ({ output: `${secret} /private/tmp/secret`, status: 1 }),
    })

    expect(result.verificationStatus).toBe("blocked")
    expect(result.diagnostics).toContain("provenance-unverified")
    expect(JSON.stringify(result)).not.toContain(secret)
    expect(JSON.stringify(result)).not.toContain("/private/tmp/secret")
  })
})
