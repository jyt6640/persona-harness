import { createHash } from "node:crypto"
import {
  cpSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { spawnSync } from "node:child_process"

import { afterEach, describe, expect, it } from "vitest"

type JsonRecord = Record<string, unknown>
type RunResult = { readonly status: number | null; readonly stdout: string; readonly stderr: string }

const experimentRoot = resolve("experiments/filesystem-residue-corpus")
const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots) rmSync(root, { force: true, recursive: true })
  temporaryRoots.length = 0
})

describe("filesystem residue corpus", () => {
  it("validates both frozen base and append-only successor without execution", () => {
    const result = run(["--all"], experimentRoot)
    const output = parse(result)

    expect(result.status).toBe(0)
    expect(output).toMatchObject({
      authorityEligible: false,
      childProcessInvocations: 0,
      enforcement: false,
      networkAccess: false,
      productCliInvocations: 0,
      realProjectAccess: false,
      reportOnly: true,
      writeOperations: 0,
      ok: true,
    })
    expect(codes(output)).toEqual([])
  })

  it("evaluates the pristine corpus as diagnostic-only", () => {
    const result = runEvaluator(["--all"], experimentRoot)
    const output = parse(result)

    expect(result.status).toBe(0)
    expect(output).toMatchObject({
      authorityEligible: false,
      childProcessInvocations: 0,
      enforcement: false,
      networkAccess: false,
      productCliInvocations: 0,
      realProjectAccess: false,
      reportOnly: true,
      writeOperations: 0,
      ok: true,
    })
    expect(output["baseRecordCount"]).toBe(4)
    expect(output["successorRecordCount"]).toBe(5)
  })

  it.each([
    ["base metadata drift", (root: string) => mutateJson(join(root, "corpus.json"), (value) => {
      record(array(value["records"])[0])["label"] = "relabelled"
    }), "CANONICAL_SEMANTICS_MISMATCH"],
    ["base naive append", (root: string) => mutateJson(join(root, "corpus.json"), (value) => {
      array(value["records"]).push(record(array(readJson(join(root, "successor.json"))["records"])[4]))
    }), "BASE_APPEND_FORBIDDEN"],
    ["successor deletion", (root: string) => mutateJson(join(root, "successor.json"), (value) => {
      array(value["records"]).splice(1, 1)
    }), "SUCCESSOR_PREFIX_MISMATCH"],
    ["successor reorder", (root: string) => mutateJson(join(root, "successor.json"), (value) => {
      const records = array(value["records"])
      const first = records[0]
      records[0] = records[1]
      records[1] = first
    }), "SUCCESSOR_PREFIX_MISMATCH"],
    ["successor reused id", (root: string) => mutateJson(join(root, "successor.json"), (value) => {
      record(array(value["records"])[4])["id"] = record(array(value["records"])[0])["id"]
    }), "DUPLICATE_RECORD_ID"],
    ["successor replayed fixture", (root: string) => mutateJson(join(root, "successor.json"), (value) => {
      record(array(value["records"])[4])["fixturePath"] = record(array(value["records"])[0])["fixturePath"]
    }), "DUPLICATE_FIXTURE_PATH"],
    ["successor bad lineage", (root: string) => mutateJson(join(root, "successor.json"), (value) => {
      record(value["lineage"])["baseSchemaVersion"] = "filesystem-residue-corpus.0"
    }), "SUCCESSOR_LINEAGE_MISMATCH"],
    ["lock drift", (root: string) => writeFileSync(join(root, "canonical-lock.json"), `${readFileSync(join(root, "canonical-lock.json"), "utf8")}\n`), "CANONICAL_LOCK_DRIFT"],
    ["malformed candidate", (root: string) => writeFileSync(join(root, "successor.json"), "{broken"), "JSON_MALFORMED"],
    ["unsafe traversal path", (root: string) => mutateJson(join(root, "successor.json"), (value) => {
      record(array(value["records"])[4])["fixturePath"] = "../outside.json"
    }), "UNSAFE_PATH"],
  ])("fails closed for %s", (_scenario, mutate, code) => {
    const root = copyExperiment()
    mutate(root)

    const result = run(["--successor"], root)

    expect(result.status).toBe(1)
    expect(codes(parse(result))).toContain(code)
  })

  it("rejects coordinated fixture and manifest hash changes", () => {
    const root = copyExperiment()
    const fixturePath = join(root, "fixtures", "successor", "residue-test-report.json")
    writeFileSync(fixturePath, `${readFileSync(fixturePath, "utf8")}\n`)
    mutateJson(join(root, "successor.json"), (value) => {
      const appended = record(array(value["records"])[4])
      appended["fixtureSha256"] = sha256(readFileSync(fixturePath, "utf8"))
    })

    const result = run(["--successor"], root)

    expect(result.status).toBe(1)
    expect(codes(parse(result))).toContain("CANONICAL_SEMANTICS_MISMATCH")
  })

  it("rejects symlink fixture paths before following the link", () => {
    const root = copyExperiment()
    const linkedPath = join(root, "fixtures", "successor", "linked.json")
    symlinkSync(join(root, "fixtures", "base", "residue-build.json"), linkedPath)
    mutateJson(join(root, "successor.json"), (value) => {
      record(array(value["records"])[4])["fixturePath"] = "fixtures/successor/linked.json"
    })

    const result = run(["--successor"], root)

    expect(result.status).toBe(1)
    expect(codes(parse(result))).toContain("UNSAFE_PATH")
    expect(lstatSync(linkedPath).isSymbolicLink()).toBe(true)
  })

  it("performs no writes while rejecting a malformed or unsafe corpus", () => {
    const root = copyExperiment()
    mutateJson(join(root, "successor.json"), (value) => {
      record(array(value["records"])[4])["fixturePath"] = "fixtures/../escape.json"
    })
    const before = snapshot(root)

    const result = run(["--successor"], root)

    expect(result.status).toBe(1)
    expect(snapshot(root)).toEqual(before)
  })
})

function run(args: readonly string[], root: string): RunResult {
  return spawnSync(process.execPath, [join(root, "validate.mjs"), ...args], {
    cwd: root,
    encoding: "utf8",
  })
}

function runEvaluator(args: readonly string[], root: string): RunResult {
  return spawnSync(process.execPath, [join(root, "evaluate.mjs"), ...args], {
    cwd: root,
    encoding: "utf8",
  })
}

function parse(result: RunResult): JsonRecord {
  return JSON.parse(result.stdout) as JsonRecord
}

function codes(output: JsonRecord): readonly string[] {
  return array(output["errors"]).map((error) => String(record(error)["code"]))
}

function copyExperiment(): string {
  const root = mkdtempSync(join(tmpdir(), "filesystem-residue-corpus-"))
  cpSync(experimentRoot, root, { recursive: true })
  temporaryRoots.push(root)
  return root
}

function readJson(filePath: string): JsonRecord {
  return JSON.parse(readFileSync(filePath, "utf8")) as JsonRecord
}

function mutateJson(filePath: string, mutate: (value: JsonRecord) => void): void {
  const value = readJson(filePath)
  mutate(value)
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function record(value: unknown): JsonRecord {
  if (!isRecord(value)) throw new TypeError("expected record")
  return value
}

function array(value: unknown): JsonRecord[] {
  if (!Array.isArray(value) || !value.every(isRecord)) throw new TypeError("expected record array")
  return value
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function snapshot(root: string): JsonRecord {
  const entries = new Map<string, string>()
  for (const filePath of listFiles(root)) {
    const relative = filePath.slice(root.length + 1)
    const stat = lstatSync(filePath)
    entries.set(relative, stat.isSymbolicLink() ? `symlink:${readFileSync(filePath, "utf8")}` : readFileSync(filePath, "utf8"))
  }
  return Object.fromEntries([...entries.entries()].sort(([left], [right]) => left.localeCompare(right)))
}

function listFiles(root: string): readonly string[] {
  const entries: string[] = []
  for (const name of readdirSync(root)) {
    const filePath = join(root, name)
    if (lstatSync(filePath).isDirectory()) entries.push(...listFiles(filePath))
    else entries.push(filePath)
  }
  return entries
}

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`
}
