import { createHash } from "node:crypto"
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { spawnSync } from "node:child_process"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

type RunResult = {
  readonly status: number
  readonly stderr: string
  readonly stdout: string
}

const experimentRoot = resolve("experiments/report-only-test-integrity-detector")
const validatorPath = join(experimentRoot, "validate.mjs")
const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots) rmSync(root, { force: true, recursive: true })
  temporaryRoots.length = 0
})

describe("report-only test-integrity detector evidence", () => {
  it("accepts pristine corpus and proves no execution or project access", () => {
    const result = run(["--validate"], experimentRoot)
    const output = json(result)

    expect(result.status).toBe(0)
    expect(output).toMatchObject({
      commandsExecuted: 0,
      networkAccess: false,
      productCliInvocations: 0,
      realProjectAccess: false,
      reportOnly: true,
      ok: true,
    })
    expect(array(output["errors"])).toHaveLength(0)
  })

  it("rejects canonical lock mutation with a structured error", () => {
    const root = copyExperiment()
    const lockPath = join(root, "canonical-lock.json")
    writeFileSync(lockPath, `${readFileSync(lockPath, "utf8")}\n`)

    expectDiagnostic(run(["--validate"], root), "CANONICAL_LOCK_HASH")
  })

  it("returns a structured error for malformed corpus JSON", () => {
    const root = copyExperiment()
    writeFileSync(join(root, "corpus.json"), "{ broken")

    expectDiagnostic(run(["--validate"], root), "CORPUS_JSON")
  })

  it("rejects payload mutation even when the corpus payload hash is updated", () => {
    const root = copyExperiment()
    const fixturePath = join(root, "fixtures", "junit-cases.java")
    writeFileSync(fixturePath, `${readFileSync(fixturePath, "utf8")}// coordinated payload mutation\n`)
    updateCorpus(root, (corpus) => {
      const files = array(corpus["payloadFiles"])
      const target = record(files.find((file) => record(file)["path"] === "fixtures/junit-cases.java"))
      target["sha256"] = sha256(readFileSync(fixturePath, "utf8"))
    })

    expectDiagnostic(run(["--validate"], root), "CANONICAL_SEMANTICS_MISMATCH")
  })

  it("rejects transcript mutation even when the transcript hash is updated", () => {
    const root = copyExperiment()
    const transcriptPath = join(root, "fixtures", "detector-transcript.json")
    const transcript = record(JSON.parse(readFileSync(transcriptPath, "utf8")))
    const commands = array(transcript["commands"])
    record(commands[0])["stdout"] = "mutated transcript\n"
    writeFileSync(transcriptPath, `${JSON.stringify(transcript, null, 2)}\n`)
    updateCorpus(root, (corpus) => {
      record(corpus["transcript"])["sha256"] = sha256(readFileSync(transcriptPath, "utf8"))
    })

    expectDiagnostic(run(["--validate"], root), "CANONICAL_SEMANTICS_MISMATCH")
  })

  it.each(["title", "auditEvidence", "attackPreconditions", "futureOwningUnit", "futureAcceptanceBoundary", "negativeEscapes"])(
    "rejects canonical metadata drift in %s",
    (field) => {
      const root = copyExperiment()
      updateCorpus(root, (corpus) => {
        const first = record(array(corpus["records"])[0])
        first[field] = field === "negativeEscapes" ? ["mutated"] : "mutated"
      })

      expectDiagnostic(run(["--validate"], root), "CANONICAL_SEMANTICS_MISMATCH")
    },
  )

  it("rejects record order and ID drift", () => {
    const root = copyExperiment()
    updateCorpus(root, (corpus) => {
      const records = array(corpus["records"])
      const first = records[0]
      records[0] = records[1]
      records[1] = first
    })
    expectDiagnostic(run(["--validate"], root), "CANONICAL_SEMANTICS_MISMATCH")

    const secondRoot = copyExperiment()
    updateCorpus(secondRoot, (corpus) => {
      record(array(corpus["records"])[0])["id"] = "renamed-case"
    })
    expectDiagnostic(run(["--validate"], secondRoot), "CANONICAL_SEMANTICS_MISMATCH")
  })

  it("rejects invalid, unknown, and symlink payload roots without following them", () => {
    const escaped = copyExperiment()
    updateCorpus(escaped, (corpus) => {
      corpus["payloadRoot"] = "../outside"
    })
    expectDiagnostic(run(["--validate"], escaped), "PAYLOAD_ROOT_INVALID")

    const unknown = copyExperiment()
    updateCorpus(unknown, (corpus) => {
      corpus["payloadRoot"] = "fixtures/unknown"
    })
    expectDiagnostic(run(["--validate"], unknown), "PAYLOAD_ROOT_INVALID")

    const linked = copyExperiment()
    symlinkSync(join(linked, "fixtures", "junit-cases.java"), join(linked, "fixtures", "linked.java"))
    updateCorpus(linked, (corpus) => {
      record(array(corpus["records"])[0])["fixture"] = "fixtures/linked.java"
      const file = record(array(corpus["payloadFiles"]).find((entry) => record(entry)["path"] === "fixtures/junit-cases.java"))
      file["path"] = "fixtures/linked.java"
    })
    expectDiagnostic(run(["--validate"], linked), "PATH_SYMLINK")
    expect(lstatSync(join(linked, "fixtures", "linked.java")).isSymbolicLink()).toBe(true)
  })

  it("rejects malformed, duplicate, and replayed candidate findings", () => {
    const root = copyExperiment()
    const candidatePath = join(root, "candidate.json")
    writeFileSync(candidatePath, "{ broken")
    expectDiagnostic(run(["--candidate", candidatePath], root), "CANDIDATE_JSON")

    const duplicateRoot = copyExperiment()
    updateCandidate(duplicateRoot, (candidate) => {
      const findings = array(candidate["findings"])
      findings.push(findings[0])
    })
    expectDiagnostic(run(["--candidate", join(duplicateRoot, "reference-candidate.json")], duplicateRoot), "CANDIDATE_DUPLICATE")

    const replayRoot = copyExperiment()
    updateCandidate(replayRoot, (candidate) => {
      const ids = array(candidate["evaluatedRecordIds"])
      ids[1] = ids[0]
    })
    expectDiagnostic(run(["--candidate", join(replayRoot, "reference-candidate.json")], replayRoot), "CANDIDATE_IDS")
  })

  it("reports a self-consistent local candidate as untrusted and never as finish authority", () => {
    const root = copyExperiment()
    const result = run(["--candidate", join(root, "reference-candidate.json")], root)
    const output = json(result)

    expect(result.status).toBe(0)
    expect(output).toMatchObject({
      authorityEligible: false,
      evidenceTrust: "untrusted",
      finishAuthority: "not-authorized",
      ok: true,
      reportOnly: true,
    })
    expect(output["decision"]).toBe("pass")
  })

  it("does not write and does not include product runtime access", () => {
    const root = copyExperiment()
    const before = snapshot(root)
    const source = readFileSync(validatorPath, "utf8")
    const result = run(["--validate"], root)

    expect(result.status).toBe(0)
    expect(snapshot(root)).toBe(before)
    expect(source).not.toContain("node:child_process")
    expect(source).not.toContain("node:net")
    expect(source).not.toContain("fetch(")
    expect(existsSync(join(root, "result.json"))).toBe(false)
  })
})

function copyExperiment(): string {
  const root = mkdtempSync(join(tmpdir(), "report-only-test-integrity-"))
  temporaryRoots.push(root)
  cpSync(experimentRoot, root, { recursive: true })
  return root
}

function updateCorpus(root: string, update: (corpus: Record<string, unknown>) => void): void {
  const path = join(root, "corpus.json")
  const corpus = record(JSON.parse(readFileSync(path, "utf8")))
  update(corpus)
  writeFileSync(path, `${JSON.stringify(corpus, null, 2)}\n`)
}

function updateCandidate(root: string, update: (candidate: Record<string, unknown>) => void): void {
  const path = join(root, "reference-candidate.json")
  const candidate = record(JSON.parse(readFileSync(path, "utf8")))
  update(candidate)
  writeFileSync(path, `${JSON.stringify(candidate, null, 2)}\n`)
}

function run(args: readonly string[], cwd: string): RunResult {
  const result = spawnSync(process.execPath, [validatorPathFor(cwd), ...args], { cwd, encoding: "utf8" })
  return {
    status: result.status ?? 1,
    stderr: result.stderr,
    stdout: result.stdout,
  }
}

function validatorPathFor(cwd: string): string {
  return cwd === experimentRoot ? validatorPath : join(cwd, "validate.mjs")
}

function expectDiagnostic(result: RunResult, code: string): void {
  const output = json(result)
  const diagnostics = array(output["errors"]).map((entry) => record(entry)["code"])
  expect(result.status).toBe(1)
  expect(diagnostics).toContain(code)
  expect(output["commandsExecuted"]).toBe(0)
  expect(output["productCliInvocations"]).toBe(0)
  expect(output["networkAccess"]).toBe(false)
  expect(output["realProjectAccess"]).toBe(false)
}

function json(result: RunResult): Record<string, unknown> {
  expect(result.stderr).toBe("")
  return record(JSON.parse(result.stdout))
}

function snapshot(root: string): string {
  const entries: string[] = []
  const visit = (directory: string): void => {
    for (const entry of readdir(directory)) {
      const path = join(directory, entry)
      const stat = lstatSync(path)
      entries.push(`${path}:${stat.mode}:${stat.size}:${stat.isSymbolicLink() ? "symlink" : "entry"}`)
      if (stat.isDirectory() && !stat.isSymbolicLink()) visit(path)
    }
  }
  visit(root)
  return entries.sort().join("\n")
}

function readdir(directory: string): readonly string[] {
  return readdirSync(directory)
}

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new TypeError("expected array")
  return value
}

function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new TypeError("expected record")
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
