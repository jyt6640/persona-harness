import { mkdtempSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runDoctorCommand } from "../src/cli/doctor.js"

const projects: string[] = []

function project(): string {
  const directory = mkdtempSync(join(tmpdir(), "persona-platform-honesty-"))
  projects.push(directory)
  return directory
}

function doctor(projectDir: string, platform: NodeJS.Platform) {
  return runDoctorCommand([], {
    env: {
      PH_DOCTOR_OPENCODE_VERSION: "1.0.0-test",
      PH_DOCTOR_REGISTRY_DIST_TAGS: "{}",
    },
    platform,
    projectDir,
  })
}

afterEach(() => {
  for (const directory of projects) {
    rmSync(directory, { force: true, recursive: true })
  }
})

describe("ph doctor platform honesty", () => {
  it("warns honestly on win32 without writing or inventing remediation", () => {
    const projectDir = project()
    const before = readdirSync(projectDir)

    const result = doctor(projectDir, "win32")

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Runtime readiness: WARN")
    expect(result.stdout).toContain(
      "Unverified platform: Windows has not been measured or verified for Persona Harness.",
    )
    expect(result.stdout).toContain(
      "Lock identity device/inode behavior is not measured or verified on Windows; stale-lock and concurrency conclusions are limited.",
    )
    expect(result.stdout).not.toContain("Next action:")
    expect(result.stdout).not.toContain("Next command:")
    expect(readdirSync(projectDir)).toEqual(before)
  })

  it.each(["darwin", "linux"] as const)("leaves %s doctor output free of Windows findings", (platform) => {
    const result = doctor(project(), platform)

    expect(result.stdout).toContain("Runtime readiness: PASS")
    expect(result.stdout).not.toContain("Unverified platform:")
    expect(result.stdout).not.toContain("device/inode behavior")
  })
})
