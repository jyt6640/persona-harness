#!/usr/bin/env node
import { createHash } from "node:crypto"
import { lstatSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import process from "node:process"
import { fileURLToPath, pathToFileURL } from "node:url"

import { assessStablePromotionCompletionIntegrity } from "./stable-promotion-completion-integrity-core.mjs"
import {
  createStablePromotionConsumer,
  runInstalledCompletionIntegrityMatrix,
} from "./stable-promotion-completion-integrity-runner.mjs"

export {
  createStablePromotionConsumer,
  runInstalledCompletionIntegrityMatrix,
  writeStablePromotionWorkflowFixture,
} from "./stable-promotion-completion-integrity-runner.mjs"

const MAX_FACT_BYTES = 64 * 1024
const MAX_TARBALL_BYTES = 64 * 1024 * 1024
const SHA1_PATTERN = /^[a-f0-9]{40}$/iu

function parseArgs(args) {
  const values = new Map()
  let json = false
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === "--json") {
      if (json) return undefined
      json = true
      continue
    }
    if (!["--approval", "--candidate-tag", "--registry-facts", "--source-sha", "--tarball"].includes(arg)) {
      return undefined
    }
    const value = args[index + 1]
    if (value === undefined || value.startsWith("--") || values.has(arg)) {
      return undefined
    }
    values.set(arg, value)
    index += 1
  }
  const approvalPath = values.get("--approval")
  const candidateTag = values.get("--candidate-tag")
  const registryFactsPath = values.get("--registry-facts")
  const sourceHead = values.get("--source-sha")
  const tarballPath = values.get("--tarball")
  return approvalPath === undefined
    || candidateTag === undefined
    || registryFactsPath === undefined
    || sourceHead === undefined
    || tarballPath === undefined
    ? undefined
    : { approvalPath, candidateTag, json, registryFactsPath, sourceHead, tarballPath }
}

export function stablePromotionCompletionIntegrityUsage(invocation = "node scripts/stable-promotion-completion-integrity.mjs") {
  return [
    `Usage: ${invocation} --tarball <path> --registry-facts <path> --approval <path> --source-sha <sha> --candidate-tag <latest|next> [--json]`,
    "",
    "Reads a local tarball and supplied read-only facts, then installs into a disposable consumer.",
    "The gate never moves a dist-tag, publishes, releases, or authorizes stable movement.",
  ].join("\n")
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
  if (!isRegularBoundedFile(filePath, MAX_FACT_BYTES)) {
    return {}
  }
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8"))
    return typeof parsed === "object"
      && parsed !== null
      && !Array.isArray(parsed)
      && parsed.schemaVersion === schemaVersion
      ? parsed
      : {}
  } catch {
    return {}
  }
}

function readTarballFacts(tarballPath) {
  if (!isRegularBoundedFile(tarballPath, MAX_TARBALL_BYTES)) {
    return undefined
  }
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

export function runStablePromotionCompletionIntegrity(options) {
  const tarballFacts = readTarballFacts(options.tarballPath)
  const registry = readJsonFact(options.registryFactsPath, "stable-promotion-registry-facts.1")
  const approval = readJsonFact(options.approvalPath, "stable-promotion-approval.1")
  const tempRoot = mkdtempSync(join(tmpdir(), "persona-stable-promotion-gate-"))
  try {
    const consumer = tarballFacts === undefined
      ? undefined
      : createStablePromotionConsumer(tempRoot, resolve(options.tarballPath))
    const installed = consumer === undefined
      ? undefined
      : {
          integrity: tarballFacts.integrity,
          packageName: consumer.packageName,
          sha1: tarballFacts.sha1,
          sha256: tarballFacts.sha256,
          version: consumer.version,
        }
    const matrix = consumer === undefined
      ? {}
      : runInstalledCompletionIntegrityMatrix(consumer, tempRoot)
    return assessStablePromotionCompletionIntegrity({
      approval,
      candidateTag: options.candidateTag,
      completionMatrix: matrix,
      registry,
      sourceHead: SHA1_PATTERN.test(options.sourceHead) ? options.sourceHead : "",
      tarball: installed ?? {},
    })
  } finally {
    rmSync(tempRoot, { force: true, recursive: true })
  }
}

function formatResult(result) {
  return [
    `Stable promotion completion-integrity gate: ${result.status.toUpperCase()}`,
    `Candidate tag: ${result.candidateTag}`,
    "Stable movement: NOT AUTHORIZED",
    "Durable sanitized evidence: REQUIRED BEFORE CLOSURE",
    ...(result.diagnostics.length === 0 ? ["Diagnostics: none"] : [`Diagnostics: ${result.diagnostics.join(", ")}`]),
  ].join("\n")
}

function main() {
  if (process.argv.length === 3 && ["--help", "-h", "help"].includes(process.argv[2] ?? "")) {
    process.stdout.write(`${stablePromotionCompletionIntegrityUsage()}\n`)
    return
  }
  const parsed = parseArgs(process.argv.slice(2))
  if (parsed === undefined) {
    process.stderr.write(`${stablePromotionCompletionIntegrityUsage()}\n`)
    process.exitCode = 1
    return
  }
  const result = runStablePromotionCompletionIntegrity(parsed)
  process.stdout.write(parsed.json ? `${JSON.stringify(result, null, 2)}\n` : `${formatResult(result)}\n`)
  process.exitCode = result.status === "pass" ? 0 : 1
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
