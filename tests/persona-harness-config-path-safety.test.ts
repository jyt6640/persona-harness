import {
  chmodSync,
  existsSync,
  lstatSync,
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

import {
  loadHarnessConfigResult,
  resolveConfiguredPathResult,
} from "../src/config/harness-config.js"
import { runPersonaCli } from "../src/cli/index.js"
import { readDoctorSummary } from "../src/cli/doctor.js"
import { readExecutionEvidenceVerification } from "../src/cli/workflow-execution-evidence.js"
import { loadRuleCatalog } from "../src/rules/rule-catalog.js"
import { walkBoundedFiles } from "../src/io/bounded-path-walker.js"

const projects: string[] = []

afterEach(() => {
  for (const projectDir of projects.splice(0)) {
    rmSync(projectDir, { force: true, recursive: true })
  }
})

function createProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-config-path-safety-"))
  projects.push(projectDir)
  return projectDir
}

function writeJson(projectDir: string, relativePath: string, value: unknown): void {
  const filePath = join(projectDir, relativePath)
  mkdirSync(join(filePath, ".."), { recursive: true })
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function writeWorkflow(projectDir: string): void {
  mkdirSync(join(projectDir, ".persona", "workflow"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "workflow", "plan.md"), "Status: accepted\n")
  writeFileSync(
    join(projectDir, ".persona", "workflow", "implementation-report.md"),
    [
      "Status: filled",
      "- README ranges read: all",
      "- Project profile ranges read: all",
      "- `npx ph bearshell ./gradlew test`",
    ].join("\n"),
  )
  writeFileSync(
    join(projectDir, ".persona", "workflow", "review-report.md"),
    ["Status: filled", "- `npx ph bearshell ./gradlew bootRun`"].join("\n"),
  )
}

describe("P3-6 config/path safety", () => {
  it("fails closed on malformed harness config without writing or leaking parser details", () => {
    const projectDir = createProject()
    writeWorkflow(projectDir)
    mkdirSync(join(projectDir, ".persona"), { recursive: true })
    const configPath = join(projectDir, ".persona", "harness.jsonc")
    writeFileSync(configPath, "{ \"evidenceDir\": \"custom\", broken")
    const before = readFileSync(configPath, "utf8")

    const result = loadHarnessConfigResult(projectDir)
    const closure = runPersonaCli(["workflow", "closure", "next", "--json"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(result.diagnostics[0]?.code).toBe("malformed_config")
    expect(closure.status).toBe(0)
    expect(closure.stdout).toContain("harness-config-invalid")
    expect(closure.stdout).toContain("read-only recovery")
    expect(closure.stdout).not.toContain("SyntaxError")
    expect(closure.stdout).not.toContain("broken")
    expect(readFileSync(configPath, "utf8")).toBe(before)
  })

  it("uses the configured evidence root and ignores the default root", () => {
    const projectDir = createProject()
    const customRoot = join(projectDir, ".persona", "custom-evidence")
    mkdirSync(join(customRoot, "phase0"), { recursive: true })
    mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
    writeJson(projectDir, ".persona/harness.jsonc", { evidenceDir: ".persona/custom-evidence" })
    writeJson(projectDir, ".persona/custom-evidence/phase0/verification.json", {
      command: "npx ph bearshell ./gradlew test",
      status: 0,
      tool: "bearshell",
      toolOutput: "BUILD SUCCESSFUL",
    })
    writeJson(projectDir, ".persona/evidence/phase0/verification.json", {
      command: "npx ph bearshell ./gradlew test",
      status: 1,
      tool: "bearshell",
      toolOutput: "BUILD FAILED",
    })

    expect(readExecutionEvidenceVerification(projectDir).verification).toBe("passed")
  })

  it("uses the configured rules root for catalog and doctor", () => {
    const projectDir = createProject()
    const customRules = join(projectDir, ".persona", "custom-rules", "backend")
    mkdirSync(customRules, { recursive: true })
    writeJson(projectDir, ".persona/harness.jsonc", { rulesDir: ".persona/custom-rules" })
    writeFileSync(
      join(customRules, "custom.md"),
      [
        "---",
        "id: custom.rule",
        "source: test",
        "domain: backend",
        "topic: custom",
        "roles:",
        "  - main",
        "globs:",
        "  - \"**/*.java\"",
        "severity: should",
        "---",
        "",
        "- custom policy",
        "",
      ].join("\n"),
    )

    expect(loadRuleCatalog(projectDir).map((entry) => entry.path)).toEqual(["backend/custom.md"])
    expect(readDoctorSummary({ projectDir, env: {} }).rulesFileCount).toBe(1)
  })

  it("rejects configured path escapes and symlink roots before traversal", () => {
    const projectDir = createProject()
    mkdirSync(join(projectDir, ".persona"), { recursive: true })
    writeJson(projectDir, ".persona/harness.jsonc", { evidenceDir: "../outside" })
    expect(resolveConfiguredPathResult(projectDir, "../outside").ok).toBe(false)
    expect(loadHarnessConfigResult(projectDir).diagnostics).toHaveLength(1)

    const symlinkProject = createProject()
    mkdirSync(join(symlinkProject, ".persona"), { recursive: true })
    mkdirSync(join(symlinkProject, "real-evidence"), { recursive: true })
    symlinkSync(join(symlinkProject, "real-evidence"), join(symlinkProject, ".persona", "evidence-link"))
    writeJson(symlinkProject, ".persona/harness.jsonc", { evidenceDir: ".persona/evidence-link" })

    expect(loadHarnessConfigResult(symlinkProject).diagnostics[0]?.code).toBe("unsafe_config_path")
  })

  it("rejects corrupt field shapes instead of silently applying defaults", () => {
    const projectDir = createProject()
    mkdirSync(join(projectDir, ".persona"), { recursive: true })
    writeJson(projectDir, ".persona/harness.jsonc", {
      evidenceDir: { path: ".persona/evidence" },
      features: { runtimeInjection: "yes" },
    })

    const result = loadHarnessConfigResult(projectDir)

    expect(result.safe).toBe(false)
    expect(result.diagnostics[0]?.code).toBe("invalid_config")
    expect(result.config.enabled).toBe(false)
    expect(result.config.features.runtimeInjection).toBe(false)
  })

  it("blocks closure on a symlink discovered below an otherwise valid evidence root", () => {
    const projectDir = createProject()
    writeWorkflow(projectDir)
    mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
    if (process.platform === "win32") {
      return
    }
    symlinkSync(join(projectDir, "missing-evidence"), join(projectDir, ".persona", "evidence", "phase0", "link.json"))

    const closure = runPersonaCli(["workflow", "closure", "next", "--json"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(closure.status).toBe(0)
    expect(closure.stdout).toContain("evidence-path-unsafe")
    expect(lstatSync(join(projectDir, ".persona", "evidence", "phase0", "link.json")).isSymbolicLink()).toBe(true)
  })

  it("returns bounded, no-follow diagnostics for hostile walker inputs", () => {
    const projectDir = createProject()
    const root = join(projectDir, "evidence")
    mkdirSync(join(root, "one", "two", "three"), { recursive: true })
    writeFileSync(join(root, "one", "two", "three", "deep.json"), "{}\n")
    writeFileSync(join(root, "large.json"), "x".repeat(32))
    writeFileSync(join(root, "binary.json"), Buffer.from([0, 1, 2, 3]))
    if (process.platform !== "win32") {
      symlinkSync(root, join(root, "cycle"))
    }

    const result = walkBoundedFiles(root, projectDir, {
      includeText: true,
      maxDepth: 2,
      maxEntries: 10,
      maxFileBytes: 16,
      maxTotalBytes: 32,
      displayRoot: "evidence",
    })

    expect(result.safe).toBe(false)
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining(["walker.depth_exceeded", "walker.file_byte_limit", "walker.binary"]),
    )
    expect(result.diagnostics.every((diagnostic) => diagnostic.message.length <= 240)).toBe(true)
    expect(result.diagnostics.join("\n")).not.toContain(projectDir)

    const totalLimit = walkBoundedFiles(root, projectDir, {
      includeText: false,
      maxFileBytes: 64,
      maxTotalBytes: 8,
      displayRoot: "evidence",
    })
    expect(totalLimit.diagnostics.map((diagnostic) => diagnostic.code)).toContain("walker.byte_limit")
  })

  it("does not create or mutate a hostile path during read-only inspection", () => {
    const projectDir = createProject()
    const root = join(projectDir, "evidence")
    mkdirSync(root, { recursive: true })
    const sentinel = join(projectDir, "sentinel.txt")
    writeFileSync(sentinel, "keep\n")
    chmodSync(sentinel, 0o600)
    const before = readFileSync(sentinel, "utf8")

    walkBoundedFiles(join(projectDir, "missing"), projectDir, {
      includeText: true,
      displayRoot: "missing",
    })

    expect(existsSync(join(projectDir, "missing"))).toBe(false)
    expect(readFileSync(sentinel, "utf8")).toBe(before)
  })
})
