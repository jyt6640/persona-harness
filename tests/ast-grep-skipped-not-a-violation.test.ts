import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

const tempProjects: string[] = []
const originalAstGrepBin = process.env.PH_AST_GREP_BIN

afterEach(() => {
  if (originalAstGrepBin === undefined) {
    delete process.env.PH_AST_GREP_BIN
  } else {
    process.env.PH_AST_GREP_BIN = originalAstGrepBin
  }
  while (tempProjects.length > 0) {
    const projectDir = tempProjects.pop()
    if (projectDir !== undefined) {
      rmSync(projectDir, { recursive: true, force: true })
    }
  }
})

function projectWithConvention(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-skipped-convention-test-"))
  tempProjects.push(projectDir)
  const conventionsDir = join(projectDir, ".persona", "conventions")
  mkdirSync(conventionsDir, { recursive: true })
  writeFileSync(
    join(projectDir, ".persona", "harness.jsonc"),
    `${JSON.stringify({ enabledDomains: ["backend", "programming", "workflow"] }, null, 2)}\n`,
  )
  writeFileSync(
    join(conventionsDir, "java-demo-rule.yml"),
    [
      "id: java.demo-rule",
      "language: Java",
      "message: demo rule",
      "# persona-harness-level: warn",
      "# persona-harness-high-precision: true",
      "rule:",
      "  pattern: $RECEIVER.createNativeQuery($LEFT + $RIGHT)",
      "",
    ].join("\n"),
  )
  const javaDir = join(projectDir, "src", "main", "java", "com", "example")
  mkdirSync(javaDir, { recursive: true })
  writeFileSync(join(javaDir, "Sample.java"), "package com.example;\nclass Sample {}\n")
  return projectDir
}

describe("a convention that could not run", () => {
  it("reports UNKNOWN rather than a violation when ast-grep is unavailable", () => {
    const projectDir = projectWithConvention()

    // Point the resolver at a path that is not ast-grep so the convention is
    // skipped. On a host without ast-grep this is the normal state, and
    // reporting it as WARN fabricated one violation per convention.
    process.env.PH_AST_GREP_BIN = join(projectDir, "definitely-not-ast-grep")
    const result = runPersonaCli(["observe", "--json", "src/main/java"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    const start = result.stdout.indexOf("{")
    expect(start).toBeGreaterThanOrEqual(0)
    const report: unknown = JSON.parse(result.stdout.slice(start))
    const findings = (report as { findings?: readonly Record<string, unknown>[] }).findings ?? []
    const demo = findings.filter((finding) => finding["ruleId"] === "java.demo-rule")

    expect(demo).toHaveLength(1)
    expect(demo[0]?.["result"]).toBe("UNKNOWN")
    expect(demo[0]?.["result"]).not.toBe("WARN")
  })
})
