import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  OBSERVER_GH_DOCUMENTED_ANCILLARY_RECORDS,
  OBSERVER_GH_PACKAGE_RECORD_SHAPES,
  OBSERVER_GH_POLICY_PRIMARY_RECORD,
  ObserverGhPackageOwnershipError,
  ObserverGhPackageRecordError,
  parseObserverGhPackageRecord,
  readInstalledGhPackageRecord,
  selectInstalledObserverGhCandidate,
} from "../scripts/consumer-authority-observer-gh-package-record.mjs"
import { observerGhStageCodeForWorkflowSelector } from "../scripts/consumer-authority-observer-gh-stage.mjs"
import { provisionWorkflowObserverGhTool } from "../scripts/consumer-authority-observer-gh-workflow-selector.mjs"

describe("consumer authority beta.29 strict observer gh package record", () => {
  it("reports a bounded record-path shape before it can write a workflow output", () => {
    // Given: a valid workflow output reservation and an invalid package record.
    const root = mkdtempSync(join(tmpdir(), "beta29-record-path-"))
    const runnerTemp = join(root, "runner-temp")
    const githubOutput = join(root, "github-output")
    try {
      mkdirSync(runnerTemp)
      writeFileSync(githubOutput, "")

      // When: the workflow selector receives a nonabsolute record.
      const result = provisionWorkflowObserverGhTool({
        environment: { GITHUB_OUTPUT: githubOutput, RUNNER_TEMP: runnerTemp },
        readPackageRecord: () => {
          throw new ObserverGhPackageRecordError("record-path")
        },
      })

      // Then: it gives only the fixed shape and leaves the output untouched.
      expect(result).toEqual({
        code: "observer-gh-workflow-tool-invalid",
        packageRecordShape: "record-path",
        selectorStage: "package-record",
        state: "blocked",
      })
      expect(readFileSync(githubOutput, "utf8")).toBe("")
      expect(JSON.stringify(result)).not.toContain(root)
      expect(observerGhStageCodeForWorkflowSelector(result)).toBe("observer-gh-selector-package-record-record-path")
    } finally {
      rmSync(root, { force: true, recursive: true })
    }
  })

  it("parses only byte-strict LF package records before selecting the fixed Ubuntu policy primary", () => {
    const [completion] = OBSERVER_GH_DOCUMENTED_ANCILLARY_RECORDS
    const canonical = Buffer.from(`${OBSERVER_GH_POLICY_PRIMARY_RECORD}\n${completion}\n`, "utf8")
    const records = parseObserverGhPackageRecord(canonical)
    const stats = new Map([
      [OBSERVER_GH_POLICY_PRIMARY_RECORD, fixtureStat(0o100755)],
      [completion, fixtureStat(0o100644)],
    ])

    expect(records).toEqual([OBSERVER_GH_POLICY_PRIMARY_RECORD, completion])
    expect(selectInstalledObserverGhCandidate(records, {
      lstat: (path: string) => stats.get(path) ?? missingStat(),
    })).toEqual({ candidate: OBSERVER_GH_POLICY_PRIMARY_RECORD, packageRecordShape: "canonical" })
    expect(OBSERVER_GH_PACKAGE_RECORD_SHAPES).toEqual([
      "record-encoding",
      "record-path",
      "primary-missing",
      "primary-unsafe",
      "ancillary-missing-or-unsafe",
      "ancillary-unknown",
      "executable-ambiguous",
      "lstat-failed",
      "canonical",
    ])
  })

  it("maps every strict package-record rejection through one nonreflective shape", () => {
    const [completion] = OBSERVER_GH_DOCUMENTED_ANCILLARY_RECORDS
    const canonical = [OBSERVER_GH_POLICY_PRIMARY_RECORD, completion]
    const stats = new Map([
      [OBSERVER_GH_POLICY_PRIMARY_RECORD, fixtureStat(0o100755)],
      [completion, fixtureStat(0o100644)],
      ["/opt/gh", fixtureStat(0o100755)],
      ["/usr/share/doc/gh/gh", fixtureStat(0o100644)],
    ])

    expectShape("record-encoding", () => parseObserverGhPackageRecord(Buffer.from("/usr/bin/gh\r\n", "utf8")))
    expectShape("record-path", () => parseObserverGhPackageRecord(Buffer.from("gh\n", "utf8")))
    expectShape("primary-missing", () => selectInstalledObserverGhCandidate([completion], { lstat: (path) => stats.get(path) ?? missingStat() }))
    expectShape("primary-unsafe", () => selectInstalledObserverGhCandidate(canonical, {
      lstat: (path) => path === OBSERVER_GH_POLICY_PRIMARY_RECORD ? fixtureStat(0o100644) : stats.get(path) ?? missingStat(),
    }))
    expectShape("ancillary-missing-or-unsafe", () => selectInstalledObserverGhCandidate([OBSERVER_GH_POLICY_PRIMARY_RECORD], { lstat: (path) => stats.get(path) ?? missingStat() }))
    expectShape("ancillary-unknown", () => selectInstalledObserverGhCandidate([...canonical, "/usr/share/doc/gh/gh"], { lstat: (path) => stats.get(path) ?? missingStat() }))
    expectShape("executable-ambiguous", () => selectInstalledObserverGhCandidate([...canonical, "/opt/gh"], { lstat: (path) => stats.get(path) ?? missingStat() }))
    expectShape("lstat-failed", () => selectInstalledObserverGhCandidate(canonical, {
      lstat: () => {
        throw Object.assign(new Error("permission denied"), { code: "EACCES" })
      },
    }))

    for (const packageRecordShape of OBSERVER_GH_PACKAGE_RECORD_SHAPES) {
      expect(observerGhStageCodeForWorkflowSelector({
        code: "observer-gh-workflow-tool-invalid",
        packageRecordShape,
        selectorStage: "package-record",
        state: "blocked",
      })).toBe(`observer-gh-selector-package-record-${packageRecordShape}`)
    }
  })

  it("keeps every strict record block before private reservation and output handoff", () => {
    const [completion] = OBSERVER_GH_DOCUMENTED_ANCILLARY_RECORDS
    const records = [OBSERVER_GH_POLICY_PRIMARY_RECORD, completion]
    const root = mkdtempSync(join(tmpdir(), "beta29-record-blocks-"))
    const runnerTemp = join(root, "runner-temp")
    const githubOutput = join(root, "github-output")
    const stats = new Map([
      [OBSERVER_GH_POLICY_PRIMARY_RECORD, fixtureStat(0o100755)],
      [completion, fixtureStat(0o100644)],
      ["/opt/gh", fixtureStat(0o100755)],
      ["/usr/share/doc/gh/gh", fixtureStat(0o100644)],
    ])
    try {
      mkdirSync(runnerTemp)
      writeFileSync(githubOutput, "")
      const cases: ReadonlyArray<readonly [string, () => readonly string[], (path: string) => unknown]> = [
        ["record-encoding", () => { throw new ObserverGhPackageRecordError("record-encoding") }, () => missingStat()],
        ["record-path", () => { throw new ObserverGhPackageRecordError("record-path") }, () => missingStat()],
        ["primary-missing", () => [completion], (path) => stats.get(path) ?? missingStat()],
        ["primary-unsafe", () => records, (path) => path === OBSERVER_GH_POLICY_PRIMARY_RECORD ? fixtureStat(0o100644) : stats.get(path) ?? missingStat()],
        ["ancillary-missing-or-unsafe", () => [OBSERVER_GH_POLICY_PRIMARY_RECORD], (path) => stats.get(path) ?? missingStat()],
        ["ancillary-unknown", () => [...records, "/usr/share/doc/gh/gh"], (path) => stats.get(path) ?? missingStat()],
        ["executable-ambiguous", () => [...records, "/opt/gh"], (path) => stats.get(path) ?? missingStat()],
        ["lstat-failed", () => records, () => { throw Object.assign(new Error("permission denied"), { code: "EACCES" }) }],
      ]

      for (const [packageRecordShape, readPackageRecord, lstatPackageRecord] of cases) {
        const result = provisionWorkflowObserverGhTool({
          environment: { GITHUB_OUTPUT: githubOutput, RUNNER_TEMP: runnerTemp },
          lstatPackageRecord,
          readPackageRecord,
        })
        expect(result).toEqual({
          code: "observer-gh-workflow-tool-invalid",
          packageRecordShape,
          selectorStage: "package-record",
          state: "blocked",
        })
        expect(observerGhStageCodeForWorkflowSelector(result)).toBe(`observer-gh-selector-package-record-${packageRecordShape}`)
        expect(readFileSync(githubOutput, "utf8")).toBe("")
        expect(existsSync(join(runnerTemp, "persona-harness-observer-gh"))).toBe(false)
      }
    } finally {
      rmSync(root, { force: true, recursive: true })
    }
  })

  it("requires separately bounded installed package ownership, status, and architecture", () => {
    const [completion] = OBSERVER_GH_DOCUMENTED_ANCILLARY_RECORDS
    const calls: string[][] = []
    const execute = (_command: string, args: string[]) => {
      calls.push(args)
      return args[0] === "--showformat=${db:Status-Abbrev}\t${Architecture}\n"
        ? { status: 0, stdout: Buffer.from("ii \tamd64\n", "utf8") }
        : { status: 0, stdout: Buffer.from(`${OBSERVER_GH_POLICY_PRIMARY_RECORD}\n${completion}\n`, "utf8") }
    }

    expect(readInstalledGhPackageRecord({ architecture: "amd64", execute })).toEqual([
      OBSERVER_GH_POLICY_PRIMARY_RECORD,
      completion,
    ])
    expect(calls).toEqual([
      ["--showformat=${db:Status-Abbrev}\t${Architecture}\n", "--show", "gh"],
      ["--listfiles", "gh"],
    ])
    expect(() => readInstalledGhPackageRecord({
      architecture: "amd64",
      execute: () => ({ status: 0, stdout: Buffer.from("iU \tamd64\n", "utf8") }),
    })).toThrow(ObserverGhPackageOwnershipError)
    expect(() => readInstalledGhPackageRecord({
      architecture: "amd64",
      execute: () => ({ status: 0, stdout: Buffer.from("ii \tarm64\n", "utf8") }),
    })).toThrow(ObserverGhPackageOwnershipError)
  })
})

function expectShape(shape: string, operation: () => unknown): void {
  try {
    operation()
    throw new Error("expected strict package record block")
  } catch (error) {
    expect(error).toBeInstanceOf(ObserverGhPackageRecordError)
    expect((error as ObserverGhPackageRecordError).shape).toBe(shape)
  }
}

function fixtureStat(mode: number) {
  return {
    isFile: () => true,
    isSymbolicLink: () => false,
    mode,
  }
}

function missingStat(): never {
  throw Object.assign(new Error("missing"), { code: "ENOENT" })
}
