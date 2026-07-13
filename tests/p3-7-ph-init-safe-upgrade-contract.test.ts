import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  validateExperiment,
  type ValidationResult,
} from "../experiments/p3-7-ph-init-safe-upgrade-contract/validate.mjs"

const experimentDir = path.join(process.cwd(), "experiments", "p3-7-ph-init-safe-upgrade-contract")
const baseCorpusPath = path.join(experimentDir, "corpus.json")
const successorCorpusPath = path.join(experimentDir, "corpus.v2.json")
const tempDirs: string[] = []

afterEach(() => {
  for (const directory of tempDirs) {
    rmSync(directory, { force: true, recursive: true })
  }
  tempDirs.length = 0
})

describe("P3-7 ph init safe upgrade contract", () => {
  it("accepts the locked source-only base corpus with no product or project access", () => {
    const result = validateExperiment({ corpusPath: baseCorpusPath })

    expect(result).toMatchObject({
      ok: true,
      corpusSchemaVersion: "p3-7-ph-init-safe-upgrade.1",
      caseCount: 14,
      childProcessInvocations: 0,
      networkAccess: false,
      productCliInvocations: 0,
      realProjectAccess: false,
      writeOperations: 0,
    })
    expect(result.errors).toEqual([])
  })

  it("accepts a separately locked append-only successor with one fresh case", () => {
    const result = validateExperiment({ corpusPath: successorCorpusPath })

    expect(result).toMatchObject({
      ok: true,
      corpusSchemaVersion: "p3-7-ph-init-safe-upgrade.2",
      caseCount: 15,
      appendOnly: { addedCaseIds: ["p3-7-r15-new-profile-binding"], status: "pass" },
    })
  })

  it("rejects naive base append without a new schema and lock", () => {
    const copy = copyExperiment()
    const corpusPath = path.join(copy, "corpus.json")
    const corpus = readJson(corpusPath)
    readArray(corpus, "records").push({
      id: "p3-7-naive-append",
      category: "unsafe-extension",
      fixtureId: "p3-7-r15-new-profile-binding",
    })
    writeJson(corpusPath, corpus)

    expectFailure(corpusPath, ["CANONICAL_LOCK_HASH", "CORPUS_HASH"])
  })

  it.each([
    ["relabel", (corpus: MutableRecord): void => {
      firstRecord(corpus).title = "Changed title"
    }],
    ["delete", (corpus: MutableRecord): void => {
      readArray(corpus, "records").splice(0, 1)
    }],
    ["reorder", (corpus: MutableRecord): void => {
      readArray(corpus, "records").reverse()
    }],
  ])("rejects successor %s mutation of the immutable base prefix", (_name, mutate) => {
    const copy = copyExperiment()
    const corpusPath = path.join(copy, "corpus.v2.json")
    const corpus = readJson(corpusPath)
    mutate(corpus)
    writeJson(corpusPath, corpus)

    expectFailure(corpusPath, ["CANONICAL_LOCK_HASH", "CORPUS_HASH"])
  })

  it.each([
    ["reused ID", (corpus: MutableRecord): void => {
      const records = readArray(corpus, "records")
      requireRecord(records[14]).id = requireRecord(records[0]).id
    }],
    ["reused fixture", (corpus: MutableRecord): void => {
      const records = readArray(corpus, "records")
      requireRecord(records[14]).fixtureId = requireRecord(records[0]).fixtureId
    }],
    ["mismatched base binding", (corpus: MutableRecord): void => {
      requireRecord(corpus.appendOnly).baseCorpusSha256 = "f".repeat(64)
    }],
  ])("rejects successor %s", (_name, mutate) => {
    const copy = copyExperiment()
    const corpusPath = path.join(copy, "corpus.v2.json")
    const corpus = readJson(corpusPath)
    mutate(corpus)
    writeJson(corpusPath, corpus)

    expectFailure(corpusPath, ["CANONICAL_LOCK_HASH", "CORPUS_HASH"])
  })

  it("rejects coordinated fixture mutation even when the manifest hash is changed", () => {
    const copy = copyExperiment()
    const corpusPath = path.join(copy, "corpus.json")
    const registryPath = path.join(copy, "fixtures", "registry.json")
    const registry = readJson(registryPath)
    const fixtures = readArray(registry, "fixtures")
    requireRecord(fixtures[0]).oracle = { expectedDecision: "overwrite" }
    writeJson(registryPath, registry)
    const corpus = readJson(corpusPath)
    corpus.fixtureRegistrySha256 = "f".repeat(64)
    writeJson(corpusPath, corpus)

    expectFailure(corpusPath, ["CANONICAL_LOCK_HASH", "CORPUS_HASH", "REGISTRY_HASH"])
  })

  it("rejects a missing successor preregistration and lock", () => {
    const copy = copyExperiment()
    const corpusPath = path.join(copy, "corpus.v2.json")
    const corpus = readJson(corpusPath)
    delete corpus.appendOnly
    writeJson(corpusPath, corpus)

    expectFailure(corpusPath, ["CANONICAL_LOCK_HASH", "CORPUS_HASH"])
  })

  it("covers every requested outcome category and keeps P3-6 as an explicit dependency", () => {
    const result = validateExperiment({ corpusPath: baseCorpusPath })
    const categories = new Set(result.records.map((record) => record.category))

    expect(categories).toEqual(new Set([
      "ownership-marker",
      "idempotent-rerun",
      "safe-owned-upgrade",
      "modified-config-conflict",
      "modified-rules-conflict",
      "modified-agents-conflict",
      "foreign-file-preservation",
      "rollback-on-write-failure",
      "symlink-escape",
      "partial-initialization",
      "concurrent-race",
      "deterministic-dry-run",
      "binding-mismatch",
      "missing-ownership-marker",
    ]))
    expect(result.dependencies).toEqual({
      configRecoveryAndPathSafety: "P3-6-owned",
      reimplementationHere: false,
    })
  })

  it.each([
    "safe-owned-upgrade",
    "modified-config-conflict",
    "modified-rules-conflict",
    "modified-agents-conflict",
    "foreign-file-preservation",
    "rollback-on-write-failure",
    "symlink-escape",
    "partial-initialization",
    "concurrent-race",
    "deterministic-dry-run",
  ])("keeps the %s oracle non-destructive and bounded", (category) => {
    const result = validateExperiment({ corpusPath: baseCorpusPath })
    const record = result.records.find((candidate) => candidate.category === category)

    expect(record).toBeDefined()
    expect(record?.oracle.noDataLoss).toBe(true)
    expect(record?.oracle.overwriteForeignFiles).toBe(false)
    expect(record?.oracle.deterministic).toBe(true)
    expect(record?.oracle.productBehaviorChange).toBe(false)
  })
})

type MutableRecord = Record<string, unknown>

function copyExperiment(): string {
  const root = mkdtempSync(path.join(tmpdir(), "p3-7-ph-init-"))
  tempDirs.push(root)
  const target = path.join(root, "p3-7-ph-init-safe-upgrade-contract")
  cpSync(experimentDir, target, { recursive: true })
  return target
}

function readJson(filePath: string): MutableRecord {
  const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"))
  return requireRecord(parsed)
}

function writeJson(filePath: string, value: MutableRecord): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function firstRecord(corpus: MutableRecord): MutableRecord {
  return requireRecord(readArray(corpus, "records")[0])
}

function readArray(record: MutableRecord, key: string): unknown[] {
  const value = record[key]
  if (!Array.isArray(value)) throw new TypeError(`${key} must be an array`)
  return value
}

function requireRecord(value: unknown): MutableRecord {
  if (!isRecord(value)) throw new TypeError("expected a mutable record")
  return value
}

function isRecord(value: unknown): value is MutableRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function expectFailure(corpusPath: string, codes: readonly string[]): void {
  const result: ValidationResult = validateExperiment({ corpusPath })
  expect(result.ok).toBe(false)
  expect(result.errors.map((error) => error.code).some((code) => codes.includes(code))).toBe(true)
}
