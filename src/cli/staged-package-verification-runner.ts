import { createHash } from "node:crypto"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

import { assessStagedPackageVerification, type StagedPackageVerificationResult } from "./staged-package-verification-core.js"
import {
  createInstalledConsumer,
  installedTarballFacts,
  readProvenanceFact,
  runInstalledStagedPackageMatrix,
} from "./staged-package-verification-installed.js"
import {
  readJsonFact,
  readTarballFacts,
  runStagedPackageCommand,
  type CommandRunner,
} from "./staged-package-verification-runtime.js"
import type { JsonRecord } from "./staged-package-verification-types.js"

export type StagedPackageVerificationOptions = {
  readonly commandRunner?: CommandRunner
  readonly planPath: string
  readonly preflightPath: string
  readonly registryFactsPath: string
  readonly tarballPath: string
}

function planVersion(plan: JsonRecord): unknown {
  return plan["packageVersion"]
}

function unavailableProvenance() {
  return {
    method: "npm-audit-signatures" as const,
    outputDigest: `sha256:${createHash("sha256").update("").digest("hex")}`,
    status: "unverified" as const,
  }
}

export function runStagedPackageVerification(options: StagedPackageVerificationOptions): StagedPackageVerificationResult {
  const commandRunner = options.commandRunner ?? runStagedPackageCommand
  const plan = readJsonFact(options.planPath, "staged-package-plan.1")
  const preflight = readJsonFact(options.preflightPath, "staged-package-preflight.1")
  const registry = readJsonFact(options.registryFactsPath, "staged-package-registry-facts.1")
  const tarballFacts = readTarballFacts(options.tarballPath)
  const tempRoot = mkdtempSync(join(tmpdir(), "persona-staged-package-verification-"))
  try {
    const consumer = tarballFacts === undefined
      ? undefined
      : createInstalledConsumer(tempRoot, resolve(options.tarballPath), commandRunner)
    const matrix = consumer === undefined
      ? {}
      : runInstalledStagedPackageMatrix(consumer, tempRoot, commandRunner)
    const provenance = consumer === undefined
      ? unavailableProvenance()
      : readProvenanceFact(consumer, commandRunner)
    const tarball = consumer === undefined || tarballFacts === undefined
      ? {}
      : installedTarballFacts(consumer, tarballFacts)
    const installed = consumer === undefined
      ? {}
      : { ...matrix, exactVersion: consumer.version === planVersion(plan) }
    return assessStagedPackageVerification({ installed, plan, preflight, provenance, registry, tarball })
  } finally {
    rmSync(tempRoot, { force: true, recursive: true })
  }
}
