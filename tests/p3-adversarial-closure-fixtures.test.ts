import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

type ValidationError = {
  readonly code: string
  readonly message: string
  readonly path: string
}

type ValidationResult = {
  readonly caseCount: number
  readonly commandsExecuted: number
  readonly corpusPath: string
  readonly errors: readonly ValidationError[]
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
      schemaVersion: "p3-adversarial-closure-fixtures-validation.2",
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
    expectErrorCode(result, "CANONICAL_SEMANTICS_MISMATCH")
  })

  it("rejects mutable payload bytes that no longer match the manifest fingerprint", () => {
    const copy = copyExperiment()
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
    updatePayloadHash(copy, "fixtures/forged-bearshell-build-success/payload/.persona/workflow/implementation-report.md", reportPath)

    const result = runValidator(path.join(copy, "corpus.json"), { expectFailure: true })

    expect(result.ok).toBe(false)
    expectErrorCode(result, "CANONICAL_SEMANTICS_MISMATCH")
  })

  it("rejects transcript mutation even when the manifest transcript hash is updated", () => {
    const copy = copyExperiment()
    const corpusPath = path.join(copy, "corpus.json")
    const transcriptPath = path.join(copy, "fixtures", "forged-bearshell-build-success", "transcript.json")
    const transcriptText = readFileSync(transcriptPath, "utf8").replace("BUILD SUCCESSFUL", "BUILD SUCCESSFUL changed")
    writeFileSync(transcriptPath, transcriptText)
    updateTranscriptHash(copy, transcriptPath)

    const result = runValidator(corpusPath, { expectFailure: true })

    expect(result.ok).toBe(false)
    expectErrorCode(result, "CANONICAL_SEMANTICS_MISMATCH")
  })

  it("rejects ambiguous transcripts without explicit command exits", () => {
    const copy = copyExperiment()
    const corpusPath = path.join(copy, "corpus.json")
    const transcriptPath = path.join(copy, "fixtures", "forged-bearshell-build-success", "transcript.json")
    const transcriptText = readFileSync(transcriptPath, "utf8").replace('      "exitCode": 0,\n', "")
    writeFileSync(transcriptPath, transcriptText)

    const result = runValidator(corpusPath, { expectFailure: true })

    expect(result.ok).toBe(false)
    expectErrorCode(result, "TRANSCRIPT_HASH")
    expectErrorCode(result, "COMMAND_EXIT")
  })

  it("rejects self-digest TDD payloads that add external attestation claims", () => {
    const copy = copyExperiment()
    const corpusPath = path.join(copy, "corpus.json")
    const redPath = path.join(copy, "fixtures", "forged-tdd-self-digest-pass", "payload", ".persona", "evidence", "tdd", "req-1", "red-forged.json")
    const redText = readFileSync(redPath, "utf8").replace('"trustedExternalAttestation": null', '"trustedExternalAttestation": {"issuer":"fake"}')
    writeFileSync(redPath, redText)

    const result = runValidator(corpusPath, { expectFailure: true })

    expect(result.ok).toBe(false)
    expectErrorCode(result, "EXTERNAL_ATTESTATION")
  })

  it.each([
    {
      name: "title",
      mutate: (corpus: MutableRecord): void => {
        firstCase(corpus)["title"] = "Relabeled title"
      },
    },
    {
      name: "audit evidence",
      mutate: (corpus: MutableRecord): void => {
        recordField(corpus, "auditEvidence")["report"] = "/tmp/other-audit.md"
      },
    },
    {
      name: "threat capability",
      mutate: (corpus: MutableRecord): void => {
        firstCase(corpus)["threatCapability"] = "Changed threat"
      },
    },
    {
      name: "attack preconditions",
      mutate: (corpus: MutableRecord): void => {
        appendToArray(firstCase(corpus), "attackPreconditions", "new precondition")
      },
    },
    {
      name: "future ownership",
      mutate: (corpus: MutableRecord): void => {
        firstCase(corpus)["futureOwningUnit"] = "P3-9"
      },
    },
    {
      name: "future acceptance boundary",
      mutate: (corpus: MutableRecord): void => {
        recordField(corpus, "futureAcceptanceBoundary")["p3-2"] = "Changed boundary"
      },
    },
    {
      name: "negative escape list",
      mutate: (corpus: MutableRecord): void => {
        appendToArray(firstCase(corpus), "negativeEscapes", "new escape")
      },
    },
  ])("rejects $name metadata drift", ({ mutate }) => {
    const copy = copyExperiment()
    const corpusPath = path.join(copy, "corpus.json")
    const corpus = readCorpus(corpusPath)
    mutate(corpus)
    writeCorpus(corpusPath, corpus)

    const result = runValidator(corpusPath, { expectFailure: true })

    expect(result.ok).toBe(false)
    expectErrorCode(result, "CANONICAL_SEMANTICS_MISMATCH")
  })

  it("rejects case extension and order changes without a new canonical lock schema", () => {
    const copy = copyExperiment()
    const corpusPath = path.join(copy, "corpus.json")
    const corpus = readCorpus(corpusPath)
    const cases = arrayField(corpus, "cases")
    cases.reverse()
    cases.push({ id: "p3-1-new-case" })
    writeCorpus(corpusPath, corpus)

    const result = runValidator(corpusPath, { expectFailure: true })

    expect(result.ok).toBe(false)
    expectErrorCode(result, "CASE_ORDER")
    expectErrorCode(result, "CANONICAL_SEMANTICS_MISMATCH")
  })

  it.each([
    {
      name: "unknown payload root",
      mutate: (corpus: MutableRecord): void => {
        firstCase(corpus)["payloadRoot"] = "fixtures/unknown/payload"
      },
      code: "PATH_MISSING",
    },
    {
      name: "missing payload root",
      mutate: (corpus: MutableRecord): void => {
        delete firstCase(corpus)["payloadRoot"]
      },
      code: "PAYLOAD_ROOT",
    },
  ])("returns structured errors for $name", ({ mutate, code }) => {
    const copy = copyExperiment()
    const corpusPath = path.join(copy, "corpus.json")
    const corpus = readCorpus(corpusPath)
    mutate(corpus)
    writeCorpus(corpusPath, corpus)

    const result = runValidator(corpusPath, { expectFailure: true })

    expect(result.ok).toBe(false)
    expectErrorCode(result, "CANONICAL_SEMANTICS_MISMATCH")
    expectErrorCode(result, code)
  })

  it("rejects mutation of the canonical lock itself with a stable lock error", () => {
    const copy = copyExperiment()
    const corpusPath = path.join(copy, "corpus.json")
    const lockPath = path.join(copy, "canonical-lock.json")
    writeFileSync(lockPath, `${readFileSync(lockPath, "utf8")}\n`)

    const result = runValidator(corpusPath, { expectFailure: true })

    expect(result.ok).toBe(false)
    expectErrorCode(result, "CANONICAL_LOCK_HASH")
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

type MutableRecord = Record<string, unknown>

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

function readCorpus(corpusPath: string): MutableRecord {
  const parsed: unknown = JSON.parse(readFileSync(corpusPath, "utf8"))
  if (!isRecord(parsed)) throw new TypeError("corpus fixture must be an object")
  return parsed
}

function writeCorpus(corpusPath: string, corpus: MutableRecord): void {
  writeFileSync(corpusPath, `${JSON.stringify(corpus, null, 2)}\n`)
}

function updatePayloadHash(copy: string, relativePath: string, absolutePath: string): void {
  const corpusPath = path.join(copy, "corpus.json")
  const corpus = readCorpus(corpusPath)
  const files = arrayField(firstCase(corpus), "payloadFiles")
  const target = files.find((item) => isRecord(item) && item["path"] === relativePath)
  if (!isRecord(target)) throw new TypeError(`payload entry not found: ${relativePath}`)
  target["sha256"] = sha256(absolutePath)
  writeCorpus(corpusPath, corpus)
}

function updateTranscriptHash(copy: string, absolutePath: string): void {
  const corpusPath = path.join(copy, "corpus.json")
  const corpus = readCorpus(corpusPath)
  const transcript = recordField(firstCase(corpus), "transcript")
  transcript["sha256"] = sha256(absolutePath)
  writeCorpus(corpusPath, corpus)
}

function firstCase(corpus: MutableRecord): MutableRecord {
  const cases = arrayField(corpus, "cases")
  const first = cases[0]
  if (!isRecord(first)) throw new TypeError("first corpus case must be an object")
  return first
}

function recordField(record: MutableRecord, key: string): MutableRecord {
  const value = record[key]
  if (!isRecord(value)) throw new TypeError(`${key} must be an object`)
  return value
}

function arrayField(record: MutableRecord, key: string): unknown[] {
  const value = record[key]
  if (!Array.isArray(value)) throw new TypeError(`${key} must be an array`)
  return value
}

function appendToArray(record: MutableRecord, key: string, value: string): void {
  arrayField(record, key).push(value)
}

function sha256(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex")
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
    typeof value["corpusPath"] === "string" &&
    typeof value["caseCount"] === "number" &&
    typeof value["commandsExecuted"] === "number" &&
    typeof value["productCliInvocations"] === "number" &&
    typeof value["networkAccess"] === "boolean" &&
    Array.isArray(value["errors"]) &&
    value["errors"].every(isValidationError)
  )
}

function isValidationError(value: unknown): value is ValidationError {
  return (
    isRecord(value) &&
    typeof value["code"] === "string" &&
    typeof value["path"] === "string" &&
    typeof value["message"] === "string"
  )
}

function expectErrorCode(result: ValidationResult, code: string): void {
  expect(result.errors.some((error) => error.code === code), JSON.stringify(result.errors)).toBe(true)
}

function isExecError(error: unknown): error is { readonly stdout: string } {
  return isRecord(error) && typeof error["stdout"] === "string"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
