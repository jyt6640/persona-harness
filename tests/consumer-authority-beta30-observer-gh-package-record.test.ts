import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  OBSERVER_GH_OPTIONAL_ANCILLARY_RECORDS,
  OBSERVER_GH_PACKAGE_RECORD_SHAPES,
  OBSERVER_GH_POLICY_PRIMARY_RECORD,
  ObserverGhPackageOwnershipError,
  ObserverGhPackageRecordError,
  parseObserverGhPackageRecord,
  readInstalledGhPackageRecord,
  selectInstalledObserverGhCandidate,
} from "../scripts/consumer-authority-observer-gh-package-record.mjs"
import { observerGhStageCodeForWorkflowSelector } from "../scripts/consumer-authority-observer-gh-stage.mjs"
import { assessObserverGhTool } from "../scripts/consumer-authority-observer-gh-tool.mjs"
import { provisionWorkflowObserverGhTool } from "../scripts/consumer-authority-observer-gh-workflow-selector.mjs"

describe("consumer authority beta.30 primary-centric observer gh package record", () => {
  it("reports a bounded record-path shape before it can write a workflow output", () => {
    const root = mkdtempSync(join(tmpdir(), "beta30-record-path-"))
    const runnerTemp = join(root, "runner-temp")
    const githubOutput = join(root, "github-output")
    try {
      mkdirSync(runnerTemp)
      writeFileSync(githubOutput, "")

      const result = provisionWorkflowObserverGhTool({
        environment: { GITHUB_OUTPUT: githubOutput, RUNNER_TEMP: runnerTemp },
        readPackageRecord: () => {
          throw new ObserverGhPackageRecordError("record-path")
        },
      })

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

  it("selects only the fixed primary while allowing the known completion in executable mode and inert secondary records", () => {
    const [completion] = OBSERVER_GH_OPTIONAL_ANCILLARY_RECORDS
    const inert = "/usr/share/doc/gh/gh"
    const stats = new Map([
      [OBSERVER_GH_POLICY_PRIMARY_RECORD, fixtureStat(0o100755)],
      [completion, fixtureStat(0o100755)],
      [inert, fixtureStat(0o100644)],
    ])
    const lstat = (path: string) => stats.get(path) ?? missingStat()

    const primaryOnly = parseObserverGhPackageRecord(Buffer.from(`${OBSERVER_GH_POLICY_PRIMARY_RECORD}\n`, "utf8"))
    const documented = parseObserverGhPackageRecord(Buffer.from(`${OBSERVER_GH_POLICY_PRIMARY_RECORD}\n${completion}\n`, "utf8"))
    const withInertSecondary = parseObserverGhPackageRecord(Buffer.from(`${OBSERVER_GH_POLICY_PRIMARY_RECORD}\n${inert}\n`, "utf8"))

    for (const records of [primaryOnly, documented, withInertSecondary]) {
      expect(selectInstalledObserverGhCandidate(records, { lstat })).toEqual({
        candidate: OBSERVER_GH_POLICY_PRIMARY_RECORD,
        packageRecordShape: "canonical",
      })
    }
    expect(OBSERVER_GH_PACKAGE_RECORD_SHAPES).toEqual([
      "record-encoding",
      "record-path",
      "primary-missing",
      "primary-unsafe",
      "ancillary-unsafe",
      "executable-ambiguous",
      "lstat-failed",
      "canonical",
    ])
  })

  it("rejects malformed, unsafe, aliased, and competing secondary records with fixed shapes", () => {
    const [completion] = OBSERVER_GH_OPTIONAL_ANCILLARY_RECORDS
    const inert = "/usr/share/doc/gh/gh"
    const executable = "/opt/gh"
    const alias = "/bin/gh"
    const stats = new Map([
      [OBSERVER_GH_POLICY_PRIMARY_RECORD, fixtureStat(0o100755)],
      [completion, fixtureStat(0o100644)],
      [inert, fixtureStat(0o100644)],
      [executable, fixtureStat(0o100755)],
      [alias, fixtureStat(0o120777, { symlink: true })],
    ])
    const lstat = (path: string) => stats.get(path) ?? missingStat()

    expectShape("record-encoding", () => parseObserverGhPackageRecord(Buffer.from("/usr/bin/gh\r\n", "utf8")))
    expectShape("record-path", () => parseObserverGhPackageRecord(Buffer.from("gh\n", "utf8")))
    expectShape("record-encoding", () => selectInstalledObserverGhCandidate([
      OBSERVER_GH_POLICY_PRIMARY_RECORD,
      OBSERVER_GH_POLICY_PRIMARY_RECORD,
    ], { lstat }))
    expectShape("primary-missing", () => selectInstalledObserverGhCandidate([completion], { lstat }))
    expectShape("primary-unsafe", () => selectInstalledObserverGhCandidate([OBSERVER_GH_POLICY_PRIMARY_RECORD], {
      lstat: () => fixtureStat(0o100644),
    }))
    expectShape("ancillary-unsafe", () => selectInstalledObserverGhCandidate([OBSERVER_GH_POLICY_PRIMARY_RECORD, completion], {
      lstat: (path) => path === completion ? fixtureStat(0o120777, { symlink: true }) : lstat(path),
    }))
    expectShape("ancillary-unsafe", () => selectInstalledObserverGhCandidate([OBSERVER_GH_POLICY_PRIMARY_RECORD, completion], {
      lstat: (path) => path === completion ? fixtureStat(0o040755, { file: false }) : lstat(path),
    }))
    expectShape("ancillary-unsafe", () => selectInstalledObserverGhCandidate([OBSERVER_GH_POLICY_PRIMARY_RECORD, completion], {
      lstat: (path) => path === completion ? missingStat() : lstat(path),
    }))
    expectShape("ancillary-unsafe", () => selectInstalledObserverGhCandidate([OBSERVER_GH_POLICY_PRIMARY_RECORD, inert], {
      lstat: (path) => path === inert ? fixtureStat(0o040755, { file: false }) : lstat(path),
    }))
    expectShape("ancillary-unsafe", () => selectInstalledObserverGhCandidate([OBSERVER_GH_POLICY_PRIMARY_RECORD, inert], {
      lstat: (path) => path === inert ? missingStat() : lstat(path),
    }))
    expectShape("executable-ambiguous", () => selectInstalledObserverGhCandidate([OBSERVER_GH_POLICY_PRIMARY_RECORD, executable], { lstat }))
    expectShape("ancillary-unsafe", () => selectInstalledObserverGhCandidate([OBSERVER_GH_POLICY_PRIMARY_RECORD, alias], { lstat }))
    expectShape("lstat-failed", () => selectInstalledObserverGhCandidate([OBSERVER_GH_POLICY_PRIMARY_RECORD], {
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

  it("keeps every package-record block before private reservation and output handoff", () => {
    const [completion] = OBSERVER_GH_OPTIONAL_ANCILLARY_RECORDS
    const inert = "/usr/share/doc/gh/gh"
    const executable = "/opt/gh"
    const records = [OBSERVER_GH_POLICY_PRIMARY_RECORD, completion]
    const root = mkdtempSync(join(tmpdir(), "beta30-record-blocks-"))
    const runnerTemp = join(root, "runner-temp")
    const githubOutput = join(root, "github-output")
    const stats = new Map([
      [OBSERVER_GH_POLICY_PRIMARY_RECORD, fixtureStat(0o100755)],
      [completion, fixtureStat(0o100755)],
      [inert, fixtureStat(0o100644)],
      [executable, fixtureStat(0o100755)],
    ])
    try {
      mkdirSync(runnerTemp)
      writeFileSync(githubOutput, "")
      const cases: ReadonlyArray<PackageRecordCase> = [
        { shape: "record-encoding", read: () => { throw new ObserverGhPackageRecordError("record-encoding") }, lstat: () => missingStat() },
        { shape: "record-path", read: () => { throw new ObserverGhPackageRecordError("record-path") }, lstat: () => missingStat() },
        { shape: "primary-missing", read: () => [completion], lstat: (path) => stats.get(path) ?? missingStat() },
        { shape: "primary-unsafe", read: () => records, lstat: (path) => path === OBSERVER_GH_POLICY_PRIMARY_RECORD ? fixtureStat(0o100644) : stats.get(path) ?? missingStat() },
        { shape: "ancillary-unsafe", read: () => records, lstat: (path) => path === completion ? fixtureStat(0o120777, { symlink: true }) : stats.get(path) ?? missingStat() },
        { shape: "ancillary-unsafe", read: () => records, lstat: (path) => path === completion ? fixtureStat(0o040755, { file: false }) : stats.get(path) ?? missingStat() },
        { shape: "ancillary-unsafe", read: () => records, lstat: (path) => path === completion ? missingStat() : stats.get(path) ?? missingStat() },
        { shape: "ancillary-unsafe", read: () => [OBSERVER_GH_POLICY_PRIMARY_RECORD, inert], lstat: (path) => path === inert ? missingStat() : stats.get(path) ?? missingStat() },
        { shape: "executable-ambiguous", read: () => [OBSERVER_GH_POLICY_PRIMARY_RECORD, executable], lstat: (path) => stats.get(path) ?? missingStat() },
        { shape: "lstat-failed", read: () => records, lstat: () => { throw Object.assign(new Error("permission denied"), { code: "EACCES" }) } },
      ]

      for (const blockedCase of cases) {
        const result = provisionWorkflowObserverGhTool({
          environment: { GITHUB_OUTPUT: githubOutput, RUNNER_TEMP: runnerTemp },
          lstatPackageRecord: blockedCase.lstat,
          readPackageRecord: blockedCase.read,
        })
        expect(result).toEqual({
          code: "observer-gh-workflow-tool-invalid",
          packageRecordShape: blockedCase.shape,
          selectorStage: "package-record",
          state: "blocked",
        })
        expect(observerGhStageCodeForWorkflowSelector(result)).toBe(`observer-gh-selector-package-record-${blockedCase.shape}`)
        expect(readFileSync(githubOutput, "utf8")).toBe("")
        expect(existsSync(join(runnerTemp, "persona-harness-observer-gh"))).toBe(false)
      }
    } finally {
      rmSync(root, { force: true, recursive: true })
    }
  })

  it("requires separately bounded installed package ownership, status, and architecture", () => {
    const calls: string[][] = []
    const execute = (_command: string, args: string[]) => {
      calls.push(args)
      return args[0] === "--showformat=${db:Status-Abbrev}\t${Architecture}\n"
        ? { status: 0, stdout: Buffer.from("ii \tamd64\n", "utf8") }
        : { status: 0, stdout: Buffer.from(`${OBSERVER_GH_POLICY_PRIMARY_RECORD}\n`, "utf8") }
    }

    expect(readInstalledGhPackageRecord({ architecture: "amd64", execute })).toEqual([OBSERVER_GH_POLICY_PRIMARY_RECORD])
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

  it("contains direct version state under the explicit external runner root", () => {
    const root = mkdtempSync(join(tmpdir(), "beta30-observer-gh-state-root-"))
    const consumer = join(root, "consumer")
    const stateRoot = join(root, "runner-state")
    const executable = join(root, "gh")
    const originalCwd = process.cwd()
    try {
      mkdirSync(consumer)
      mkdirSync(stateRoot)
      writeFileSync(executable, [
        `#!${process.execPath}`,
        "import { mkdirSync, writeFileSync } from 'node:fs';",
        "import { join } from 'node:path';",
        "if (process.env.GH_TOKEN || process.env.GITHUB_TOKEN || process.env.PATH) process.exit(91);",
        "const state = join(process.env.HOME, '.local', 'state', 'gh');",
        "mkdirSync(state, { recursive: true });",
        "writeFileSync(join(state, 'device-id'), 'fixture\\n');",
        "process.stdout.write('gh version 2.96.0 (fixture)\\n');",
        "",
      ].join("\n"))
      chmodSync(executable, 0o755)
      process.chdir(consumer)

      expect(assessObserverGhTool(executable, { stateRoot })).toEqual({
        code: "gh-command-tool-ready",
        state: "ready",
      })
      expect(existsSync(join(consumer, ".local"))).toBe(false)
      expect(existsSync(join(stateRoot, ".local", "state", "gh", "device-id"))).toBe(true)
      expect(assessObserverGhTool(executable, { stateRoot: join(root, "missing") })).toEqual({
        code: "gh-command-tool-invalid",
        state: "blocked",
      })
    } finally {
      process.chdir(originalCwd)
      rmSync(root, { force: true, recursive: true })
    }
  })
})

interface PackageRecordCase {
  readonly lstat: (path: string) => ReturnType<typeof fixtureStat>
  readonly read: () => readonly string[]
  readonly shape: string
}

function expectShape(shape: string, operation: () => unknown): void {
  try {
    operation()
    throw new Error("expected package record block")
  } catch (error) {
    expect(error).toBeInstanceOf(ObserverGhPackageRecordError)
    expect((error as ObserverGhPackageRecordError).shape).toBe(shape)
  }
}

function fixtureStat(mode: number, options: { readonly file?: boolean; readonly symlink?: boolean } = {}) {
  return {
    isFile: () => options.file ?? true,
    isSymbolicLink: () => options.symlink ?? false,
    mode,
  }
}

function missingStat(): never {
  throw Object.assign(new Error("missing"), { code: "ENOENT" })
}
