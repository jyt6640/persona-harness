import { execFileSync } from "node:child_process"
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

type ValidationResult = {
  readonly caseCount: number
  readonly commandsExecuted: number
  readonly errors: readonly string[]
  readonly networkAccess: boolean
  readonly ok: boolean
  readonly productCliInvocations: number
  readonly schemaVersion: string
}

const experimentDir = path.join(process.cwd(), "experiments", "p3-adversarial-closure-fixtures")
const validatorPath = path.join(experimentDir, "validate.mjs")
const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true })
  }
  tempDirs.length = 0
})

describe("P3 adversarial closure fixture corpus", () => {
  it("validates the locked source-only P0 attack fixtures without executing product commands", () => {
    const result = runValidator()

    expect(result).toEqual({
      ok: true,
      schemaVersion: "p3-adversarial-closure-fixtures-validation.1",
      corpusPath: path.join(experimentDir, "corpus.json"),
      caseCount: 2,
      commandsExecuted: 0,
      productCliInvocations: 0,
      networkAccess: false,
      errors: [],
    })
  })

  it("rejects relabeling or reordering existing cases", () => {
    const copy = copyExperiment()
    const corpusPath = path.join(copy, "corpus.json")
    const corpusText = readFileSync(corpusPath, "utf8").replace(
      "p3-1-forged-bearshell-build-success",
      "p3-1-renamed-bearshell-build-success",
    )
    writeFileSync(corpusPath, corpusText)

    const result = runValidator(corpusPath, { expectFailure: true })

    expect(result.ok).toBe(false)
    expect(result.errors).toContain("case id order: expected \"[\\\"p3-1-forged-bearshell-build-success\\\",\\\"p3-1-forged-tdd-self-digest-pass\\\"]\", got \"[\\\"p3-1-renamed-bearshell-build-success\\\",\\\"p3-1-forged-tdd-self-digest-pass\\\"]\"")
  })

  it("rejects mutable payload bytes that no longer match the manifest fingerprint", () => {
    const copy = copyExperiment()
    const corpusPath = path.join(copy, "corpus.json")
    const reportPath = path.join(
      copy,
      "fixtures",
      "forged-bearshell-build-success",
      "payload",
      ".persona",
      "workflow",
      "implementation-report.md",
    )
    writeFileSync(reportPath, `${readFileSync(reportPath, "utf8")}\nmutated\n`)

    const result = runValidator(corpusPath, { expectFailure: true })

    expect(result.ok).toBe(false)
    expect(result.errors.some((error) => error.includes("implementation-report.md.sha256"))).toBe(true)
  })

  it("rejects ambiguous transcripts without explicit command exits", () => {
    const copy = copyExperiment()
    const corpusPath = path.join(copy, "corpus.json")
    const transcriptPath = path.join(copy, "fixtures", "forged-bearshell-build-success", "transcript.json")
    const transcriptText = readFileSync(transcriptPath, "utf8").replace('      "exitCode": 0,\n', "")
    writeFileSync(transcriptPath, transcriptText)

    const result = runValidator(corpusPath, { expectFailure: true })

    expect(result.ok).toBe(false)
    expect(result.errors.some((error) => error.includes("transcript.sha256"))).toBe(true)
    expect(result.errors.some((error) => error.includes("command exitCode is required"))).toBe(true)
  })

  it("rejects self-digest TDD payloads that add external attestation claims", () => {
    const copy = copyExperiment()
    const corpusPath = path.join(copy, "corpus.json")
    const redPath = path.join(copy, "fixtures", "forged-tdd-self-digest-pass", "payload", ".persona", "evidence", "tdd", "req-1", "red-forged.json")
    const redText = readFileSync(redPath, "utf8").replace('"trustedExternalAttestation": null', '"trustedExternalAttestation": {"issuer":"fake"}')
    writeFileSync(redPath, redText)

    const result = runValidator(corpusPath, { expectFailure: true })

    expect(result.ok).toBe(false)
    expect(result.errors.some((error) => error.includes("trustedExternalAttestation"))).toBe(true)
  })

  it("keeps baseline reproduction non-default and historical", () => {
    const protocol = readFileSync(path.join(experimentDir, "baseline-reproduction-protocol.md"), "utf8")

    expect(protocol).toContain("non-default protocol")
    expect(protocol).toContain("not an accepted product test result")
    expect(protocol).toContain("Do not use attendance, bus/BE, core, or any user project.")
    expect(protocol).toContain("not encode a vulnerable `workflow finish implement` PASS")
    expect(protocol).toContain("green product\nassertion")
  })
})

function runValidator(corpusPath?: string, options: { readonly expectFailure?: boolean } = {}): ValidationResult {
  try {
    const output = execFileSync(process.execPath, [validatorPath, ...(corpusPath === undefined ? [] : [corpusPath])], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
    return parseValidationResult(output)
  } catch (error) {
    if (!options.expectFailure || !isExecError(error)) throw error
    return parseValidationResult(error.stdout)
  }
}

function copyExperiment(): string {
  const copyRoot = mkdtempSync(path.join(tmpdir(), "p3-adversarial-fixtures-"))
  tempDirs.push(copyRoot)
  const target = path.join(copyRoot, "p3-adversarial-closure-fixtures")
  cpSync(experimentDir, target, { recursive: true })
  return target
}

function parseValidationResult(text: string): ValidationResult {
  const parsed: unknown = JSON.parse(text)
  if (!isValidationResult(parsed)) {
    throw new TypeError("validator returned an unexpected result")
  }
  return parsed
}

function isValidationResult(value: unknown): value is ValidationResult {
  if (!isRecord(value)) return false
  return (
    typeof value["ok"] === "boolean" &&
    typeof value["schemaVersion"] === "string" &&
    typeof value["caseCount"] === "number" &&
    typeof value["commandsExecuted"] === "number" &&
    typeof value["productCliInvocations"] === "number" &&
    typeof value["networkAccess"] === "boolean" &&
    Array.isArray(value["errors"]) &&
    value["errors"].every((item: unknown) => typeof item === "string")
  )
}

function isExecError(error: unknown): error is { readonly stdout: string } {
  return isRecord(error) && typeof error["stdout"] === "string"
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
