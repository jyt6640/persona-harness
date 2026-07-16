import { createHash } from "node:crypto"
import { spawnSync } from "node:child_process"
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import process from "node:process"

import { assessStagedPackageVerification } from "./staged-package-verification-core.mjs"
import {
  createStablePromotionConsumer,
  writeStablePromotionWorkflowFixture,
} from "./stable-promotion-completion-integrity.mjs"

const MAX_FACT_BYTES = 64 * 1024
const MAX_TARBALL_BYTES = 64 * 1024 * 1024

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 128 * 1024,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  })
  return {
    output: `${result.stdout ?? ""}\n${result.stderr ?? ""}`,
    status: typeof result.status === "number" ? result.status : 1,
  }
}

function isRegularBoundedFile(filePath, maxBytes) {
  try {
    const stat = lstatSync(filePath)
    return stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 && stat.size <= maxBytes
  } catch {
    return false
  }
}

function readJsonFact(filePath, schemaVersion) {
  if (!isRegularBoundedFile(filePath, MAX_FACT_BYTES)) return {}
  try {
    const value = JSON.parse(readFileSync(filePath, "utf8"))
    return typeof value === "object"
      && value !== null
      && !Array.isArray(value)
      && value.schemaVersion === schemaVersion
      ? value
      : {}
  } catch {
    return {}
  }
}

function readTarballFacts(tarballPath) {
  if (!isRegularBoundedFile(tarballPath, MAX_TARBALL_BYTES)) return undefined
  try {
    const bytes = readFileSync(tarballPath)
    return {
      integrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}`,
      sha1: createHash("sha1").update(bytes).digest("hex"),
      sha256: createHash("sha256").update(bytes).digest("hex"),
    }
  } catch {
    return undefined
  }
}

function hasNoFinishPass(output) {
  return !output.includes("Finish status: PASS") && !output.includes('"finish":"pass"')
}

function runInstalledStagedPackageMatrix(consumer, tempRoot) {
  const fixtureDir = join(tempRoot, "authority-fixture")
  mkdirSync(fixtureDir, { recursive: true })
  const fixtureReady = writeStablePromotionWorkflowFixture(fixtureDir, consumer.cliPath, run)
  const npmTest = run("npm", ["test"], consumer.packageRoot)
  const help = run(process.execPath, [consumer.cliPath, "--help"], consumer.consumerDir)
  const version = run(process.execPath, [consumer.cliPath, "version"], consumer.consumerDir)
  const workflowHelp = run(process.execPath, [consumer.cliPath, "workflow", "--help"], consumer.consumerDir)
  const finish = fixtureReady
    ? run(process.execPath, [consumer.cliPath, "workflow", "finish", "implement"], fixtureDir)
    : { output: "", status: 1 }

  return {
    authorityBlocked:
      finish.status !== 0
      && finish.output.includes("trusted-authority-required")
      && hasNoFinishPass(finish.output),
    cliHelp: help.status === 0 && help.output.includes("Usage: ph"),
    npmTest: npmTest.status === 0 && npmTest.output.includes("Persona Harness"),
    sourceCheckoutIndependent:
      !existsSync(join(consumer.packageRoot, "tests"))
      && !existsSync(join(consumer.packageRoot, "scripts", "check-mvp-scope.mjs")),
    version: version.status === 0 && version.output.trim() === consumer.version,
    workflowHelp: workflowHelp.status === 0 && workflowHelp.output.includes("Usage: ph workflow"),
  }
}

function provenanceFact(consumer, provenanceRunner) {
  const result = provenanceRunner({
    consumerDir: consumer.consumerDir,
    packageName: consumer.packageName,
    packageRoot: consumer.packageRoot,
    packageVersion: consumer.version,
  })
  return {
    method: "npm-audit-signatures",
    outputDigest: `sha256:${createHash("sha256").update(result.output).digest("hex")}`,
    status: result.status === 0 ? "verified" : "unverified",
  }
}

function verifyProvenance({ consumerDir }) {
  return run("npm", ["audit", "signatures", "--json"], consumerDir)
}

export function runStagedPackageVerification(options) {
  const plan = readJsonFact(options.planPath, "staged-package-plan.1")
  const preflight = readJsonFact(options.preflightPath, "staged-package-preflight.1")
  const registry = readJsonFact(options.registryFactsPath, "staged-package-registry-facts.1")
  const tarballFacts = readTarballFacts(options.tarballPath)
  const tempRoot = mkdtempSync(join(tmpdir(), "persona-staged-package-verification-"))
  try {
    const consumer = tarballFacts === undefined
      ? undefined
      : createStablePromotionConsumer(tempRoot, resolve(options.tarballPath))
    const matrix = consumer === undefined
      ? {}
      : runInstalledStagedPackageMatrix(consumer, tempRoot)
    const provenance = consumer === undefined
      ? {
          method: "npm-audit-signatures",
          outputDigest: `sha256:${createHash("sha256").update("").digest("hex")}`,
          status: "unverified",
        }
      : provenanceFact(consumer, options.provenanceRunner ?? verifyProvenance)
    const tarball = consumer === undefined || tarballFacts === undefined
      ? {}
      : {
          ...tarballFacts,
          packageName: consumer.packageName,
          version: consumer.version,
        }
    const installed = consumer === undefined
      ? {}
      : {
          ...matrix,
          exactVersion: consumer.version === plan.packageVersion,
        }
    return assessStagedPackageVerification({ installed, plan, preflight, provenance, registry, tarball })
  } finally {
    rmSync(tempRoot, { force: true, recursive: true })
  }
}
