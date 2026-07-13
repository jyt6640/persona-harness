#!/usr/bin/env node
import { lstatSync, readFileSync } from "node:fs"
import { basename, dirname, isAbsolute, join, normalize, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import {
  BASE,
  BINDING,
  SUCCESSOR,
  addError,
  expect,
  isRecord,
  mergeRecords,
  sha256Text,
  validateCorpus,
  validateFixture,
  validateLock,
  validateRegistry,
} from "./contract.mjs"

export function validateExperiment({ corpusPath }) {
  const root = dirname(corpusPath)
  const successor = basename(corpusPath) === "corpus.v2.json"
  const expected = successor ? SUCCESSOR : BASE
  const errors = []
  const corpus = readJson(corpusPath, root, errors, "CORPUS_JSON")
  const lockPath = join(root, expected.lockFile)
  const lock = readJson(lockPath, root, errors, "LOCK_JSON")
  const registryPath = join(root, "fixtures", "registry.json")
  const registry = readJson(registryPath, root, errors, "REGISTRY_JSON")
  const result = {
    ok: false,
    corpusSchemaVersion: corpus?.schemaVersion,
    caseCount: Array.isArray(corpus?.records) ? corpus.records.length : 0,
    childProcessInvocations: 0,
    networkAccess: false,
    productCliInvocations: 0,
    realProjectAccess: false,
    writeOperations: 0,
    errors,
    records: [],
    dependencies: corpus?.dependencies,
  }

  const actualLockSha256 = hashFile(lockPath, root, errors, "canonical-lock.json")
  if (actualLockSha256 !== expected.lockSha256) addError(errors, "CANONICAL_LOCK_HASH", expected.lockFile, "canonical lock bytes drifted")
  const actualCorpusSha256 = hashFile(corpusPath, root, errors, "corpus.json")
  if (actualCorpusSha256 !== expected.corpusSha256) addError(errors, "CORPUS_HASH", "corpus", "corpus bytes drifted")
  const actualRegistrySha256 = hashFile(registryPath, root, errors, "fixtures/registry.json")
  if (actualRegistrySha256 !== (corpus?.fixtureRegistrySha256 ?? "")) addError(errors, "REGISTRY_HASH", "fixtureRegistrySha256", "registry binding drifted")

  if (!isRecord(corpus)) addError(errors, "CORPUS_INVALID", "corpus", "corpus must be an object")
  if (!isRecord(lock)) addError(errors, "LOCK_INVALID", expected.lockFile, "lock must be an object")
  if (!isRecord(registry)) addError(errors, "REGISTRY_INVALID", "fixtures/registry.json", "registry must be an object")
  if (isRecord(corpus)) validateCorpus(corpus, expected, successor, errors)
  if (isRecord(registry)) validateRegistry(registry, corpus, errors)
  if (isRecord(lock)) validateLock(lock, expected, actualCorpusSha256, actualRegistrySha256, registry, corpus, errors)

  if (successor && isRecord(corpus) && isRecord(registry)) {
    validateSuccessor(corpus, root, expected, registry, errors, result)
  } else if (!successor && isRecord(corpus) && isRecord(registry)) {
    result.records = mergeRecords(corpus.records, registry.fixtures, errors)
  }
  result.ok = errors.length === 0
  return result
}

function validateSuccessor(corpus, root, expected, registry, errors, result) {
  const extensionPath = resolveWithin(root, corpus.fixtureExtension, errors, "fixtureExtension")
  const extension = extensionPath ? readJson(extensionPath, root, errors, "EXTENSION_JSON") : undefined
  const extensionHash = extensionPath ? hashFile(extensionPath, root, errors, "fixtureExtension") : undefined
  expect(errors, extensionHash, corpus.fixtureExtensionSha256, "EXTENSION_HASH", "fixtureExtensionSha256")
  expect(errors, corpus.appendOnly?.baseCorpusSchemaVersion, BASE.schemaVersion, "APPEND_SCHEMA", "appendOnly.baseCorpusSchemaVersion")
  expect(errors, corpus.appendOnly?.baseCorpusSha256, BASE.corpusSha256, "APPEND_CORPUS", "appendOnly.baseCorpusSha256")
  expect(errors, corpus.appendOnly?.baseLockSha256, BASE.lockSha256, "APPEND_LOCK", "appendOnly.baseLockSha256")
  expect(errors, JSON.stringify(corpus.appendOnly?.addedRecordIds), JSON.stringify(["p3-7-r15-new-profile-binding"]), "APPEND_IDS", "appendOnly.addedRecordIds")
  if (isRecord(extension) && isRecord(extension.fixture)) {
    expect(errors, extension.binding, corpus.extensionBinding, "EXTENSION_BINDING", "extensionBinding")
    expect(errors, extension.binding?.packageName, BINDING.packageName, "EXTENSION_PACKAGE", "extension.binding.packageName")
    expect(errors, extension.binding?.projectId, BINDING.projectId, "EXTENSION_PROJECT", "extension.binding.projectId")
    expect(errors, extension.binding?.profileId, "p3-7-synthetic-profile-kotlin", "EXTENSION_PROFILE", "extension.binding.profileId")
    if (extension.fixture.id !== "p3-7-r15-new-profile-binding") addError(errors, "EXTENSION_ID", "fixtureExtension", "fresh extension ID is required")
    validateFixture(extension.fixture, errors, extension.binding)
    result.records = mergeRecords(corpus.records, [...registry.fixtures, extension.fixture], errors)
    result.appendOnly = { addedCaseIds: ["p3-7-r15-new-profile-binding"], status: errors.length === 0 ? "pass" : "fail" }
  }
}

function readJson(filePath, root, errors, label) {
  if (!isRegularFile(filePath, root, errors, label)) return undefined
  try {
    return JSON.parse(readFileSync(filePath, "utf8"))
  } catch {
    addError(errors, "JSON_INVALID", label, "invalid JSON")
    return undefined
  }
}

function resolveWithin(root, value, errors, label) {
  if (typeof value !== "string" || value.length === 0 || isAbsolute(value) || normalize(value).startsWith("..")) {
    addError(errors, "PATH_INVALID", label, "path must be relative and inside the corpus")
    return undefined
  }
  const resolved = resolve(root, value)
  const inside = relative(root, resolved)
  if (inside.startsWith("..") || isAbsolute(inside)) {
    addError(errors, "PATH_ESCAPE", label, "path escapes corpus")
    return undefined
  }
  return resolved
}

function isRegularFile(filePath, root, errors, label) {
  try {
    const stats = lstatSync(filePath)
    if (stats.isSymbolicLink()) addError(errors, "PATH_SYMLINK", label, "symlinks are not followed")
    if (!stats.isFile()) addError(errors, "PATH_NOT_FILE", label, "path is not a regular file")
    return stats.isFile() && !stats.isSymbolicLink()
  } catch {
    addError(errors, "PATH_MISSING", label, `missing synthetic corpus file: ${relative(root, filePath)}`)
    return false
  }
}

function hashFile(filePath, root, errors, label) {
  if (!isRegularFile(filePath, root, errors, label)) return undefined
  return sha256Text(readFileSync(filePath, "utf8"))
}

function runCli() {
  const directory = dirname(fileURLToPath(import.meta.url))
  const supplied = process.argv[2]
  const corpusPath = supplied ? resolve(process.cwd(), supplied) : join(directory, "corpus.json")
  const result = validateExperiment({ corpusPath })
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  process.exitCode = result.ok ? 0 : 1
}

const entry = process.argv[1]
if (entry && resolve(entry) === resolve(fileURLToPath(import.meta.url))) runCli()
