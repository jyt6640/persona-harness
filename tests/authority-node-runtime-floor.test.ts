import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"

const finishWorker = vi.hoisted(() => ({
  runFinishAttestationWorker: vi.fn(),
}))
const projectWorker = vi.hoisted(() => ({
  runProjectFinishAttestationWorker: vi.fn(),
}))

vi.mock("../src/cli/workflow-finish-attestation-worker.js", () => finishWorker)
vi.mock("../src/cli/project-finish-attestation-worker.js", () => projectWorker)

import { inspectProjectFinishAttestation } from "../src/cli/project-finish-attestation-verifier.js"
import { runPersonaCli } from "../src/cli/index.js"
import { verifyExternalFinishAttestation } from "../src/cli/workflow-finish-attestation.js"

const projects: string[] = []

afterEach(() => {
  finishWorker.runFinishAttestationWorker.mockReset()
  projectWorker.runProjectFinishAttestationWorker.mockReset()
  for (const project of projects.splice(0)) {
    rmSync(project, { force: true, recursive: true })
  }
})

describe("authority verifier Node runtime floor", () => {
  it("blocks finish-attestation authority before bundle lookup or worker execution", () => {
    const projectDir = track(mkdtempSync(join(tmpdir(), "persona-runtime-floor-")))

    const result = withNodeVersion("20.16.9", () => verifyExternalFinishAttestation(projectDir))

    expect(result).toMatchObject({
      authorityEligible: false,
      decision: "blocked",
      state: "runtime-unsupported",
      diagnostics: [{ code: "runtime-unsupported", path: "runtime" }],
    })
    expect(finishWorker.runFinishAttestationWorker).not.toHaveBeenCalled()
    expect(JSON.stringify(result)).not.toContain("20.16.9")
  })

  it("blocks project-attestation authority before evidence lookup or worker execution", () => {
    const projectDir = track(mkdtempSync(join(tmpdir(), "persona-runtime-floor-")))

    const result = withNodeVersion("22.8.9", () => inspectProjectFinishAttestation(projectDir, {
      callerWorkflowPath: "project-finish.yml",
      repositoryId: 987654321,
      repositorySlug: "example/public-gradle-app",
      reusableWorkflowSha: "b".repeat(40),
    }))

    expect(result).toMatchObject({
      authorityEligible: false,
      decision: "blocked",
      state: "runtime-unsupported",
      diagnostics: [{ code: "runtime-unsupported", path: "runtime" }],
    })
    expect(projectWorker.runProjectFinishAttestationWorker).not.toHaveBeenCalled()
    expect(JSON.stringify(result)).not.toContain("22.8.9")
  })

  it("blocks a normal CLI authority command before command routing", () => {
    const result = withNodeVersion("20.16.9", () => runPersonaCli(["workflow", "finish", "implement"]))

    expect(result).toEqual({
      status: 1,
      stdout: "",
      stderr: "Unsupported Node runtime. Persona Harness requires Node.js ^20.17.0 || >=22.9.0; authority verification remains blocked.\n",
    })
    expect(result.stderr).not.toContain("20.16.9")
  })
})

function track(projectDir: string): string {
  projects.push(projectDir)
  return projectDir
}

function withNodeVersion<T>(version: string, operation: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(process.versions, "node")
  if (descriptor === undefined) throw new Error("Node runtime version descriptor is unavailable")
  Object.defineProperty(process.versions, "node", { configurable: true, value: version })
  try {
    return operation()
  } finally {
    Object.defineProperty(process.versions, "node", descriptor)
  }
}
