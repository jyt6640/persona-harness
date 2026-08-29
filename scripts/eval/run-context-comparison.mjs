#!/usr/bin/env node
import { execFileSync } from "node:child_process"
import { existsSync, lstatSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import process from "node:process"
import { fileURLToPath, pathToFileURL } from "node:url"

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")

export function parseContextComparisonArguments(argv) {
  const options = { candidate: { commit: "", packageVersion: "" }, currentCheckout: false, manifestPath: "" }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    const next = () => {
      index += 1
      if (index >= argv.length) throw new Error("context-comparison-arguments-invalid")
      return argv[index]
    }
    if (argument === "--manifest") {
      if (options.manifestPath) throw new Error("context-comparison-arguments-invalid")
      options.manifestPath = next()
    } else if (argument === "--candidate-commit") {
      if (options.currentCheckout || options.candidate.commit) throw new Error("context-comparison-arguments-invalid")
      options.candidate.commit = next()
    } else if (argument === "--package-version") {
      if (options.currentCheckout || options.candidate.packageVersion) throw new Error("context-comparison-arguments-invalid")
      options.candidate.packageVersion = next()
    } else if (argument === "--current-checkout") {
      if (options.currentCheckout || options.candidate.commit || options.candidate.packageVersion) {
        throw new Error("context-comparison-arguments-invalid")
      }
      options.currentCheckout = true
    } else throw new Error("context-comparison-arguments-invalid")
  }
  if (!options.manifestPath) throw new Error("context-comparison-arguments-invalid")
  if (options.currentCheckout) {
    return { candidateSource: "current-checkout", manifestPath: options.manifestPath }
  }
  if (!options.candidate.commit || !options.candidate.packageVersion) throw new Error("context-comparison-arguments-invalid")
  return { candidate: options.candidate, candidateSource: "explicit", manifestPath: options.manifestPath }
}

export function assertContextComparisonCandidate(candidate, checkoutCandidate) {
  if (
    candidate.commit !== checkoutCandidate.commit
    || candidate.packageVersion !== checkoutCandidate.packageVersion
  ) {
    throw new Error("context-comparison-candidate-mismatch")
  }
}

function usage() {
  return `Usage: node scripts/eval/run-context-comparison.mjs --manifest <path> (--current-checkout | --candidate-commit <sha> --package-version <version>)

Evaluates the versioned Context OFF, legacy broad compatibility, and targeted layered corpus.

This command binds an explicitly selected candidate source to a clean local Git/package identity. It does
not invoke a model, host adapter, network, or workflow; execution measurements remain null
and product verdicts remain INCONCLUSIVE.`
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.length === 1 && (argv[0] === "--help" || argv[0] === "-h")) {
    process.stdout.write(`${usage()}\n`)
    return
  }
  const options = parseContextComparisonArguments(argv)
  const checkoutCandidate = readCheckoutCandidate()
  const candidate = options.candidateSource === "current-checkout"
    ? checkoutCandidate
    : options.candidate
  if (options.candidateSource === "explicit") {
    assertContextComparisonCandidate(candidate, checkoutCandidate)
  }
  const manifest = readManifest(options.manifestPath)
  const evaluatorPath = resolve(packageRoot, "dist", "context-comparison", "index.js")
  if (!isRegularFile(evaluatorPath)) throw new Error("context-comparison-runtime-unavailable")
  const { evaluateContextComparison } = await import(pathToFileURL(evaluatorPath).href)
  const result = evaluateContextComparison(manifest, candidate)
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

function readCheckoutCandidate() {
  const packagePath = resolve(packageRoot, "package.json")
  if (!isRegularFile(packagePath)) throw new Error("context-comparison-candidate-unavailable")
  let packageVersion
  try {
    packageVersion = JSON.parse(readFileSync(packagePath, "utf8")).version
  } catch {
    throw new Error("context-comparison-candidate-unavailable")
  }
  if (typeof packageVersion !== "string" || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(packageVersion)) {
    throw new Error("context-comparison-candidate-unavailable")
  }
  try {
    const gitRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: packageRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
    if (resolve(gitRoot) !== packageRoot) throw new Error("package root differs from Git root")
    const status = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], {
      cwd: packageRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
    if (status) throw new Error("dirty checkout")
    const commit = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: packageRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
    if (!/^[0-9a-f]{40,64}$/u.test(commit)) throw new Error("invalid checkout commit")
    return { commit, packageVersion }
  } catch {
    throw new Error("context-comparison-candidate-unavailable")
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
