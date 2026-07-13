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

const experimentRoot = resolve("experiments/fixture-qualification-authorization")
const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots) rmSync(root, { force: true, recursive: true })
  temporaryRoots.length = 0
})

describe("fixture qualification authorization", () => {
  it("keeps pristine authorization non-executing and non-authoritative", () => {
    const result = run(["--validate"], experimentRoot)
    const output = parse(result)

    expect(result.status).toBe(0)
    expect(output).toMatchObject({
      artifactsCreated: 0,
      authorityEligible: false,
      childProcessInvocations: 0,
      commandsExecuted: 0,
      enforcement: false,
      executionAllowed: false,
      networkAccess: false,
      productCliInvocations: 0,
      qualificationAllowed: false,
      qualificationOperationAllowed: false,
      realProjectAccess: false,
      reportOnly: true,
      telemetryEvents: 0,
      writeOperations: 0,
      ok: true,
    })
    expect(codes(output)).toEqual([])
  })

  it("evaluates the authorization as deferred design only", () => {
    const result = runEvaluator(["--evaluate"], experimentRoot)
    const output = parse(result)

    expect(result.status).toBe(0)
    expect(output).toMatchObject({
      decision: "authorization-only-not-executed",
      executionAllowed: false,
      qualificationAllowed: false,
      qualificationOperationAllowed: false,
      sourceInspectionExecuted: false,
      artifactsCreated: 0,
      telemetryEvents: 0,
    })
  })

  it.each([
    ["semantic metadata drift", (root: string) => mutateJson(join(root, "authorization.json"), (value) => {
      record(value["candidate"])["candidateState"] = "ready"
    }), "CANONICAL_SEMANTICS_MISMATCH"],
    ["qualification enablement", (root: string) => mutateJson(join(root, "authorization.json"), (value) => {
      value["qualificationAllowed"] = true
    }), "AUTHORIZATION_ENABLES_OPERATION"],
    ["execution fact drift", (root: string) => mutateJson(join(root, "authorization.json"), (value) => {
      value["commandsExecuted"] = 1
    }), "EXECUTION_FACTS_NONZERO"],
    ["missing source-before evidence", (root: string) => mutateJson(join(root, "authorization.json"), (value) => {
      delete value["sourceEvidenceBefore"]
    }), "SOURCE_FACTS_INVALID"],
    ["negative state accepted", (root: string) => mutateJson(join(root, "fixtures", "negative-states.json"), (value) => {
      record(array(value["cases"])[0])["expectedDecision"] = "accept"
    }), "NEGATIVE_MATRIX_DRIFT"],
    ["duplicate negative case", (root: string) => mutateJson(join(root, "fixtures", "negative-states.json"), (value) => {
      record(array(value["cases"])[1])["id"] = record(array(value["cases"])[0])["id"]
    }), "DUPLICATE_NEGATIVE_CASE"],
    ["malformed authorization", (root: string) => writeFileSync(join(root, "authorization.json"), "{broken"), "JSON_MALFORMED"],
    ["canonical lock drift", (root: string) => writeFileSync(join(root, "canonical-lock.json"), `${readFileSync(join(root, "canonical-lock.json"), "utf8")}\n`), "CANONICAL_LOCK_DRIFT"],
    ["unsafe payload path", (root: string) => mutateJson(join(root, "authorization-transcript.json"), (value) => {
      record(array(value["steps"])[0])["fixturePath"] = "../escape.json"
    }), "UNSAFE_PATH"],
  ])("fails closed for %s", (_scenario, mutate, code) => {
    const root = copyExperiment()
    mutate(root)

    const result = run(["--validate"], root)

    expect(result.status).toBe(1)
    expect(codes(parse(result))).toContain(code)
  })

  it("rejects foreign, corrupt, and pre-existing root states without inference", () => {
    const root = copyExperiment()
    mutateJson(join(root, "fixtures", "negative-states.json"), (value) => {
      const cases = array(value["cases"])
      record(cases[0])["state"] = "owned"
      record(cases[1])["state"] = "valid"
      record(cases[2])["state"] = "absent"
    })

    const result = run(["--validate"], root)

    expect(result.status).toBe(1)
    expect(codes(parse(result))).toContain("NEGATIVE_MATRIX_DRIFT")
  })

  it("rejects symlinked payloads before following the link", () => {
    const root = copyExperiment()
    const linkedPath = join(root, "fixtures", "linked-authorization.json")
    symlinkSync(join(root, "fixtures", "authorization-input.json"), linkedPath)
    mutateJson(join(root, "authorization-transcript.json"), (value) => {
      record(array(value["payloadFiles"])[0])["path"] = "fixtures/linked-authorization.json"
    })

    const result = run(["--validate"], root)

    expect(result.status).toBe(1)
    expect(codes(parse(result))).toContain("UNSAFE_PATH")
    expect(lstatSync(linkedPath).isSymbolicLink()).toBe(true)
  })

  it("performs no writes on absent or inferred source facts", () => {
    const root = copyExperiment()
    mutateJson(join(root, "authorization.json"), (value) => {
      delete value["sourceEvidenceAfter"]
    })
    const before = snapshot(root)

    const result = run(["--validate"], root)

    expect(result.status).toBe(1)
    expect(codes(parse(result))).toContain("SOURCE_FACTS_INVALID")
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
  const root = mkdtempSync(join(tmpdir(), "fixture-qualification-authorization-"))
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
