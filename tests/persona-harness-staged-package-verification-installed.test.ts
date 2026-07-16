import { createHash } from "node:crypto"
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import process from "node:process"
import { spawnSync } from "node:child_process"

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"

import { withPackagePackLock } from "./package-pack-lock.js"

const fixtureRoots: string[] = []
const suiteRoots: string[] = []
const SOURCE_SHA = "a".repeat(40)
let installedConsumer: InstalledConsumer | undefined
let packedTarballPath = ""

type JsonRecord = Readonly<Record<string, unknown>>

type InstalledConsumer = {
  readonly cliPath: string
  readonly consumerDir: string
  readonly packageRoot: string
  readonly phPath: string
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function createFixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "persona-staged-package-installed-test-"))
  fixtureRoots.push(root)
  return root
}

function createSuiteRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "persona-staged-package-installed-suite-"))
  suiteRoots.push(root)
  return root
}

function run(
  command: string,
  args: readonly string[],
  cwd: string,
  env: NodeJS.ProcessEnv = packageTestEnvironment(),
) {
  return spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env,
    maxBuffer: 4 * 1024 * 1024,
  })
}

function packageTestEnvironment(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => key !== "NODE_OPTIONS" && !key.startsWith("VITEST")),
  )
  return { ...environment, ...extra }
}

function packageVersion(): string {
  const parsed: unknown = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"))
  if (!isRecord(parsed) || typeof parsed["version"] !== "string") {
    throw new Error("Expected package version")
  }
  return parsed["version"]
}

function packCurrentRepository(root: string): string {
  return withPackagePackLock(() => {
    const packDirectory = join(root, "pack")
    mkdirSync(packDirectory)
    const result = run("npm", ["pack", "--json", "--pack-destination", packDirectory], process.cwd())
    expect(result.status).toBe(0)
    const parsed: unknown = JSON.parse(result.stdout)
    const entry = Array.isArray(parsed) && isRecord(parsed[0]) ? parsed[0] : undefined
    const filename = entry?.["filename"]
    if (typeof filename !== "string") {
      throw new Error("Expected packed tarball filename")
    }
    return join(packDirectory, filename)
  })
}

function installConsumer(root: string, tarballPath: string): InstalledConsumer {
  const npmCacheDirectory = join(root, "npm-cache")
  const consumerDir = join(root, "consumer")
  mkdirSync(npmCacheDirectory)
  mkdirSync(consumerDir)
  writeFileSync(join(consumerDir, "package.json"), `${JSON.stringify({ private: true, type: "module" })}\n`)
  const install = run(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--no-save",
      "--package-lock=false",
      "--cache",
      npmCacheDirectory,
      tarballPath,
    ],
    consumerDir,
  )
  expect(install.status).toBe(0)
  const packageRoot = join(consumerDir, "node_modules", "persona-harness")
  const cliPath = join(packageRoot, "dist", "cli", "index.js")
  const phPath = join(consumerDir, "node_modules", ".bin", "ph")
  expect(existsSync(cliPath)).toBe(true)
  expect(existsSync(phPath)).toBe(true)
  return { cliPath, consumerDir, packageRoot, phPath }
}

function writeFacts(root: string, tarballPath: string): readonly string[] {
  const version = packageVersion()
  const tarballBytes = readFileSync(tarballPath)
  const sha1 = createHash("sha1").update(tarballBytes).digest("hex")
  const integrity = `sha512-${createHash("sha512").update(tarballBytes).digest("base64")}`
  const planPath = join(root, "plan.json")
  const preflightPath = join(root, "preflight.json")
  const registryFactsPath = join(root, "registry.json")

  writeFileSync(planPath, `${JSON.stringify({
    canonicalMainHead: SOURCE_SHA,
    packageName: "persona-harness",
    packageVersion: version,
    promotionTarget: "next",
    schemaVersion: "staged-package-plan.1",
    sourceHead: SOURCE_SHA,
    sourceTag: `v${version}`,
    stagedTag: "next",
  })}\n`)
  writeFileSync(preflightPath, `${JSON.stringify({
    exactVersion: "absent",
    outputDigest: `sha256:${"b".repeat(64)}`,
    packageName: "persona-harness",
    schemaVersion: "staged-package-preflight.1",
    version,
  })}\n`)
  writeFileSync(registryFactsPath, `${JSON.stringify({
    distTags: { next: version },
    gitHead: SOURCE_SHA,
    integrity,
    packageName: "persona-harness",
    schemaVersion: "staged-package-registry-facts.1",
    shasum: sha1,
    version,
  })}\n`)
  return [
    "--plan",
    planPath,
    "--preflight",
    preflightPath,
    "--registry-facts",
    registryFactsPath,
    "--tarball",
    tarballPath,
  ]
}

function writeStagingFacts(root: string, tarballPath: string): readonly string[] {
  const version = packageVersion()
  const tarballBytes = readFileSync(tarballPath)
  const sha1 = createHash("sha1").update(tarballBytes).digest("hex")
  const integrity = `sha512-${createHash("sha512").update(tarballBytes).digest("base64")}`
  const planPath = join(root, "staging-plan.json")
  const preflightPath = join(root, "staging-preflight.json")
  const registryFactsPath = join(root, "staging-registry.json")

  writeFileSync(planPath, `${JSON.stringify({
    canonicalMainHead: SOURCE_SHA,
    packageName: "persona-harness",
    packageVersion: version,
    promotionTarget: "next",
    schemaVersion: "staged-package-plan.1",
    sourceHead: SOURCE_SHA,
    sourceTag: `v${version}`,
    stagedTag: "staging",
  })}\n`)
  writeFileSync(preflightPath, `${JSON.stringify({
    exactVersion: "absent",
    outputDigest: `sha256:${"b".repeat(64)}`,
    packageName: "persona-harness",
    schemaVersion: "staged-package-preflight.1",
    version,
  })}\n`)
  writeFileSync(registryFactsPath, `${JSON.stringify({
    distTags: { staging: version },
    gitHead: SOURCE_SHA,
    integrity,
    packageName: "persona-harness",
    schemaVersion: "staged-package-registry-facts.1",
    shasum: sha1,
    version,
  })}\n`)
  return [
    "--plan",
    planPath,
    "--preflight",
    preflightPath,
    "--registry-facts",
    registryFactsPath,
    "--tarball",
    tarballPath,
  ]
}

function npmExecutable(): string {
  const result = run("which", ["npm"], process.cwd())
  if (result.status !== 0 || result.stdout.trim().length === 0) {
    throw new Error("Expected npm executable")
  }
  return result.stdout.trim()
}

function provenanceNpmPath(root: string): string {
  const binDirectory = join(root, "bin")
  const wrapperPath = join(binDirectory, "npm")
  mkdirSync(binDirectory)
  writeFileSync(
    wrapperPath,
    [
      "#!/bin/sh",
      "if [ \"$1\" = \"audit\" ] && [ \"$2\" = \"signatures\" ] && [ \"$3\" = \"--json\" ]; then",
      "  printf '{}\\n'",
      "  exit 0",
      "fi",
      `exec ${JSON.stringify(npmExecutable())} \"$@\"`,
      "",
    ].join("\n"),
  )
  chmodSync(wrapperPath, 0o755)
  return binDirectory
}

function parseResult(result: { readonly status: number | null; readonly stderr: string; readonly stdout: string }): JsonRecord {
  if (result.stdout.length === 0) {
    throw new Error(
      `Expected staged verification JSON (status=${String(result.status)}, stdoutBytes=0, stderrBytes=${result.stderr.length})`,
    )
  }
  const parsed: unknown = JSON.parse(result.stdout)
  if (!isRecord(parsed)) {
    throw new Error("Expected staged verification JSON")
  }
  return parsed
}

afterEach(() => {
  for (const root of fixtureRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true })
  }
})

afterAll(() => {
  for (const root of suiteRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true })
  }
})

describe("installed staged package verification CLI", () => {
  beforeAll(() => {
    const root = createSuiteRoot()
    packedTarballPath = packCurrentRepository(root)
    installedConsumer = installConsumer(root, packedTarballPath)
  }, 60_000)

  function consumer(): InstalledConsumer {
    if (installedConsumer === undefined) {
      throw new Error("Expected installed consumer")
    }
    return installedConsumer
  }

  it("runs all eight checks from a fresh local-tarball install without authorizing promotion", { timeout: 60_000 }, () => {
    const root = createFixtureRoot()
    const repositoryManifestBefore = readFileSync(join(process.cwd(), "package.json"), "utf8")
    const repositoryLockBefore = readFileSync(join(process.cwd(), "package-lock.json"), "utf8")
    const installed = consumer()
    const installedHelp = run(installed.phPath, ["--help"], installed.consumerDir)
    expect(installedHelp.status).toBe(0)
    expect(installedHelp.stdout).toContain("Usage: ph")
    const npmBin = provenanceNpmPath(root)
    const result = run(
      installed.phPath,
      ["dev", "staged-package", ...writeFacts(root, packedTarballPath), "--json"],
      installed.consumerDir,
      packageTestEnvironment({ PATH: `${npmBin}:${process.env.PATH ?? ""}` }),
    )
    const payload = parseResult(result)

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
    expect(existsSync(join(installed.packageRoot, "dist", "cli", "staged-package-verification-command.js"))).toBe(true)
    expect(existsSync(join(installed.packageRoot, "tests"))).toBe(false)
    expect(payload["verificationStatus"]).toBe("verified")
    expect(payload["promotionAuthorized"]).toBe(false)
    expect(payload["promotionDecision"]).toBe("release-approval-required")
    expect(payload["registryMutation"]).toBe("not-performed")
    expect(payload["installed"]).toMatchObject({
      authorityBlocked: "verified",
      cliHelp: "verified",
      closureAuthorityParity: "verified",
      exactVersion: "verified",
      npmTest: "verified",
      sourceCheckoutIndependent: "verified",
      version: "verified",
      workflowHelp: "verified",
    })
    expect(readFileSync(join(process.cwd(), "package.json"), "utf8")).toBe(repositoryManifestBefore)
    expect(readFileSync(join(process.cwd(), "package-lock.json"), "utf8")).toBe(repositoryLockBefore)
  })

  it("verifies fixed staging facts from the packed installed CLI without promotion", { timeout: 60_000 }, () => {
    const root = createFixtureRoot()
    const installed = consumer()
    const npmBin = provenanceNpmPath(root)
    const result = run(
      installed.phPath,
      ["dev", "staged-package", ...writeStagingFacts(root, packedTarballPath), "--json"],
      installed.consumerDir,
      packageTestEnvironment({ PATH: `${npmBin}:${process.env.PATH ?? ""}` }),
    )
    const payload = parseResult(result)

    expect(result.status).toBe(0)
    expect(payload["verificationStatus"]).toBe("verified")
    expect(payload["promotionAuthorized"]).toBe(false)
    expect(payload["promotionDecision"]).toBe("release-approval-required")
    expect(payload["registryMutation"]).toBe("not-performed")
  })

  it("keeps hostile paths out of the installed CLI result", () => {
    const root = createFixtureRoot()
    const installed = consumer()
    const secret = "sk-live-aaaaaaaaaaaaaaaaaaaaaaaa"
    const hostilePath = `/private/tmp/${secret}/fact.json`
    const result = run(installed.phPath, [
      "dev",
      "staged-package",
      "--plan",
      hostilePath,
      "--preflight",
      hostilePath,
      "--registry-facts",
      hostilePath,
      "--tarball",
      hostilePath,
      "--json",
    ], installed.consumerDir)
    const output = `${result.stdout}\n${result.stderr}`

    expect(result.status).toBe(1)
    expect(output).toContain("staged-plan-invalid")
    expect(output).not.toContain(secret)
    expect(output).not.toContain("/private/tmp/")
    expect(output).toContain("\"promotionAuthorized\": false")
    expect(output).toContain("\"registryMutation\": \"not-performed\"")
  })
})
