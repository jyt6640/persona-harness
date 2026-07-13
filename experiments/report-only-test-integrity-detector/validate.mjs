#!/usr/bin/env node
import { existsSync, lstatSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import {
  sha256,
  validateCorpus,
} from "./contract.mjs"
import { evaluateCandidate } from "./evaluator.mjs"

const CANONICAL_LOCK_SHA256 = "sha256:c36dc7e17dfde5a69d06f70d60e36c3c0f29e68aa3d6491648d0c51c06931a02"
const directory = dirname(fileURLToPath(import.meta.url))

export function validateExperiment({ corpusPath = join(directory, "corpus.json"), candidatePath } = {}) {
  const rootDir = dirname(corpusPath)
  const errors = []
  const corpus = readJson(corpusPath, errors, "CORPUS_JSON")
  const lockName = isRecord(corpus) && typeof corpus.canonicalLock === "string" ? corpus.canonicalLock : "canonical-lock.json"
  const lockPath = join(rootDir, lockName)
  const lock = readJson(lockPath, errors, "LOCK_JSON")
  const actualLockSha256 = hashRegularFile(lockPath, rootDir, errors, "canonical-lock.json")
  const validation = validateCorpus({
    actualLockSha256,
    corpus,
    expectedLockSha256: CANONICAL_LOCK_SHA256,
    lock,
    rootDir,
  })
  const allValidationErrors = [...errors, ...validation.errors]
  const base = {
    commandsExecuted: 0,
    enforcement: false,
    networkAccess: false,
    productCliInvocations: 0,
    realProjectAccess: false,
    reportOnly: true,
    writeOperations: 0,
  }
  if (candidatePath === undefined) {
    return {
      ...base,
      corpusId: isRecord(corpus) ? corpus.corpusId : undefined,
      errors: allValidationErrors,
      ok: allValidationErrors.length === 0,
      schemaVersion: "report-only-test-integrity-validation.1",
    }
  }
  const candidate = readJson(candidatePath, allValidationErrors, "CANDIDATE_JSON")
  const result = evaluateCandidate({
    candidate,
    corpus,
    validation: {
      errors: allValidationErrors,
      ok: allValidationErrors.length === 0,
      projection: validation.projection,
    },
  })
  return {
    ...result,
    corpusId: isRecord(corpus) ? corpus.corpusId : undefined,
    schemaVersion: "report-only-test-integrity-evaluation.1",
  }
}

function readJson(path, errors, code) {
  if (!existsSync(path)) {
    errors.push({ code: `${code}_MISSING`, path, message: "input file is missing" })
    return undefined
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"))
  } catch {
    errors.push({ code, path, message: "input JSON is malformed" })
    return undefined
  }
}

function hashRegularFile(path, rootDir, errors, label) {
  const relativePath = path.startsWith(`${rootDir}/`) ? path.slice(rootDir.length + 1) : path
  try {
    const stat = lstatSync(path)
    if (!stat.isFile() || stat.isSymbolicLink()) {
      errors.push({ code: "PATH_SYMLINK", path: label, message: "input must be a regular non-symlink file" })
      return undefined
    }
    return sha256(readFileSync(path, "utf8"))
  } catch {
    errors.push({ code: "PATH_MISSING", path: relativePath, message: "input file is unavailable" })
    return undefined
  }
}

function parseArguments(args) {
  let candidatePath
  let corpusPath
  let validateOnly = false
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === "--validate") {
      validateOnly = true
      continue
    }
    if (argument === "--corpus" || argument === "--candidate") {
      const value = args[index + 1]
      if (typeof value !== "string" || value.length === 0) throw new Error(`${argument} requires a path`)
      if (argument === "--corpus") corpusPath = resolve(process.cwd(), value)
      else candidatePath = resolve(process.cwd(), value)
      index += 1
      continue
    }
    throw new Error(`Unknown argument: ${argument}`)
  }
  if (validateOnly && candidatePath !== undefined) throw new Error("--validate cannot be combined with --candidate")
  return { candidatePath, corpusPath }
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function main() {
  const options = parseArguments(process.argv.slice(2))
  const result = validateExperiment(options)
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  process.exitCode = result.ok ? 0 : 1
}

if (process.argv[1] !== undefined) {
  try {
    main()
  } catch {
    process.stdout.write(`${JSON.stringify({
      commandsExecuted: 0,
      errors: [{ code: "VALIDATOR_FAILURE", path: "validator", message: "validator input could not be processed" }],
      enforcement: false,
      networkAccess: false,
      ok: false,
      productCliInvocations: 0,
      realProjectAccess: false,
      reportOnly: true,
      schemaVersion: "report-only-test-integrity-validation.1",
      writeOperations: 0,
    }, null, 2)}\n`)
    process.exitCode = 1
  }
}
