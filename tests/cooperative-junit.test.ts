import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { assessCooperativeJUnit } from "../src/cli/cooperative-junit.js"
import { snapshotJUnitResults } from "../src/cli/junit-result-discovery.js"

const projects: string[] = []

afterEach(() => {
  for (const projectDir of projects.splice(0)) {
    rmSync(projectDir, { force: true, recursive: true })
  }
})

describe("cooperative JUnit assessment", () => {
  it("requires a content-fresh semantic passing report", () => {
    // Given: an old successful report present before the fixed test command.
    const projectDir = createProject(validReport("first"))
    const baseline = snapshotJUnitResults(projectDir)

    // When: the post-command report is unchanged.
    const stale = assessCooperativeJUnit(projectDir, baseline)
    writeReport(projectDir, validReport("second"))
    const fresh = assessCooperativeJUnit(projectDir, baseline)

    // Then: stale XML blocks while a new semantic passing result succeeds.
    expect(stale).toEqual({ code: "junit-stale-report", kind: "blocked" })
    expect(fresh).toMatchObject({ kind: "passed", passed: 1, skipped: 0, testCount: 1 })
  })

  it.each([
    ["hidden failure", "<testsuite tests=\"1\" failures=\"0\" errors=\"0\" skipped=\"0\"><testcase name=\"works\"><failure/></testcase></testsuite>", "junit-accounting-mismatch"],
    ["hidden error", "<testsuite tests=\"1\" failures=\"0\" errors=\"0\" skipped=\"0\"><testcase name=\"works\"><error/></testcase></testsuite>", "junit-accounting-mismatch"],
    ["nested hidden failure", "<testsuite tests=\"1\" failures=\"0\" errors=\"0\" skipped=\"0\"><testcase name=\"works\"><system-out><failure/></system-out></testcase></testsuite>", "junit-accounting-mismatch"],
    ["aggregate mismatch", "<testsuite tests=\"2\" failures=\"0\" errors=\"0\" skipped=\"0\"><testcase name=\"works\"/></testsuite>", "junit-accounting-mismatch"],
    ["all skipped", "<testsuite tests=\"1\" failures=\"0\" errors=\"0\" skipped=\"1\"><testcase name=\"works\"><skipped/></testcase></testsuite>", "junit-skipped-only"],
    ["zero tests", "<testsuite tests=\"0\" failures=\"0\" errors=\"0\" skipped=\"0\"/>", "junit-zero-tests"],
    ["malformed XML", "<testsuite tests=\"1\" failures=\"0\" errors=\"0\" skipped=\"0\"><testcase name=\"works\"></testsuite>", "junit-malformed-xml"],
  ])("blocks %s", (_name, report, code) => {
    // Given: a report whose testcase semantics cannot prove a passing test run.
    const projectDir = createProject()
    const baseline = snapshotJUnitResults(projectDir)
    writeReport(projectDir, report)

    // When: the report is assessed after the fixed command.
    const result = assessCooperativeJUnit(projectDir, baseline)

    // Then: semantic accounting fails closed.
    expect(result).toEqual({ code, kind: "blocked" })
  })

  it("blocks an unsafe report tree", () => {
    // Given: a JUnit result directory containing a symbolic link.
    const projectDir = createProject()
    const baseline = snapshotJUnitResults(projectDir)
    const root = join(projectDir, "build", "test-results", "test")
    const outside = join(projectDir, "outside.xml")
    mkdirSync(root, { recursive: true })
    writeFileSync(outside, validReport("outside"))
    symlinkSync(outside, join(root, "linked.xml"))

    // When: cooperative assessment reads the report tree.
    const result = assessCooperativeJUnit(projectDir, baseline)

    // Then: no symlinked report can supply verification facts.
    expect(result).toEqual({ code: "junit-unsafe-report", kind: "blocked" })
  })
})

function createProject(initialReport?: string): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-cooperative-junit-"))
  projects.push(projectDir)
  if (initialReport !== undefined) writeReport(projectDir, initialReport)
  return projectDir
}

function writeReport(projectDir: string, report: string): void {
  const root = join(projectDir, "build", "test-results", "test")
  mkdirSync(root, { recursive: true })
  writeFileSync(join(root, "TEST-example.xml"), report)
}

function validReport(name: string): string {
  return `<testsuite tests="1" failures="0" errors="0" skipped="0"><testcase name="${name}"/></testsuite>`
}
