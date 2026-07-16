import { createHash } from "node:crypto"
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"

import {
  runStagedPackageVerification,
  type StagedPackageVerificationOptions,
} from "../src/cli/staged-package-verification-runner.js"
import { withPackagePackLock } from "./package-pack-lock.js"

const fixtureRoots: string[] = []
const suiteRoots: string[] = []
const SOURCE_SHA = "a".repeat(40)
let packedTarballPath = ""

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function createFixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "persona-staged-package-verification-"))
  fixtureRoots.push(root)
  return root
}

function createSuiteRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "persona-staged-package-verification-suite-"))
  suiteRoots.push(root)
  return root
}

function runCommand(command: string, args: readonly string[], cwd: string): { readonly output: string; readonly status: number } {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  })
  return {
    output: `${result.stdout}\n${result.stderr}`,
    status: typeof result.status === "number" ? result.status : 1,
  }
}

function commandRunnerForProvenance(status: number, output: string) {
  return (command: string, args: readonly string[], cwd: string): { readonly output: string; readonly status: number } => {
    if (command === "npm" && args[0] === "audit" && args[1] === "signatures" && args[2] === "--json") {
      return { output, status }
    }
    return runCommand(command, args, cwd)
  }
}

function packCurrentRepository(root: string): string {
  return withPackagePackLock(() => {
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
  })
}

function repackTarball(root: string, tarballPath: string): string {
  const extractionRoot = join(root, "repacked")
  const repackedTarballPath = join(root, "repacked-persona-harness.tgz")
  mkdirSync(extractionRoot)

  const extract = spawnSync("tar", ["-xzf", tarballPath, "-C", extractionRoot], {
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  })
  expect(extract.status).toBe(0)
  appendFileSync(join(extractionRoot, "package", "README.md"), "\nrepacked fixture\n")

  const repack = spawnSync("tar", ["-czf", repackedTarballPath, "-C", extractionRoot, "package"], {
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  })
  expect(repack.status).toBe(0)
  return repackedTarballPath
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
    promotionTarget: "next",
    schemaVersion: "staged-package-plan.1",
    sourceHead: SOURCE_SHA,
    sourceTag: `v${packageVersion}`,
    stagedTag: "staging",
  })}\n`)
  writeFileSync(preflightPath, `${JSON.stringify({
    exactVersion: "absent",
    outputDigest: `sha256:${"b".repeat(64)}`,
    packageName: "persona-harness",
    schemaVersion: "staged-package-preflight.1",
    version: packageVersion,
  })}\n`)
  writeFileSync(registryFactsPath, `${JSON.stringify({
    distTags: { staging: packageVersion },
    gitHead: SOURCE_SHA,
    integrity,
    packageName: "persona-harness",
    schemaVersion: "staged-package-registry-facts.1",
    shasum: sha1,
    version: packageVersion,
  })}\n`)

  return {
    commandRunner: commandRunnerForProvenance(0, "verified"),
    planPath,
    preflightPath,
    registryFactsPath,
    tarballPath,
  }
}

afterEach(() => {
  for (const fixtureRoot of fixtureRoots.splice(0)) {
    rmSync(fixtureRoot, { force: true, recursive: true })
  }
})

afterAll(() => {
  for (const suiteRoot of suiteRoots.splice(0)) {
    rmSync(suiteRoot, { force: true, recursive: true })
  }
})

describe("staged package verification runner", () => {
  beforeAll(() => {
    packedTarballPath = packCurrentRepository(createSuiteRoot())
  }, 60_000)

  it("runs a fresh exact-version installed black-box while requiring artifact provenance", { timeout: 60_000 }, () => {
    const root = createFixtureRoot()
    const options = writeFacts(root, packedTarballPath)

    const result = runStagedPackageVerification(options)

    expect(result.verificationStatus).toBe("blocked")
    expect(result.diagnostics).toContain("artifact-provenance-unavailable")
    expect(result.promotionAuthorized).toBe(false)
    expect(result.promotionDecision).toBe("release-approval-required")
    expect(result.installed).toMatchObject({
      authorityBlocked: "verified",
      cliHelp: "verified",
      closureAuthorityParity: "verified",
      exactVersion: "verified",
      npmTest: "verified",
      sourceCheckoutIndependent: "verified",
      version: "verified",
      workflowHelp: "verified",
    })
  })

  it("blocks caller-coordinated facts for a same-name version repacked tarball", { timeout: 60_000 }, () => {
    const root = createFixtureRoot()
    const repackedTarballPath = repackTarball(root, packedTarballPath)
    const options = writeFacts(root, repackedTarballPath)
    let genericAuditCalls = 0
    const result = runStagedPackageVerification({
      ...options,
      commandRunner: (command, args, cwd) => {
        if (command === "npm" && args[0] === "audit" && args[1] === "signatures" && args[2] === "--json") {
          genericAuditCalls += 1
          return { output: "verified", status: 0 }
        }
        return runCommand(command, args, cwd)
      },
    })

    expect(result.verificationStatus).toBe("blocked")
    expect(result.diagnostics).toContain("artifact-provenance-unavailable")
    expect(result.promotionAuthorized).toBe(false)
    expect(result.promotionDecision).toBe("release-approval-required")
    expect(result.registryMutation).toBe("not-performed")
    expect(genericAuditCalls).toBe(0)
  })

  it("keeps generic audit failures diagnostic-only without artifact provenance", () => {
    const root = createFixtureRoot()
    const secret = "sk-live-aaaaaaaaaaaaaaaaaaaaaaaa"
    const options = writeFacts(root, packedTarballPath)
    const result = runStagedPackageVerification({
      ...options,
      commandRunner: commandRunnerForProvenance(1, `${secret} /private/tmp/secret`),
    })

    expect(result.verificationStatus).toBe("blocked")
    expect(result.diagnostics).toContain("artifact-provenance-unavailable")
    expect(JSON.stringify(result)).not.toContain(secret)
    expect(JSON.stringify(result)).not.toContain("/private/tmp/secret")
  })

  it("fails closed without following a symlinked fact path", () => {
    const root = createFixtureRoot()
    const options = writeFacts(root, packedTarballPath)
    const linkedPlanPath = join(root, "linked-plan.json")
    const secret = "sk-live-aaaaaaaaaaaaaaaaaaaaaaaa"

    writeFileSync(options.planPath, `{"payload":"${secret}"`)
    symlinkSync(options.planPath, linkedPlanPath)
    const result = runStagedPackageVerification({
      ...options,
      planPath: linkedPlanPath,
    })

    expect(result.verificationStatus).toBe("blocked")
    expect(result.diagnostics).toContain("staged-plan-invalid")
    expect(JSON.stringify(result)).not.toContain(secret)
    expect(JSON.stringify(result)).not.toContain(linkedPlanPath)
  })

  it("fails closed without reflecting malformed fact contents", () => {
    const root = createFixtureRoot()
    const options = writeFacts(root, packedTarballPath)
    const secret = "sk-live-aaaaaaaaaaaaaaaaaaaaaaaa"

    writeFileSync(options.registryFactsPath, `{"marker":"${secret}"`)
    const result = runStagedPackageVerification(options)

    expect(result.verificationStatus).toBe("blocked")
    expect(result.diagnostics).toContain("registry-facts-invalid")
    expect(JSON.stringify(result)).not.toContain(secret)
  })

  it("fails closed without reflecting oversized fact contents", () => {
    const root = createFixtureRoot()
    const options = writeFacts(root, packedTarballPath)
    const secret = "sk-live-aaaaaaaaaaaaaaaaaaaaaaaa"

    writeFileSync(
      options.planPath,
      `${JSON.stringify({ marker: `${secret}${"x".repeat(64 * 1024)}`, schemaVersion: "staged-package-plan.1" })}\n`,
    )
    const result = runStagedPackageVerification({
      ...options,
      tarballPath: join(root, "missing.tgz"),
    })

    expect(result.verificationStatus).toBe("blocked")
    expect(result.diagnostics).toContain("staged-plan-invalid")
    expect(JSON.stringify(result)).not.toContain(secret)
  })
})
