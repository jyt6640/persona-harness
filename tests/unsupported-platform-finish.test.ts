import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import process from "node:process"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"
import { nativeProjectReadPlatformSupported } from "../src/io/native-project-read.js"

const tempProjects: string[] = []

afterEach(() => {
  while (tempProjects.length > 0) {
    const projectDir = tempProjects.pop()
    if (projectDir !== undefined) {
      rmSync(projectDir, { recursive: true, force: true })
    }
  }
})

function initializedProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-unsupported-platform-"))
  tempProjects.push(projectDir)
  const workflowDir = join(projectDir, ".persona", "workflow")
  mkdirSync(workflowDir, { recursive: true })
  writeFileSync(join(projectDir, ".persona", "harness.jsonc"), `${JSON.stringify({}, null, 2)}\n`)
  writeFileSync(join(workflowDir, "plan.md"), "Status: accepted\n")
  writeFileSync(join(workflowDir, "implementation-report.md"), "Status: filled\n")
  writeFileSync(join(workflowDir, "review-report.md"), "Status: filled\n")
  return projectDir
}

describe("native project-read platform support", () => {
  it("reports the platforms the release actually builds", () => {
    const manifest = JSON.parse(
      readFileSync(join(process.cwd(), "native", "project-read", "manifest.json"), "utf8"),
    ) as { artifacts: readonly { platform: string; architecture: string }[] }

    const built = manifest.artifacts.some(
      (artifact) => artifact.platform === process.platform && artifact.architecture === process.arch,
    )

    expect(nativeProjectReadPlatformSupported()).toBe(built)
  })

  it("does not report win32 as supported", () => {
    const manifest = JSON.parse(
      readFileSync(join(process.cwd(), "native", "project-read", "manifest.json"), "utf8"),
    ) as { artifacts: readonly { platform: string }[] }

    // The whole regression was that `workflow finish` demanded an artifact that
    // is not built for Windows. If one is ever added, the fallback below stops
    // being reachable and this test should be revisited rather than deleted.
    expect(manifest.artifacts.some((artifact) => artifact.platform === "win32")).toBe(false)
  })
})

describe("workflow finish on a platform with no native artifact", () => {
  // One finish, three assertions. `workflow finish` spawns the attestation
  // worker, so running it once per assertion in the parallel project group
  // starved unrelated tests into timing out.
  it("reaches blocker evaluation, still blocks, and does not overstate itself", () => {
    const projectDir = initializedProject()

    const result = runPersonaCli(["workflow", "finish", "implement"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    // `source-read-runtime-unavailable` meant the finish died before judging
    // anything. On every platform the release supports or degrades for, the
    // blockers must be the ones the project actually has.
    expect(`${result.stdout}${result.stderr}`).not.toContain("source-read-runtime-unavailable")

    // Whichever path ran, the gate itself is unchanged.
    expect(result.status).not.toBe(0)

    // A supported platform must not take the degraded path, and must never
    // advertise a weaker verification than it performed.
    if (nativeProjectReadPlatformSupported()) {
      expect(result.stderr).not.toContain("Source-read snapshot unavailable")
    } else {
      expect(result.stderr).toContain("Source-read snapshot unavailable")
    }
  })
})

/**
 * The notice above is only reachable on a platform with no native artifact, and
 * no such platform is in the test matrix — which is why #235 was found by
 * running Windows rather than by any of these tests. Asserting on the source is
 * the only way to pin the wording from here.
 *
 * What it must never say again: that cooperative verification *ran*. The branch
 * that prints this passes no boundary down, and
 * `prepareCooperativeFinishContext` re-reserves one, so on such a platform the
 * finish is blocked before judging anything. Reporting that as a completed
 * unsnapshotted run overstates the gate in the one direction that matters.
 */
describe("the unsnapshotted finish notice", () => {
  const SOURCE = readFileSync(join(process.cwd(), "src", "cli", "workflow-command.ts"), "utf8")

  it("does not claim the verification ran", () => {
    expect(SOURCE).not.toContain("verification ran without the snapshot boundary")
  })

  it("tells the reader how to recognise a finish that never ran", () => {
    expect(SOURCE).toContain("cooperative verification did not run at all")
  })
})
