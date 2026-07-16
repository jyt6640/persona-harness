#!/usr/bin/env node
import process from "node:process"
import { fileURLToPath, pathToFileURL } from "node:url"

import { runStagedPackageVerification } from "./staged-package-verification-runner.mjs"

export { runStagedPackageVerification } from "./staged-package-verification-runner.mjs"

const REQUIRED_FLAGS = ["--plan", "--preflight", "--registry-facts", "--tarball"]

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
    if (!REQUIRED_FLAGS.includes(arg)) return undefined
    const value = args[index + 1]
    if (value === undefined || value.startsWith("--") || values.has(arg)) return undefined
    values.set(arg, value)
    index += 1
  }
  return REQUIRED_FLAGS.every((flag) => values.has(flag))
    ? {
        json,
        planPath: values.get("--plan"),
        preflightPath: values.get("--preflight"),
        registryFactsPath: values.get("--registry-facts"),
        tarballPath: values.get("--tarball"),
      }
    : undefined
}

export function stagedPackageVerificationUsage(invocation = "node scripts/staged-package-verification.mjs") {
  return [
    `Usage: ${invocation} --plan <path> --preflight <path> --registry-facts <path> --tarball <path> [--json]`,
    "",
    "Reads bounded release facts and verifies a fresh exact-version package install.",
    "It never publishes, tags, moves a dist-tag, or authorizes channel promotion.",
  ].join("\n")
}

function formatResult(result) {
  return [
    `Staged package verification: ${result.verificationStatus.toUpperCase()}`,
    `Promotion decision: ${result.promotionDecision.toUpperCase()}`,
    "Registry mutation: NOT PERFORMED",
    "Durable sanitized evidence: REQUIRED BEFORE CLOSURE",
    ...(result.diagnostics.length === 0 ? ["Diagnostics: none"] : [`Diagnostics: ${result.diagnostics.join(", ")}`]),
  ].join("\n")
}

function main() {
  if (process.argv.length === 3 && ["--help", "-h", "help"].includes(process.argv[2] ?? "")) {
    process.stdout.write(`${stagedPackageVerificationUsage()}\n`)
    return
  }
  const parsed = parseArgs(process.argv.slice(2))
  if (parsed === undefined) {
    process.stderr.write(`${stagedPackageVerificationUsage()}\n`)
    process.exitCode = 1
    return
  }
  const result = runStagedPackageVerification(parsed)
  process.stdout.write(parsed.json ? `${JSON.stringify(result, null, 2)}\n` : `${formatResult(result)}\n`)
  process.exitCode = result.verificationStatus === "verified" ? 0 : 1
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
