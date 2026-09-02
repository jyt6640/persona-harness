import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

const temporaryProjects: string[] = []

afterEach(() => {
  for (const projectDir of temporaryProjects) rmSync(projectDir, { force: true, recursive: true })
  temporaryProjects.length = 0
})

describe("portable Socratic interview CLI", () => {
  it("keeps the default start read-only, writes only approved structured decisions, and replays them without another question", () => {
    const projectDir = createInitializedProject()
    const started = run(projectDir, ["interview", "start", "--json"])
    const start = parseJson(started.stdout)

    expect(started).toMatchObject({ status: 0, stderr: "" })
    expect(start).toMatchObject({ kind: "question", progress: 10, visibleActivation: true })
    expect(existsSync(decisionPath(projectDir))).toBe(false)

    let state = start.state as Record<string, unknown>
    for (const answer of answers()) {
      const advanced = runStdin(projectDir, "advance", { response: answer, state })
      const output = parseJson(advanced.stdout)
      expect(advanced).toMatchObject({ status: 0, stderr: "" })
      state = output.state as Record<string, unknown>
    }

    const unapproved = runStdin(projectDir, "approve", { confirmation: "yes", state })
    expect(parseJson(unapproved.stdout)).toMatchObject({ kind: "approval-required", progress: 90 })
    expect(existsSync(decisionPath(projectDir))).toBe(false)
    const approved = runStdin(projectDir, "approve", { confirmation: "approve", state })
    const output = parseJson(approved.stdout)
    const record = parseJson(readFileSync(decisionPath(projectDir), "utf8"))
    const replay = run(projectDir, ["interview", "start", "--json"])
    const replayOutput = parseJson(replay.stdout)
    const explicitReplacement = run(projectDir, ["interview", "start", "--json", "--new"])
    const replacementOutput = parseJson(explicitReplacement.stdout)

    expect(approved).toMatchObject({ status: 0, stderr: "" })
    expect(output).toMatchObject({ kind: "approved", progress: 100, recordRevision: 1 })
    expect(record).toMatchObject({
      approval: "explicit",
      recordVersion: "persona-socratic-interview-record.1",
      revision: 1,
    })
    expect(record.decisions).toHaveLength(8)
    expect(Object.keys(record).sort()).toEqual(["approval", "decisions", "recordVersion", "revision"])
    expect(JSON.stringify(record)).not.toContain("projectBinding")
    expect(JSON.stringify(record)).not.toContain("session")
    expect(replay).toMatchObject({ status: 0, stderr: "" })
    expect(replayOutput).toMatchObject({ kind: "approved-decision-replay", progress: 100 })
    expect("question" in replayOutput).toBe(false)
    expect(explicitReplacement).toMatchObject({ status: 0, stderr: "" })
    expect(replacementOutput).toMatchObject({ kind: "question", progress: 10 })
    expect(replacementOutput.state).toMatchObject({ recordRevision: 1 })
  })

  it("fails closed before a follow-up result for foreign, stale, version-mismatched, malformed, and symlinked state", () => {
    const projectDir = createInitializedProject()
    const otherProjectDir = createInitializedProject()
    const started = parseJson(run(projectDir, ["interview", "start", "--json"]).stdout)
    const state = started.state as Record<string, unknown>

    const foreign = runStdin(otherProjectDir, "advance", { response: "Another answer", state })
    const versionMismatch = runStdin(projectDir, "advance", {
      response: "Another answer",
      state: { ...state, contractVersion: "persona-socratic-interview-state.0" },
    })
    const malformed = runStdin(projectDir, "advance", {
      response: "Another answer",
      state: { ...state, topicIndex: 7 },
    })

    expect(foreign).toEqual({ status: 1, stdout: "", stderr: "socratic-interview-state-foreign\n" })
    expect(versionMismatch).toEqual({ status: 1, stdout: "", stderr: "socratic-interview-state-version-mismatch\n" })
    expect(malformed).toEqual({ status: 1, stdout: "", stderr: "socratic-interview-state-malformed\n" })
    expect(existsSync(decisionPath(projectDir))).toBe(false)

    const externalDir = mkdtempSync(join(tmpdir(), "persona-socratic-interview-external-"))
    temporaryProjects.push(externalDir)
    mkdirSync(join(projectDir, ".persona"), { recursive: true })
    symlinkSync(externalDir, join(projectDir, ".persona", "decisions"), "dir")
    const unsafe = run(projectDir, ["interview", "start", "--json"])
    expect(unsafe).toEqual({ status: 1, stdout: "", stderr: "socratic-interview-state-unsafe\n" })

    const malformedProjectDir = createInitializedProject()
    mkdirSync(join(malformedProjectDir, ".persona", "decisions"), { recursive: true })
    writeFileSync(decisionPath(malformedProjectDir), "{\n")
    const malformedRecord = run(malformedProjectDir, ["interview", "start", "--json"])
    expect(malformedRecord).toEqual({ status: 1, stdout: "", stderr: "socratic-interview-record-malformed\n" })
  })

  it("detects a changed decision record as stale before a state can be approved", () => {
    const projectDir = createInitializedProject()
    const started = parseJson(run(projectDir, ["interview", "start", "--json"]).stdout)
    const state = started.state as Record<string, unknown>

    mkdirSync(join(projectDir, ".persona", "decisions"), { recursive: true })
    writeApprovedRecord(projectDir)

    const stale = runStdin(projectDir, "advance", { response: "Another answer", state })
    expect(stale).toEqual({ status: 1, stdout: "", stderr: "socratic-interview-state-stale\n" })
  })
})

function createInitializedProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-socratic-interview-test-"))
  temporaryProjects.push(projectDir)
  mkdirSync(join(projectDir, ".persona", "workflow"), { recursive: true })
  return projectDir
}

function answers(): readonly string[] {
  return [
    "People booking a nearby shared workspace.",
    "They cannot tell whether a desk is available today.",
    "They can reserve a desk without sending messages.",
    "Search, select a desk, and confirm one booking.",
    "Availability and one confirmed booking.",
    "No payments or team administration in the first release.",
    "One completed booking from a new user.",
    "Start with one location and manual moderation.",
  ]
}

function decisionPath(projectDir: string): string {
  return join(projectDir, ".persona", "decisions", "socratic-interview.json")
}

function parseJson(stdout: string): Record<string, unknown> {
  return JSON.parse(stdout) as Record<string, unknown>
}

function run(projectDir: string, args: readonly string[]) {
  return runPersonaCli(args, { cwd: projectDir, env: {}, invocationName: "ph" })
}

function runStdin(projectDir: string, command: "advance" | "approve", input: Record<string, unknown>) {
  return runPersonaCli(["interview", command, "--json", "--stdin"], {
    cwd: projectDir,
    env: {},
    invocationName: "ph",
    stdin: JSON.stringify(input),
  })
}

function writeApprovedRecord(projectDir: string): void {
  const decisions = answers().map((decision, index) => ({ decision, topic: [
    "target-user",
    "problem",
    "outcome",
    "journey",
    "mvp",
    "non-goals",
    "success-signal",
    "constraints",
  ][index] }))
  writeFileSync(decisionPath(projectDir), `${JSON.stringify({
    approval: "explicit",
    decisions,
    recordVersion: "persona-socratic-interview-record.1",
    revision: 1,
  })}\n`)
}
