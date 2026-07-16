import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  FINISH_ATTESTATION_BUNDLE_PATH,
  FINISH_ATTESTATION_CONSUMPTION_PATH,
  consumeFinishAttestation,
  verifyExternalFinishAttestation,
} from "../src/cli/workflow-finish-attestation.js"
import { readWorkflowFinishAuthority } from "../src/cli/workflow-finish-authority.js"
import { readWorkflowClosurePayload } from "../src/cli/workflow-closure.js"
import {
  createRealArtifactProject,
  EXPIRED_ATTESTATION_NOW,
  REAL_ATTESTATION_NOW,
  type RealArtifactProject,
} from "./finish-attestation-real-fixture.js"

const projects: RealArtifactProject[] = []

afterEach(() => {
  for (const project of projects.splice(0)) project.cleanup()
})

describe("finish-attestation.1 product authority", () => {
  it("trusts the original signed artifact only after product-owned verification", () => {
    const project = track(createRealArtifactProject())
    const result = verifyExternalFinishAttestation(project.projectDir, REAL_ATTESTATION_NOW, { consume: false })

    expect(result).toMatchObject({
      authorityEligible: true,
      state: "trusted",
      receipt: {
        runId: "29511625395",
        source: { head: "84901174235f0a9c7bc08f0dbd5be6d94c02d500" },
      },
    })
  })

  it("never trusts copied local receipt or predicate JSON without the signed bundle", () => {
    const project = track(createRealArtifactProject())
    const bundlePath = join(project.projectDir, FINISH_ATTESTATION_BUNDLE_PATH)
    writeFileSync(bundlePath, readFileSync(bundlePath, "utf8").replaceAll("\"dsseEnvelope\"", "\"authorityEligible\""))

    const result = verifyExternalFinishAttestation(project.projectDir, REAL_ATTESTATION_NOW, { consume: false })

    expect(result.authorityEligible).toBe(false)
    expect(["malformed", "crypto-failed", "wrong-policy"]).toContain(result.state)
    expect(existsSync(join(project.projectDir, FINISH_ATTESTATION_CONSUMPTION_PATH))).toBe(false)
  })

  it.skipIf(process.platform === "win32")("does not trust modified tracked source when PATH git fakes clean status", () => {
    const project = track(createRealArtifactProject())
    writeFileSync(join(project.projectDir, "README.md"), `${readFileSync(join(project.projectDir, "README.md"), "utf8")}\nattacker-change\n`)
    const shimRoot = mkdtempSync(join(tmpdir(), "persona-finish-attestation-git-shim-"))
    const shim = join(shimRoot, "git")
    const shimTarget = join(shimRoot, "git-shim")
    writeFileSync(
      shimTarget,
      ["#!/bin/sh", 'if [ "$1" = "status" ]; then exit 0; fi', 'exec /usr/bin/git "$@"', ""].join("\n"),
      { mode: 0o755 },
    )
    symlinkSync(shimTarget, shim)
    try {
      const result = withEnvironment({ PATH: shimRoot }, () =>
        verifyExternalFinishAttestation(project.projectDir, REAL_ATTESTATION_NOW, { consume: false }),
      )

      expect(result).toMatchObject({ authorityEligible: false, state: "source-drift" })
    } finally {
      rmSync(shimRoot, { force: true, recursive: true })
    }
  })

  it("does not trust modified tracked source when Git environment redirects the repository", () => {
    const project = track(createRealArtifactProject())
    writeFileSync(join(project.projectDir, "README.md"), `${readFileSync(join(project.projectDir, "README.md"), "utf8")}\nattacker-change\n`)
    const injectedGitDir = mkdtempSync(join(tmpdir(), "persona-finish-attestation-git-dir-"))
    try {
      const result = withEnvironment(
        { GIT_DIR: injectedGitDir, GIT_WORK_TREE: project.projectDir, GIT_CONFIG_GLOBAL: join(injectedGitDir, "config") },
        () => verifyExternalFinishAttestation(project.projectDir, REAL_ATTESTATION_NOW, { consume: false }),
      )

      expect(result).toMatchObject({ authorityEligible: false, state: "source-drift" })
    } finally {
      rmSync(injectedGitDir, { force: true, recursive: true })
    }
  })

  it("rechecks expiry after an earlier trusted validation", () => {
    const project = track(createRealArtifactProject())
    const first = verifyExternalFinishAttestation(project.projectDir, REAL_ATTESTATION_NOW, { consume: false })
    const expired = verifyExternalFinishAttestation(project.projectDir, EXPIRED_ATTESTATION_NOW, { consume: false })

    expect(first.authorityEligible).toBe(true)
    expect(expired).toMatchObject({ authorityEligible: false, state: "stale" })
  })

  it("consumes the original artifact exactly once", () => {
    const project = track(createRealArtifactProject())
    const first = verifyExternalFinishAttestation(project.projectDir, REAL_ATTESTATION_NOW)
    const second = verifyExternalFinishAttestation(project.projectDir, REAL_ATTESTATION_NOW)

    expect(first.authorityEligible).toBe(true)
    expect(second).toMatchObject({ authorityEligible: false, state: "replayed" })
  })

  it("keeps finish and closure on the same trusted decision path", () => {
    const project = track(createRealArtifactProject(true))
    const authority = readWorkflowFinishAuthority(project.projectDir, { consumeExternalAttestation: false, now: REAL_ATTESTATION_NOW })
    const closure = readWorkflowClosurePayload("next", project.projectDir, {
      consumeExternalAttestation: false,
      now: REAL_ATTESTATION_NOW,
    })

    expect(authority.status).toBe("trusted")
    expect(closure.state.finish).toBe("passed")
    expect(closure.nextStep?.id).toBe("terminal")
  })

  it("keeps exclusive consumption fail-closed for duplicate callers", async () => {
    const project = track(createRealArtifactProject())
    const [first, second] = await Promise.all([
      Promise.resolve().then(() => consumeFinishAttestation(project.projectDir, "attestation-1", "nonce-1", "request-1")),
      Promise.resolve().then(() => consumeFinishAttestation(project.projectDir, "attestation-1", "nonce-1", "request-2")),
    ])

    expect(first).toEqual({ ok: true })
    expect(second).toMatchObject({ ok: false, code: "replayed-attestation" })
  })

  it("fails closed when the fixed attestation directory is a symlink", () => {
    const project = track(createRealArtifactProject())
    const attestationDirectory = join(project.projectDir, ".persona", "evidence", "finish-attestation")
    const target = join(project.projectDir, ".persona", "evidence", "external-target")
    rmSync(attestationDirectory, { force: true, recursive: true })
    rmSync(target, { force: true, recursive: true })
    symlinkSync(target, attestationDirectory, "dir")

    const result = verifyExternalFinishAttestation(project.projectDir, REAL_ATTESTATION_NOW, { consume: false })

    expect(result).toMatchObject({ authorityEligible: false, state: "missing" })
  })
})

function track(project: RealArtifactProject): RealArtifactProject {
  projects.push(project)
  return project
}

function withEnvironment<T>(updates: Readonly<Record<string, string>>, operation: () => T): T {
  const previous = new Map<string, string | undefined>()
  for (const [key, value] of Object.entries(updates)) {
    previous.set(key, process.env[key])
    process.env[key] = value
  }
  try {
    return operation()
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}
