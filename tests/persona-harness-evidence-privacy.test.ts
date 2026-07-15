import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import process from "node:process"

import { afterEach, describe, expect, it } from "vitest"

import {
  EVIDENCE_MODE,
  EVIDENCE_PRIVACY_CLASS,
} from "../src/config/evidence-privacy.js"
import { loadHarnessConfig } from "../src/config/harness-config.js"
import { supportsPosixFileModes } from "../src/io/atomic-file.js"
import { writeBearshellExecutionEvidence } from "../src/runtime/execution-evidence.js"
import { sanitizeEvidenceValue } from "../src/runtime/evidence-redaction.js"
import { writeIntentEvidence, writeRailComplianceEvidence } from "../src/runtime/evidence.js"

const projects: string[] = []

function createProject(evidenceMode?: string): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-evidence-privacy-"))
  projects.push(projectDir)
  if (evidenceMode !== undefined) {
    mkdirSync(join(projectDir, ".persona"), { recursive: true })
    writeFileSync(
      join(projectDir, ".persona", "harness.jsonc"),
      `${JSON.stringify({ evidenceMode }, null, 2)}\n`,
    )
  }
  return projectDir
}

function evidenceFiles(projectDir: string): readonly string[] {
  const evidenceDir = join(projectDir, ".persona", "evidence", "phase0")
  if (!existsSync(evidenceDir)) {
    return []
  }
  return readdirSync(evidenceDir)
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) => join(evidenceDir, fileName))
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readOnlyEvidence(projectDir: string): Readonly<Record<string, unknown>> {
  const files = evidenceFiles(projectDir)
  expect(files).toHaveLength(1)
  const path = files[0]
  if (path === undefined) {
    throw new Error("expected one evidence file")
  }
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"))
  if (!isRecord(parsed)) {
    throw new Error("expected evidence object")
  }
  return parsed
}

function secretFixture(): { readonly source: string; readonly values: readonly string[] } {
  const apiKey = ["sk", "live", "A".repeat(24)].join("-")
  const bearer = ["eyJhbGciOiJIUzI1NiJ9", "payload", "signature"].join(".")
  const password = ["correct", "horse", "battery"].join("-")
  const jdbcPassword = ["database", "credential"].join("-")
  const pemBody = `MII${"A".repeat(48)}`
  const urlPassword = ["url", "credential"].join("-")
  return {
    source: [
      `OPENAI_API_KEY=${apiKey}`,
      `Authorization: Bearer ${bearer}`,
      `{"password":"${password}"}`,
      `jdbc:postgresql://db-user:${jdbcPassword}@localhost/app`,
      `-----BEGIN PRIVATE KEY-----\n${pemBody}\n-----END PRIVATE KEY-----`,
      `https://service-user:${urlPassword}@example.invalid/path`,
    ].join("\n"),
    values: [apiKey, bearer, password, jdbcPassword, pemBody, urlPassword],
  }
}

function writeExecution(projectDir: string, diagnostic: string): string {
  const ref = writeBearshellExecutionEvidence(projectDir, {
    command: `node --password ${diagnostic}`,
    durationMs: 17,
    endedAt: "2026-07-15T12:00:00.000Z",
    status: 0,
    stderr: diagnostic,
    stdout: `${diagnostic}\nBUILD SUCCESSFUL\n${"x".repeat(5_000)}`,
  })
  expect(ref).not.toBeNull()
  return ref ?? ""
}

afterEach(() => {
  for (const projectDir of projects.splice(0)) {
    rmSync(projectDir, { recursive: true, force: true })
  }
})

describe("local evidence privacy", () => {
  it("defines privacy classes without making attestation metadata a persistence mode", () => {
    const persistenceModes: readonly string[] = Object.values(EVIDENCE_MODE)
    expect(Object.values(EVIDENCE_PRIVACY_CLASS)).toEqual([
      "metadata-safe",
      "redacted-prompt-diagnostics",
      "redacted-execution-diagnostics",
      "trusted-attestation-metadata",
    ])
    expect(persistenceModes.includes(EVIDENCE_PRIVACY_CLASS.trustedAttestationMetadata)).toBe(false)
    expect(supportsPosixFileModes("linux")).toBe(true)
    expect(supportsPosixFileModes("win32")).toBe(false)
  })

  it("normalizes the metadata_only compatibility alias to safe metadata", () => {
    const projectDir = createProject("metadata_only")

    const config = loadHarnessConfig(projectDir)

    expect(config.evidenceMode).toBe("safe_metadata")
  })

  it("persists metadata and hashes without raw execution diagnostics by default", () => {
    const projectDir = createProject()
    const secret = secretFixture()

    writeExecution(projectDir, secret.source)

    const path = evidenceFiles(projectDir)[0]
    if (path === undefined) {
      throw new Error("expected execution evidence")
    }
    const source = readFileSync(path, "utf8")
    const payload = readOnlyEvidence(projectDir)
    expect(secret.values.every((value) => !source.includes(value))).toBe(true)
    expect(payload).toMatchObject({
      schemaVersion: "phase0.execution.2",
      privacyClass: "metadata-safe",
      status: 0,
      tool: "bearshell",
    })
    expect(payload["runId"]).toEqual(expect.stringMatching(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u))
    expect(payload["command"]).toBeUndefined()
    expect(payload["stdout"]).toBeUndefined()
    expect(payload["stderr"]).toBeUndefined()
    expect(payload["toolOutput"]).toBeUndefined()
    expect(payload["commandSummary"]).toEqual(expect.objectContaining({ charCount: expect.any(Number) }))
    expect(payload["stdoutSummary"]).toEqual(expect.objectContaining({ sha256: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u) }))
  })

  it("writes only bounded redacted execution previews when diagnostics are enabled", () => {
    const projectDir = createProject("redacted_diagnostics")
    const secret = secretFixture()

    writeExecution(projectDir, secret.source)

    const path = evidenceFiles(projectDir)[0]
    if (path === undefined) {
      throw new Error("expected execution evidence")
    }
    const source = readFileSync(path, "utf8")
    const payload = readOnlyEvidence(projectDir)
    const stdoutSummary = payload["stdoutSummary"]
    expect(secret.values.every((value) => !source.includes(value))).toBe(true)
    expect(payload["privacyClass"]).toBe("redacted-execution-diagnostics")
    expect(
      typeof stdoutSummary === "object"
        && stdoutSummary !== null
        && "preview" in stdoutSummary
        && typeof stdoutSummary.preview === "string"
        && stdoutSummary.preview.includes("[REDACTED]")
        && stdoutSummary.preview.length <= 2_048,
    ).toBe(true)
  })

  it("omits prompts by default and records a bounded redacted prompt only with explicit opt-in", () => {
    const secret = secretFixture()
    const defaultProject = createProject()
    const optedInProject = createProject("prompt_diagnostics")
    const event = {
      hook: "experimental.chat.messages.transform" as const,
      injectedInto: "intent-workflow" as const,
      intent: {
        primary: "programming" as const,
        reason: "Direct code creation or edit request detected.",
        secondary: [],
      },
      railMarker: "[Persona Harness Programming Workflow]",
      sessionID: "session-prompt-privacy",
      userPrompt: secret.source,
    }

    writeIntentEvidence(defaultProject, event)
    writeIntentEvidence(optedInProject, event)

    const defaultPayload = readOnlyEvidence(defaultProject)
    const optedInPath = evidenceFiles(optedInProject)[0]
    if (optedInPath === undefined) {
      throw new Error("expected prompt diagnostic evidence")
    }
    const optedInSource = readFileSync(optedInPath, "utf8")
    const optedInPayload = readOnlyEvidence(optedInProject)
    expect(defaultPayload["userPrompt"]).toBeUndefined()
    expect(defaultPayload["promptDiagnostic"]).toBeUndefined()
    expect(secret.values.every((value) => !optedInSource.includes(value))).toBe(true)
    expect(optedInPayload["privacyClass"]).toBe("redacted-prompt-diagnostics")
    expect(optedInPayload["promptDiagnostic"]).toEqual(
      expect.objectContaining({
        preview: expect.stringContaining("[REDACTED]"),
        sha256: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
      }),
    )
  })

  it("creates private evidence directories and files on POSIX", () => {
    if (process.platform === "win32") {
      return
    }
    const projectDir = createProject()

    writeExecution(projectDir, "BUILD SUCCESSFUL")

    const evidenceRoot = join(projectDir, ".persona", "evidence")
    const evidenceDir = join(evidenceRoot, "phase0")
    const path = evidenceFiles(projectDir)[0]
    if (path === undefined) {
      throw new Error("expected execution evidence")
    }
    expect(statSync(evidenceRoot).mode & 0o777).toBe(0o700)
    expect(statSync(evidenceDir).mode & 0o777).toBe(0o700)
    expect(statSync(path).mode & 0o777).toBe(0o600)
  })

  it("recursively sanitizes valid bounded JSON-shaped evidence strings", () => {
    const projectDir = createProject()
    const source = JSON.stringify({
      nested: [
        { password: "escaped-placeholder" },
        { apiKey: "sk-live-bounded-json-marker" },
        { path: `${projectDir}/contained.json` },
        { sentinel: "[REDACTED]-/external/bounded.json" },
      ],
    }).replace(
      '"password":"escaped-placeholder"',
      '"password":"\\u0070\\u0061\\u0073\\u0073\\u0077\\u006f\\u0072\\u0064\\u002d\\u006d\\u0061\\u0072\\u006b\\u0065\\u0072"',
    )

    const sanitized = sanitizeEvidenceValue(source)
    expect(typeof sanitized).toBe("string")
    if (typeof sanitized !== "string") {
      throw new Error("expected sanitized JSON string")
    }
    expect(sanitized).not.toContain("sk-live-bounded-json-marker")
    expect(sanitized).not.toContain("password-marker")
    expect(sanitized).not.toContain(projectDir)
    expect(sanitized).not.toContain("/external/bounded.json")
    expect(JSON.parse(sanitized)).toMatchObject({
      nested: [
        { password: "[REDACTED]" },
        { apiKey: "[REDACTED]" },
        { path: "[REDACTED_PATH]" },
        { sentinel: "[REDACTED_PATH]" },
      ],
    })
  })

  it("fails closed for malformed and out-of-budget JSON-shaped strings", () => {
    const cases = [
      '{"password":"malformed-password-marker"',
      JSON.stringify({ password: "oversized-password-marker", padding: "x".repeat(20_000) }),
      JSON.stringify({ password: "deep-password-marker", nested: { nested: { nested: { nested: { nested: { nested: { nested: { nested: { nested: { nested: { nested: { nested: {} } } } } } } } } } } } }),
      JSON.stringify(Array.from({ length: 513 }, (_, index) => ({ id: `node-${index}`, token: "sk-live-node-marker" }))),
    ]

    for (const source of cases) {
      expect(sanitizeEvidenceValue(source)).toBe("[REDACTED_JSON]")
    }
  })

  it("fails closed for out-of-budget JSON-shaped rail-compliance messages", () => {
    const projectDir = createProject()
    const message = JSON.stringify({
      password: "rail-oversized-password-marker",
      padding: "x".repeat(20_000),
    })

    writeRailComplianceEvidence(projectDir, {
      hook: "tool.execute.after",
      sessionID: "bounded-session",
      callID: "bounded-call",
      userPrompt: "safe prompt",
      primaryIntent: "debug",
      secondaryIntents: [],
      railMarker: "[Persona Harness Debug Workflow]",
      finding: "WARN",
      confidence: "HIGH",
      code: "debug-rail-edit-without-reproduction",
      message,
      observedAction: "safe action",
      expectedAction: "safe expected action",
    })

    const files = evidenceFiles(projectDir)
    expect(files).toHaveLength(1)
    const payload = JSON.parse(readFileSync(files[0] ?? "", "utf8")) as Record<string, unknown>
    expect(payload.message).toBe("[REDACTED_JSON]")
    expect(JSON.stringify(payload)).not.toContain("rail-oversized-password-marker")
  })
})
