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

  it("sanitizes bounded embedded JSON strings before persistence", () => {
    const projectDir = createProject()
    const password = "password-json-string-marker"
    const apiKey = "sk-live-embedded-json-string-marker"
    const source = JSON.stringify({
      nested: [
        { password },
        { authorization: "Bearer embedded-json-string-token" },
        { apiKey },
        { path: join(projectDir, "outside-marker.json") },
        { sentinel: "[REDACTED]-/external/embedded-marker.json" },
      ],
    })

    const sanitized = sanitizeEvidenceValue(source)
    expect(typeof sanitized).toBe("string")
    if (typeof sanitized !== "string") {
      throw new Error("expected sanitized JSON string")
    }
    expect(sanitized).not.toContain(password)
    expect(sanitized).not.toContain(apiKey)
    expect(sanitized).not.toContain(projectDir)
    expect(sanitized).not.toContain("/external/embedded-marker.json")
    expect(JSON.parse(sanitized)).toMatchObject({
      nested: [
        { password: "[REDACTED]" },
        { authorization: "[REDACTED]" },
        { apiKey: "[REDACTED]" },
        { path: "[REDACTED_PATH]" },
        { sentinel: "[REDACTED_PATH]" },
      ],
    })

    const oversized = JSON.stringify({ password: "oversized-secret", padding: "x".repeat(20_000) })
    const bounded = sanitizeEvidenceValue(oversized)
    expect(typeof bounded).toBe("string")
    expect(String(bounded)).not.toContain("oversized-secret")
    expect(String(bounded).length).toBeLessThanOrEqual(4_096)

    const malformed = '{"password":"malformed-secret", "path":"/malformed/path"'
    expect(String(sanitizeEvidenceValue(malformed))).not.toContain("malformed-secret")
    expect(String(sanitizeEvidenceValue(malformed))).not.toContain("/malformed/path")

    let deep: unknown = { password: "deep-secret" }
    for (let index = 0; index < 12; index += 1) {
      deep = { nested: deep }
    }
    const deepResult = String(sanitizeEvidenceValue(JSON.stringify(deep)))
    expect(deepResult).not.toContain("deep-secret")
    expect(deepResult.length).toBeLessThanOrEqual(4_096)
  })

  it("sanitizes JSON-encoded rail-compliance messages in the real writer", () => {
    const projectDir = createProject()
    const secret = "rail-compliance-password-marker"
    const message = JSON.stringify({
      nested: [{ password: secret }, { path: join(projectDir, "rail-marker.json") }],
    })

    writeRailComplianceEvidence(projectDir, {
      hook: "tool.execute.after",
      sessionID: "embedded-json-session",
      callID: "embedded-json-call",
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

    const payload = readOnlyEvidence(projectDir)
    expect(typeof payload.message).toBe("string")
    const persistedMessage = String(payload.message)
    expect(persistedMessage).not.toContain(secret)
    expect(persistedMessage).not.toContain(projectDir)
    expect(JSON.parse(persistedMessage)).toMatchObject({
      nested: [{ password: "[REDACTED]" }, { path: "[REDACTED_PATH]" }],
    })
  })
})
