#!/usr/bin/env node
import { existsSync, lstatSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import process from "node:process"
import { fileURLToPath, pathToFileURL } from "node:url"

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")

export function parseContextComparisonArguments(argv) {
  const options = { candidate: { commit: "", packageVersion: "" }, manifestPath: "" }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    const next = () => {
      index += 1
      if (index >= argv.length) throw new Error("context-comparison-arguments-invalid")
      return argv[index]
    }
    if (argument === "--manifest") options.manifestPath = next()
    else if (argument === "--candidate-commit") options.candidate.commit = next()
    else if (argument === "--package-version") options.candidate.packageVersion = next()
    else throw new Error("context-comparison-arguments-invalid")
  }
  if (!options.manifestPath || !options.candidate.commit || !options.candidate.packageVersion) {
    throw new Error("context-comparison-arguments-invalid")
  }
  return options
}

function usage() {
  return `Usage: node scripts/eval/run-context-comparison.mjs --manifest <path> --candidate-commit <sha> --package-version <version>

Evaluates the versioned Context OFF, legacy broad compatibility, and targeted layered corpus.

This command does not invoke a model, host adapter, network, or workflow. It records
unavailable execution measurements as null and leaves product verdicts INCONCLUSIVE.`
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.length === 1 && (argv[0] === "--help" || argv[0] === "-h")) {
    process.stdout.write(`${usage()}\n`)
    return
  }
  const options = parseContextComparisonArguments(argv)
  const manifest = readManifest(options.manifestPath)
  const evaluatorPath = resolve(packageRoot, "dist", "context-comparison", "index.js")
  if (!isRegularFile(evaluatorPath)) throw new Error("context-comparison-runtime-unavailable")
  const { evaluateContextComparison } = await import(pathToFileURL(evaluatorPath).href)
  const result = evaluateContextComparison(manifest, options.candidate)
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  process.exitCode = result.status === "ready" && result.records.every((record) => record.technicalVerdict === "TECHNICAL_PASS") ? 0 : 1
}

function readManifest(path) {
  const resolved = resolve(process.cwd(), path)
  if (!isRegularFile(resolved)) throw new Error("context-comparison-manifest-unavailable")
  try {
    return JSON.parse(readFileSync(resolved, "utf8"))
  } catch {
    throw new Error("context-comparison-manifest-invalid")
  }
}

function isRegularFile(path) {
  return existsSync(path) && lstatSync(path).isFile() && !lstatSync(path).isSymbolicLink()
}

if (isDirectExecution()) {
  main().catch((error) => {
    const code = error instanceof Error && /^context-comparison-[a-z-]+$/u.test(error.message)
      ? error.message
      : "context-comparison-unavailable"
    process.stderr.write(`${code}\n`)
    process.exitCode = 1
  })
}

function isDirectExecution() {
  const entry = process.argv[1]
  return typeof entry === "string" && resolve(entry) === fileURLToPath(import.meta.url)
}
