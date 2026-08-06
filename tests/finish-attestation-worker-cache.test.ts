import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  clearFinishAttestationWorkerCache,
  runFinishAttestationWorker,
} from "../src/cli/workflow-finish-attestation-worker.js"

const tempProjects: string[] = []

afterEach(() => {
  clearFinishAttestationWorkerCache()
  while (tempProjects.length > 0) {
    const projectDir = tempProjects.pop()
    if (projectDir !== undefined) {
      rmSync(projectDir, { recursive: true, force: true })
    }
  }
})

function projectWithBundle(contents: string): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-worker-cache-test-"))
  tempProjects.push(projectDir)
  const bundleDir = join(projectDir, ".persona", "evidence", "finish-attestation")
  mkdirSync(bundleDir, { recursive: true })
  writeFileSync(join(bundleDir, "bundle.json"), contents)
  return projectDir
}

describe("finish attestation worker cache", () => {
  it("returns the same verdict for the same bundle digest without re-running", () => {
    const projectDir = projectWithBundle('{"not":"a real bundle"}\n')

    const first = runFinishAttestationWorker(projectDir, "sha256:aaa")
    const second = runFinishAttestationWorker(projectDir, "sha256:aaa")

    // Same object identity proves the second call did not spawn again.
    expect(second).toBe(first)
  })

  it("verifies again when the digest differs", () => {
    const projectDir = projectWithBundle('{"not":"a real bundle"}\n')

    const first = runFinishAttestationWorker(projectDir, "sha256:aaa")
    const second = runFinishAttestationWorker(projectDir, "sha256:bbb")

    // A replaced bundle is a different key, so it must never reuse the verdict.
    expect(second).not.toBe(first)
    expect(second).toEqual(first)
  })

  it("does not cache when no digest is supplied", () => {
    const projectDir = projectWithBundle('{"not":"a real bundle"}\n')

    const first = runFinishAttestationWorker(projectDir)
    const second = runFinishAttestationWorker(projectDir)

    expect(second).not.toBe(first)
  })

  it("forgets cached verdicts when cleared", () => {
    const projectDir = projectWithBundle('{"not":"a real bundle"}\n')

    const first = runFinishAttestationWorker(projectDir, "sha256:aaa")
    clearFinishAttestationWorkerCache()
    const second = runFinishAttestationWorker(projectDir, "sha256:aaa")

    expect(second).not.toBe(first)
  })

  it("bounds how many verdicts it retains", () => {
    const projectDir = projectWithBundle('{"not":"a real bundle"}\n')

    const first = runFinishAttestationWorker(projectDir, "sha256:evicted")
    for (let index = 0; index < 8; index += 1) {
      runFinishAttestationWorker(projectDir, `sha256:filler-${index}`)
    }
    const afterEviction = runFinishAttestationWorker(projectDir, "sha256:evicted")

    expect(afterEviction).not.toBe(first)
  })
})
