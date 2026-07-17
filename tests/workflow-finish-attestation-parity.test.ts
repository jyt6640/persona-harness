import { readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"

const attestedFixtureVersion = vi.hoisted(() => ({
  current: "0.7.0-rc.3",
  expected: "0.7.0-rc.3",
}))

vi.mock("../src/cli/version.js", () => ({
  personaHarnessVersion: () => attestedFixtureVersion.current,
}))

import { runPersonaCli } from "../src/cli/index.js"
import { FINISH_ATTESTATION_BUNDLE_PATH, FINISH_ATTESTATION_CONSUMPTION_PATH } from "../src/cli/workflow-finish-attestation.js"
import { readWorkflowFinishAuthority } from "../src/cli/workflow-finish-authority.js"
import {
  createFreshRealArtifactProject,
  FRESH_REAL_ATTESTATION_NOW,
  type RealArtifactProject,
} from "./finish-attestation-real-fixture.js"

type ClosurePayload = {
  readonly nextStep?: { readonly id?: string }
  readonly state: { readonly blockers: readonly { readonly id: string }[]; readonly finish: string }
}

const projects: RealArtifactProject[] = []

afterEach(() => {
  vi.useRealTimers()
  attestedFixtureVersion.current = attestedFixtureVersion.expected
  for (const project of projects.splice(0)) project.cleanup()
})

describe("public Finish and closure attestation parity", () => {
  it("keeps immediate closure terminally consistent after consuming a fresh signed artifact", () => {
    const project = track(createFreshRealArtifactProject(true))
    vi.useFakeTimers({ now: FRESH_REAL_ATTESTATION_NOW })

    const finish = runFinish(project.projectDir)
    const closure = runClosure(project.projectDir)

    expect(finish.status).toBe(0)
    expect(finish.stdout).toContain("Finish status: PASS")
    expect(closure.state).toMatchObject({ blockers: [], finish: "passed" })
    expect(closure.nextStep?.id).toBe("terminal")
  })

  it("blocks a second independent public Finish after the first consumption", () => {
    const project = track(createFreshRealArtifactProject(true))
    vi.useFakeTimers({ now: FRESH_REAL_ATTESTATION_NOW })

    const first = runFinish(project.projectDir)
    const second = runFinish(project.projectDir)

    expect(first.status).toBe(0)
    expect(second.status).toBe(1)
    expect(second.stdout).not.toContain("Finish status: PASS")
    expect(readWorkflowFinishAuthority(project.projectDir, {
      consumeExternalAttestation: true,
      now: FRESH_REAL_ATTESTATION_NOW,
    }).externalAttestation.state).toBe("replayed")
  })

  it("blocks closure after a successful Finish when the attestation expires", () => {
    const project = track(createFreshRealArtifactProject(true))
    vi.useFakeTimers({ now: FRESH_REAL_ATTESTATION_NOW })

    const finish = runFinish(project.projectDir)
    const expiredNow = new Date("2026-07-17T03:22:42.000Z")
    vi.setSystemTime(expiredNow)
    const closure = runClosure(project.projectDir)

    expect(finish.status).toBe(0)
    expect(closure.state.finish).toBe("blocked")
    expect(closure.state.blockers[0]).toMatchObject({ id: "trusted-authority-required" })
    expect(readWorkflowFinishAuthority(project.projectDir, {
      consumeExternalAttestation: false,
      now: expiredNow,
    }).externalAttestation.state).toBe("stale")
  })

  it.each([
    ["sourceHead", "84901174235f0a9c7bc08f0dbd5be6d94c02d500"],
    ["workspaceIdentityDigest", `sha256:${"e".repeat(64)}`],
    ["sessionId", "wrong-session"],
    ["finishId", "wrong-finish"],
  ] as const)("blocks closure when the terminal record %s binding is wrong", (field, value) => {
    const project = track(createFreshRealArtifactProject(true))
    vi.useFakeTimers({ now: FRESH_REAL_ATTESTATION_NOW })
    const finish = runFinish(project.projectDir)
    const terminalPath = join(project.projectDir, FINISH_ATTESTATION_CONSUMPTION_PATH)
    const terminalRecord: Record<string, unknown> = JSON.parse(readFileSync(terminalPath, "utf8"))
    terminalRecord[field] = value
    writeFileSync(terminalPath, `${JSON.stringify(terminalRecord)}\n`)

    const closure = runClosure(project.projectDir)

    expect(finish.status).toBe(0)
    expect(closure.state.finish).toBe("blocked")
    expect(readWorkflowFinishAuthority(project.projectDir, {
      consumeExternalAttestation: false,
      now: FRESH_REAL_ATTESTATION_NOW,
    }).externalAttestation.state).toBe("binding-mismatch")
  })

  it("does not trust a terminal record without the original signed bundle", () => {
    const project = track(createFreshRealArtifactProject(true))
    vi.useFakeTimers({ now: FRESH_REAL_ATTESTATION_NOW })
    const finish = runFinish(project.projectDir)
    rmSync(join(project.projectDir, FINISH_ATTESTATION_BUNDLE_PATH))

    const closure = runClosure(project.projectDir)

    expect(finish.status).toBe(0)
    expect(closure.state.finish).toBe("blocked")
    expect(readWorkflowFinishAuthority(project.projectDir, {
      consumeExternalAttestation: false,
      now: FRESH_REAL_ATTESTATION_NOW,
    }).externalAttestation.state).toBe("missing")
  })
})

function runFinish(projectDir: string) {
  return runPersonaCli(["workflow", "finish", "implement"], {
    cwd: projectDir,
    env: {},
    invocationName: "ph",
  })
}

function runClosure(projectDir: string): ClosurePayload {
  const result = runPersonaCli(["workflow", "closure", "next", "--json"], {
    cwd: projectDir,
    env: {},
    invocationName: "ph",
  })
  expect(result.status).toBe(0)
  return JSON.parse(result.stdout) as ClosurePayload
}

function track(project: RealArtifactProject): RealArtifactProject {
  projects.push(project)
  return project
}
