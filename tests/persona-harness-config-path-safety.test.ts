import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
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
import { formatDoctorSummary, readDoctorSummary } from "../src/cli/doctor.js"
import { runEvidenceAbRunCommand } from "../src/cli/evidence-ab-run.js"
import { writeEvidenceSummary } from "../src/cli/evidence-summary.js"
import { assessVerificationAuthority } from "../src/cli/workflow-verification-receipt.js"
import { readExecutionEvidenceVerification } from "../src/cli/workflow-execution-evidence.js"
import { formatWorkflowStatus, readWorkflowStatus } from "../src/cli/workflow-status.js"
import { loadRuleCatalog } from "../src/rules/rule-catalog.js"
import { walkBoundedFiles } from "../src/io/bounded-path-walker.js"
import { writeIntentEvidence } from "../src/runtime/evidence.js"
import { EntrySteeringTracker } from "../src/runtime/entry-steering-status.js"
import { appendRoleBoundaryObservation } from "../src/runtime/role-boundary-evidence.js"
import { RuntimeSessionRegistry } from "../src/runtime/session-registry.js"
import { TokenTelemetryRecorder } from "../src/runtime/token-telemetry.js"

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
    const closurePayload = JSON.parse(closure.stdout)

    expect(result.diagnostics[0]?.code).toBe("malformed_config")
    expect(closure.status).toBe(0)
    expect(closurePayload.nextStep).toMatchObject({
      blockerId: "harness-config-invalid",
      id: "repair-harness-config",
      source: ".persona/harness.jsonc",
      status: "blocked",
    })
    expect(closurePayload.nextStep).not.toHaveProperty("reason")
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

  it("reports the configured evidence root across status, doctor, closure, and receipt diagnostics", () => {
    const projectDir = createProject()
    const customRoot = join(projectDir, ".persona", "custom-evidence")
    mkdirSync(join(customRoot, "phase0"), { recursive: true })
    writeJson(projectDir, ".persona/harness.jsonc", { evidenceDir: ".persona/custom-evidence" })
    writeJson(projectDir, ".persona/custom-evidence/phase0/legacy.json", {
      generatedBy: "persona-harness",
      status: 0,
    })
    writeWorkflow(projectDir)

    const status = formatWorkflowStatus(readWorkflowStatus(projectDir))
    const doctor = formatDoctorSummary(readDoctorSummary({ projectDir, env: {} }))
    const closure = runPersonaCli(["workflow", "closure", "next", "--json"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })
    const authority = assessVerificationAuthority(projectDir)

    expect(status).toContain(".persona/custom-evidence: present")
    expect(status).not.toContain(".persona/evidence: present")
    expect(doctor).toContain("Evidence root: .persona/custom-evidence")
    expect(doctor).not.toContain("Evidence root: .persona/evidence")
    expect(closure.stdout).toContain(".persona/custom-evidence")
    expect(closure.stdout).not.toContain(".persona/evidence")
    expect(authority.legacyEvidence.files).toEqual([".persona/custom-evidence/phase0/legacy.json"])
    expect(authority.diagnostics.every((diagnostic) => diagnostic.path.startsWith(".persona/custom-evidence"))).toBe(true)
  })

  it("keeps every runtime evidence writer read-only when config parsing fails", () => {
    const projectDir = createProject()
    mkdirSync(join(projectDir, ".persona"), { recursive: true })
    const configPath = join(projectDir, ".persona", "harness.jsonc")
    writeFileSync(configPath, "{ broken")
    writeFileSync(join(projectDir, ".persona", "keep.txt"), "preserve\n")
    const beforePaths = readdirSync(join(projectDir, ".persona"), { recursive: true }).sort()
    const beforeConfig = readFileSync(configPath, "utf8")
    const config = loadHarnessConfigResult(projectDir).config

    writeIntentEvidence(projectDir, {
      hook: "experimental.chat.messages.transform",
      injectedInto: "intent-workflow",
      intent: {
        primary: "programming",
        reason: "test",
        secondary: [],
      },
      railMarker: "test",
      sessionID: "session-invalid-config",
      userPrompt: "implement",
    })
    appendRoleBoundaryObservation(projectDir, {
      currentTicketId: "req-1",
      path: "src/main/java/App.java",
      policy: "test",
      role: "implementer",
      sessionID: "session-invalid-config",
    })
    new EntrySteeringTracker(projectDir, config).apply("session-invalid-config", {
      messages: [],
    })
    new TokenTelemetryRecorder(projectDir).recordMessage({
      id: "message-invalid-config",
      sessionID: "session-invalid-config",
      role: "assistant",
      time: { created: 1, completed: 2 },
      parentID: "parent",
      modelID: "test-model",
      providerID: "test-provider",
      mode: "primary",
      path: { cwd: projectDir, root: projectDir },
      cost: 0,
      tokens: {
        input: 1,
        output: 1,
        reasoning: 0,
        cache: { read: 0, write: 0 },
      },
    })
    new RuntimeSessionRegistry({
      multiAgentEnabled: true,
      projectDir,
      runtimeInjectionEnabled: true,
    }).allowsMainSession("session-invalid-config", "model-input")
    const abRun = runEvidenceAbRunCommand(
      ["--scenario", "invalid-config", "--condition", "off", "--", process.execPath, "-e", "process.exit(0)"],
      { projectDir, env: {} },
    )

    expect(readdirSync(join(projectDir, ".persona"), { recursive: true }).sort()).toEqual(beforePaths)
    expect(readFileSync(configPath, "utf8")).toBe(beforeConfig)
    expect(existsSync(join(projectDir, ".persona", ".invalid-config-path"))).toBe(false)
    expect(abRun.status).toBe(1)
    expect(writeEvidenceSummary({ projectDir, env: {} })).toBeUndefined()
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
