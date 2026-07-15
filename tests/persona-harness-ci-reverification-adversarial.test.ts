import { execFileSync } from "node:child_process"
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { createCommandRecord } from "../src/cli/ci-reverification-catalog.js"
import { captureGitIdentity } from "../src/cli/ci-reverification-identity.js"
import { parseGitStatusPorcelain } from "../src/cli/ci-reverification-mutation.js"
import { runCiReverification } from "../src/cli/ci-reverification-runner.js"

const roots: string[] = []

function git(projectDir: string, args: readonly string[]): string {
  return execFileSync("git", [...args], { cwd: projectDir, encoding: "utf8" }).trim()
}

function createProject(script = "#!/bin/sh\nexit 0\n"): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-ci-adversarial-"))
  roots.push(projectDir)
  mkdirSync(join(projectDir, ".persona", "evidence"), { recursive: true })
  mkdirSync(join(projectDir, "src", "main", "java"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "project-profile.jsonc"), `${JSON.stringify({
    defaults: { buildTool: "gradle", framework: "spring", language: "java" },
    questions: [
      { answer: "ko", id: "user-language" },
      { answer: "team", id: "project-context" },
      { answer: "production-service", id: "project-goal" },
      { answer: "long-lived", id: "project-scale" },
      { answer: "rest-api", id: "application-type" },
      { answer: "database", id: "storage" },
      { answer: "jpa", id: "persistence-technology" },
      { answer: "flyway", id: "migration-style" },
      { answer: "domain-first", id: "package-style" },
      { answer: "clean-architecture-light", id: "architecture-style" },
      { answer: "strict", id: "boundary-strictness" },
    ],
    schema: "persona.project-profile.v1",
    scope: { mvp: "java-spring-clean-code", role: "backend" },
    status: "ready",
  }, null, 2)}\n`)
  writeFileSync(join(projectDir, ".persona", "evidence", ".keep"), "")
  writeFileSync(join(projectDir, "src", "main", "java", "App.java"), "class App {}\n")
  writeFileSync(join(projectDir, "gradlew"), script)
  chmodSync(join(projectDir, "gradlew"), 0o755)
  git(projectDir, ["init", "-q"])
  git(projectDir, ["config", "user.email", "ph@example.invalid"])
  git(projectDir, ["config", "user.name", "PH Test"])
  git(projectDir, ["add", "."])
  git(projectDir, ["commit", "-qm", "fixture"])
  return projectDir
}

afterEach(() => {
  for (const root of roots) rmSync(root, { force: true, recursive: true })
  roots.length = 0
})

describe("CI reverification adversarial boundaries", () => {
  it("uses only fixed direct argv with 120s command and 300s attempt budgets", () => {
    const projectDir = createProject()
    const profilePath = join(projectDir, ".persona", "project-profile.jsonc")
    writeFileSync(profilePath, readFileSync(profilePath, "utf8").replace(
      '"status": "ready"',
      '"verificationCommand": "touch /tmp/should-not-run",\n  "status": "ready"',
    ))
    const calls: { readonly args: readonly string[]; readonly command: string; readonly timeoutMs: number }[] = []
    const times = [0, 0, 0, 0, 0, 0, 0, 0]
    const result = runCiReverification(projectDir, "ci", {
      now: () => times.shift() ?? 0,
      runProcess: (options) => {
        calls.push({ args: options.args, command: options.command, timeoutMs: options.timeoutMs })
        return { killed: false, outcome: "passed", outputLimited: false, signal: null, status: 0, stderr: "", stdout: "", timedOut: false }
      },
    })

    expect(result.finalStatus).toBe("passed")
    expect(calls.map((call) => call.args)).toEqual([["test"], ["build"]])
    expect(calls.every((call) => call.command.endsWith("/gradlew"))).toBe(true)
    expect(calls.map((call) => call.timeoutMs)).toEqual([120_000, 120_000])
  })

  it("rejects unsupported or unsafe catalog inputs before starting a command", () => {
    const cases: readonly ((projectDir: string) => void)[] = [
      (projectDir) => writeFileSync(join(projectDir, ".persona", "project-profile.jsonc"), "{ malformed"),
      (projectDir) => {
        const profilePath = join(projectDir, ".persona", "project-profile.jsonc")
        writeFileSync(profilePath, readFileSync(profilePath, "utf8").replace('"buildTool": "gradle"', '"buildTool": "maven"'))
      },
      (projectDir) => rmSync(join(projectDir, "gradlew")),
    ]

    for (const mutate of cases) {
      const projectDir = createProject()
      mutate(projectDir)
      let commandStarts = 0
      const result = runCiReverification(projectDir, "ci", {
        runProcess: () => {
          commandStarts += 1
          return { killed: false, outcome: "passed", outputLimited: false, signal: null, status: 0, stderr: "", stdout: "", timedOut: false }
        },
      })
      expect(result.finalStatus).toBe("unavailable")
      expect(commandStarts).toBe(0)
    }
  })

  it("records only JUnit XML created or updated after the command starts", () => {
    const projectDir = createProject()
    const resultDir = join(projectDir, "build", "test-results", "test")
    mkdirSync(resultDir, { recursive: true })
    const stalePath = join(resultDir, "stale.xml")
    writeFileSync(stalePath, "<testsuite tests=\"1\" />")
    utimesSync(stalePath, new Date(1_000), new Date(1_000))

    const record = createCommandRecord(
      projectDir,
      1,
      "gradle-wrapper-test.1",
      2_000,
      2_100,
      { killed: false, outcome: "passed", outputLimited: false, signal: null, status: 0, stderr: "", stdout: "", timedOut: false },
    )

    expect(record.junitRefs).toEqual([])
  })

  it("fails closed and records a bounded diagnostic for malformed recent JUnit XML", () => {
    const projectDir = createProject()
    const result = runCiReverification(projectDir, "ci", {
      runProcess: () => {
        const resultDir = join(projectDir, "build", "test-results", "test")
        mkdirSync(resultDir, { recursive: true })
        writeFileSync(join(resultDir, "malformed.xml"), "<testsuite><testcase></testsuite>\n")
        return {
          killed: false,
          outcome: "passed",
          outputLimited: false,
          signal: null,
          status: 0,
          stderr: "",
          stdout: "",
          timedOut: false,
        }
      },
    })

    expect(result.finalStatus).toBe("failed")
    expect(result.diagnosticCodes).toContain("junit-malformed-xml")
  })

  it("fails closed when malformed JUnit mtime is just before command start", () => {
    const projectDir = createProject()
    const result = runCiReverification(projectDir, "ci", {
      now: () => 2_000,
      runProcess: () => {
        const resultDir = join(projectDir, "build", "test-results", "test")
        mkdirSync(resultDir, { recursive: true })
        const resultPath = join(resultDir, "malformed-boundary.xml")
        writeFileSync(resultPath, "<testsuite><testcase></testsuite>\n")
        utimesSync(resultPath, new Date(1_999), new Date(1_999))
        return {
          killed: false,
          outcome: "passed",
          outputLimited: false,
          signal: null,
          status: 0,
          stderr: "",
          stdout: "",
          timedOut: false,
        }
      },
    })

    expect(result.finalStatus).toBe("failed")
    expect(result.diagnosticCodes).toContain("junit-malformed-xml")
  })

  it("excludes JUnit output older than the freshness tolerance", () => {
    const projectDir = createProject()
    const result = runCiReverification(projectDir, "ci", {
      now: () => 2_000,
      runProcess: () => {
        const resultDir = join(projectDir, "build", "test-results", "test")
        mkdirSync(resultDir, { recursive: true })
        const resultPath = join(resultDir, "stale-boundary.xml")
        writeFileSync(resultPath, "<testsuite><testcase></testsuite>\n")
        utimesSync(resultPath, new Date(0), new Date(0))
        return {
          killed: false,
          outcome: "passed",
          outputLimited: false,
          signal: null,
          status: 0,
          stderr: "",
          stdout: "",
          timedOut: false,
        }
      },
    })

    expect(result.finalStatus).toBe("passed")
    expect(result.diagnosticCodes).not.toContain("junit-malformed-xml")
  })

  it("stops after the 300s attempt budget and records a later unavailable command", () => {
    const projectDir = createProject()
    const times = [0, 0, 0, 0, 0, 300_001, 300_001]
    const result = runCiReverification(projectDir, "ci", {
      now: () => times.shift() ?? 300_001,
      runProcess: () => ({ killed: false, outcome: "passed", outputLimited: false, signal: null, status: 0, stderr: "", stdout: "", timedOut: false }),
    })

    expect(result.finalStatus).toBe("partial")
    expect(result.diagnosticCodes).toContain("attempt-budget-exhausted")
  })

  it("rejects symlinked evidence and keeps stale agent ledger non-authoritative", () => {
    const symlinked = createProject()
    const outside = mkdtempSync(join(tmpdir(), "persona-ci-evidence-outside-"))
    roots.push(outside)
    rmSync(join(symlinked, ".persona", "evidence"), { force: true, recursive: true })
    symlinkSync(outside, join(symlinked, ".persona", "evidence"))
    expect(runCiReverification(symlinked, "ci").finalStatus).toBe("unavailable")

    const stale = createProject("#!/bin/sh\nexit 9\n")
    const ledger = join(stale, ".persona", "evidence", "agent-success.json")
    const bytes = "{\"status\":\"passed\"}\n"
    writeFileSync(ledger, bytes)
    expect(runCiReverification(stale, "ci").finalStatus).toBe("failed")
    expect(readFileSync(ledger, "utf8")).toBe(bytes)
  })

  it("returns artifact-invalid for parent replacement and oversized mutation data", () => {
    const replaced = createProject()
    expect(runCiReverification(replaced, "ci", {
      beforeArtifactWrite: () => {
        renameSync(join(replaced, ".persona", "evidence"), join(replaced, ".persona", "evidence-old"))
        mkdirSync(join(replaced, ".persona", "evidence"))
      },
    }).finalStatus).toBe("artifact-invalid")

    const oversized = createProject()
    const hugeStatus = parseGitStatusPorcelain(
      Array.from({ length: 5_000 }, (_, index) => `?? generated/${index}-${"x".repeat(80)}.txt\0`).join(""),
    )
    let captures = 0
    const overflowResult = runCiReverification(oversized, "ci", {
      captureGit: (projectDir, root) => {
        captures += 1
        const actual = captureGitIdentity(projectDir, root)
        return captures === 2 && actual.available ? { ...actual, status: hugeStatus } : actual
      },
    })
    expect(overflowResult.finalStatus).toBe("artifact-invalid")
    expect(overflowResult.artifactPath).toBeDefined()
    const artifact = readFileSync(overflowResult.artifactPath ?? "", "utf8")
    expect(Buffer.byteLength(artifact)).toBeLessThanOrEqual(256 * 1024)
    expect(artifact).toContain("artifact-size-exceeded")
    expect(artifact).not.toContain("generated/4999")
  })

  it("allows local pre-Git snapshot absence but makes CI pre-Git failure unavailable", () => {
    const local = createProject()
    const unavailableGit = () => ({ available: false, diagnosticCode: "git-worktree-unavailable" })
    expect(runCiReverification(local, "local", { captureGit: unavailableGit }).finalStatus).toBe("passed")

    const ci = createProject()
    expect(runCiReverification(ci, "ci", { captureGit: unavailableGit }).finalStatus).toBe("unavailable")
  })
})
