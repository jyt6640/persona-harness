import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { readWorkflowReportCoverage } from "../src/cli/workflow-report-coverage.js"

const tempProjects: string[] = []

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-workflow-report-coverage-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

function writeReviewReport(projectDir: string, lines: readonly string[]): void {
  const reportPath = join(projectDir, ".persona", "workflow", "review-report.md")
  mkdirSync(join(reportPath, ".."), { recursive: true })
  writeFileSync(reportPath, `${lines.join("\n")}\n`)
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("workflow report coverage finding", () => {
  it("does not check report coverage before implementation report is filled", () => {
    const projectDir = createTempProject()

    const summary = readWorkflowReportCoverage({
      projectDir,
      implementationStatus: "template",
      reviewStatus: "template",
      readCoverageBlocking: true,
      profileReadCoverageBlocking: true,
      javaRoleReadCoverageBlocking: true,
    })

    expect(summary).toStrictEqual({
      reportCoverage: "not checked until implementation report is filled",
      reportCoverageBlocking: false,
      reportCoverageFinding: "PASS",
    })
  })

  it("summarizes filled report coverage gaps as structured WARN evidence", () => {
    const projectDir = createTempProject()
    writeReviewReport(projectDir, [
      "Status: filled",
      "- [ ] README/plan read method와 ranges가 implementation report에 남아 있다.",
      "- [ ] project profile read method와 ranges가 implementation report에 남아 있다.",
      "- [ ] README 요구사항이 구현 결과와 대응된다.",
    ])

    const summary = readWorkflowReportCoverage({
      projectDir,
      implementationStatus: "filled",
      reviewStatus: "filled",
      readCoverageBlocking: true,
      profileReadCoverageBlocking: true,
      javaRoleReadCoverageBlocking: true,
    })

    expect(summary).toStrictEqual({
      reportCoverage:
        "reports say filled but required coverage is missing: README coverage missing, profile read coverage missing, Java role read coverage missing, review report checklist template-like",
      reportCoverageBlocking: true,
      reportCoverageFinding: "WARN",
    })
  })

  it("passes when filled reports have coverage and checked review evidence", () => {
    const projectDir = createTempProject()
    writeReviewReport(projectDir, [
      "Status: filled",
      "- [x] README/plan read method와 ranges가 implementation report에 남아 있다.",
      "- [x] project profile read method와 ranges가 implementation report에 남아 있다.",
    ])

    const summary = readWorkflowReportCoverage({
      projectDir,
      implementationStatus: "filled",
      reviewStatus: "filled",
      readCoverageBlocking: false,
      profileReadCoverageBlocking: false,
      javaRoleReadCoverageBlocking: false,
    })

    expect(summary).toStrictEqual({
      reportCoverage: "filled reports include required coverage/checklist evidence",
      reportCoverageBlocking: false,
      reportCoverageFinding: "PASS",
    })
  })
})
