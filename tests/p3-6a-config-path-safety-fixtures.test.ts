import { rmSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  copyCorpus,
  corpusDirectory,
  failureCodes,
  isJsonObject,
  makeSymlinkFixture,
  readJsonObject,
  removeCorpusCopy,
  replaceFixtureDirectoryWithSymlink,
  runValidator,
  setJsonPath,
  updateJsonObject,
  updateCorpusRecords,
} from "./p3-6a-config-path-safety-fixtures-support.js"

const baseCorpusPath = join(corpusDirectory, "corpus.json"); const successorCorpusPath = join(corpusDirectory, "corpus.v2.json")

function expectFailure(
  copiedDirectory: string,
  version: "base" | "successor",
  code: string,
  forbiddenOutput: readonly string[] = [],
): ReturnType<typeof runValidator> {
  const run = runValidator(copiedDirectory, version)
  expect(run.exitCode).not.toBe(0)
  expect(run.result?.status).toBe("fail")
  expect(failureCodes(run)).toContain(code)
  for (const text of forbiddenOutput) {
    expect(run.stdout).not.toContain(text)
    expect(run.stderr).not.toContain(text)
  }
  return run
}

describe("P3-6a config/path/walker fixture contract", () => {
  it("covers every preregistered adversarial family", () => {
    const corpus = readJsonObject(baseCorpusPath)
    const records = corpus.records
    if (!Array.isArray(records)) {
      throw new TypeError("Expected records")
    }
    const categories = records
      .filter((record): record is Record<string, unknown> => typeof record === "object" && record !== null)
      .map((record) => record.category)

    expect(categories).toEqual([
      "config-malformed",
      "config-corrupt",
      "paths-canonical-mismatch",
      "walker-symlink-cycle",
      "walker-path-escape",
      "walker-depth",
      "walker-entry-count",
      "walker-bytes",
      "walker-unreadable",
      "walker-binary",
      "diagnostic-stack-leak",
      "diagnostic-unbounded",
      "control-safe",
    ])
  })

  it("passes the frozen base corpus with zero corpus-only false positives or negatives", () => {
    const run = runValidator(corpusDirectory, "base")

    expect(run.exitCode).toBe(0)
    expect(run.result).toMatchObject({
      status: "pass",
      falseNegativeCount: 0,
      falsePositiveCount: 0,
      reportOnly: true,
      sourceOnly: true,
      enforcement: false,
    })
  })

  it("passes the versioned append-only successor with one fresh record", () => {
    const run = runValidator(corpusDirectory, "successor")

    expect(run.exitCode).toBe(0)
    expect(run.result?.status).toBe("pass")
    expect(run.result?.appendOnly).toMatchObject({
      addedRecordIds: ["p3-6a-r14-config-new-schema"],
      basePrefixPreserved: true,
      status: "pass",
    })
  })

  it("rejects a naive append to the frozen base schema", () => {
    const copiedDirectory = copyCorpus()
    try {
      const successor = readJsonObject(successorCorpusPath)
      if (!Array.isArray(successor.records) || successor.records.length === 0) {
        throw new TypeError("Expected successor record")
      }
      const successorRecords = successor.records
      updateCorpusRecords(join(copiedDirectory, "corpus.json"), (records) => {
        const appended = successorRecords.at(-1)
        if (!isJsonObject(appended)) {
          throw new TypeError("Expected appended record")
        }
        records.push(appended)
      })
      expectFailure(copiedDirectory, "base", "corpus.base_record_count")
    } finally {
      removeCorpusCopy(copiedDirectory)
    }
  })

  it("rejects payload drift even when the fixture identity is unchanged", () => {
    const copiedDirectory = copyCorpus()
    try {
      setJsonPath(
        join(copiedDirectory, "fixtures", "f01-config-malformed.json"),
        ["payload", "config", "rawBytes"],
        "{ permissive: true }",
      )
      expectFailure(copiedDirectory, "base", "lock.fixture_mismatch")
    } finally {
      removeCorpusCopy(copiedDirectory)
    }
  })

  it("rejects metadata drift even when the payload is unchanged", () => {
    const copiedDirectory = copyCorpus()
    try {
      setJsonPath(
        join(copiedDirectory, "fixtures", "f01-config-malformed.json"),
        ["metadata", "label"],
        "mutated label",
      )
      expectFailure(copiedDirectory, "base", "lock.fixture_mismatch")
    } finally {
      removeCorpusCopy(copiedDirectory)
    }
  })

  it.each([
    ["altered", ["records", "0", "label"], "changed label"],
    ["deleted", ["records", "0"], undefined],
    ["reordered", ["records", "1", "id"], "p3-6a-r01-config-malformed-jsonc"],
  ] as const)("rejects a %s prior record in a successor", (_label, path, value) => {
    const copiedDirectory = copyCorpus()
    try {
      if (value === undefined) {
        updateCorpusRecords(join(copiedDirectory, "corpus.v2.json"), (records) => {
          records.shift()
        })
      } else {
        setJsonPath(join(copiedDirectory, "corpus.v2.json"), path, value)
      }
      expectFailure(copiedDirectory, "successor", "mutation.prefix_changed")
    } finally {
      removeCorpusCopy(copiedDirectory)
    }
  })

  it("rejects a reused record ID in a successor extension", () => {
    const copiedDirectory = copyCorpus()
    try {
      setJsonPath(
        join(copiedDirectory, "corpus.v2.json"),
        ["records", "13", "id"],
        "p3-6a-r01-config-malformed-jsonc",
      )
      expectFailure(copiedDirectory, "successor", "mutation.fresh_id")
    } finally {
      removeCorpusCopy(copiedDirectory)
    }
  })

  it("rejects a reused fixture path in a successor extension", () => {
    const copiedDirectory = copyCorpus()
    try {
      setJsonPath(
        join(copiedDirectory, "corpus.v2.json"),
        ["records", "13", "fixture"],
        "fixtures/f01-config-malformed.json",
      )
      expectFailure(copiedDirectory, "successor", "mutation.fresh_fixture")
    } finally {
      removeCorpusCopy(copiedDirectory)
    }
  })

  it("rejects a mismatched base fingerprint", () => {
    const copiedDirectory = copyCorpus()
    try {
      setJsonPath(
        join(copiedDirectory, "corpus.v2.json"),
        ["preregistration", "mutationPolicy", "baseCorpusFingerprint"],
        "0000000000000000000000000000000000000000000000000000000000000000",
      )
      expectFailure(copiedDirectory, "successor", "mutation.base_binding")
    } finally {
      removeCorpusCopy(copiedDirectory)
    }
  })

  it("rejects a successor without a new preregistration", () => {
    const copiedDirectory = copyCorpus()
    try {
      updateCorpusRecords(join(copiedDirectory, "corpus.v2.json"), () => undefined)
      setJsonPath(join(copiedDirectory, "corpus.v2.json"), ["preregistration", "extension"], null)
      expectFailure(copiedDirectory, "successor", "mutation.successor_preregistration")
    } finally {
      removeCorpusCopy(copiedDirectory)
    }
  })

  it("reports bounded structured outcomes without stack text", () => {
    const run = runValidator(corpusDirectory, "base")
    const outcomes = run.result?.outcomes

    expect(Array.isArray(outcomes)).toBe(true)
    if (!Array.isArray(outcomes)) {
      return
    }
    const malformed = outcomes.find(
      (outcome): outcome is Record<string, unknown> =>
        typeof outcome === "object" &&
        outcome !== null &&
        !Array.isArray(outcome) &&
        outcome.id === "p3-6a-r01-config-malformed-jsonc",
    )
    expect(malformed).toMatchObject({
      bounded: true,
      completionAuthority: "fail_closed",
      diagnosticMode: "read_only_recovery",
      normalClosure: "blocked",
      stackLeaked: false,
    })
  })

  it("fails closed with structured output when preregistration is missing", () => {
    const copiedDirectory = copyCorpus()
    try {
      updateJsonObject(join(copiedDirectory, "corpus.json"), (corpus) => {
        delete corpus.preregistration
      })
      expectFailure(copiedDirectory, "base", "corpus.preregistration_missing", ["TypeError", " at "])
    } finally {
      removeCorpusCopy(copiedDirectory)
    }
  })

  it("rejects fixture path traversal and symlinks before reading", () => {
    const copiedDirectory = copyCorpus()
    try {
      setJsonPath(join(copiedDirectory, "corpus.json"), ["records", "0", "fixture"], "../outside.json")
      expectFailure(copiedDirectory, "base", "fixture.path_unsafe", ["outside.json"])
      makeSymlinkFixture(copiedDirectory)
      expectFailure(copiedDirectory, "base", "fixture.symlink_forbidden", [" at "])
    } finally {
      removeCorpusCopy(copiedDirectory)
    }
  })

  it("fails closed with bounded output for missing or symlinked fixture directories", () => {
    const copiedDirectory = copyCorpus(); try {
      rmSync(join(copiedDirectory, "fixtures"), { force: true, recursive: true }); expectFailure(copiedDirectory, "base", "fixture.directory_read_failed", ["ENOENT", " at "])
      replaceFixtureDirectoryWithSymlink(copiedDirectory); expectFailure(copiedDirectory, "base", "fixture.directory_symlink_forbidden", [" at "])
    } finally {
      removeCorpusCopy(copiedDirectory)
    }
  })
})
