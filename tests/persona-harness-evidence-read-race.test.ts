import fs, { existsSync, mkdirSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { syncBuiltinESMExports } from "node:module"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"

const projects: string[] = []

afterEach(() => {
  vi.restoreAllMocks()
  syncBuiltinESMExports()
  vi.resetModules()
  for (const projectDir of projects.splice(0)) {
    rmSync(projectDir, { force: true, recursive: true })
  }
})

describe("ph evidence read write boundary", () => {
  it("rejects a replaced evidence parent before an external record can be written", async () => {
    // Given: a canonical evidence root that changes precisely when the public command opens its record.
    const projectDir = createProject()
    const target = join("src", "main", "java", "example", "GreetingService.java")
    writeFileSync(join(projectDir, target), "class GreetingService {}\n")
    const evidenceRoot = join(projectDir, ".persona", "evidence")
    const preserved = join(projectDir, ".persona", "evidence-preserved")
    const outside = join(projectDir, "outside-evidence")
    mkdirSync(join(evidenceRoot, "phase0"), { recursive: true })
    mkdirSync(join(outside, "phase0"), { recursive: true })

    let swapped = false
    const originalOpen = fs.openSync
    const originalWrite = fs.writeFileSync
    const swap = () => {
      if (swapped) return
      swapped = true
      renameSync(evidenceRoot, preserved)
      symlinkSync(outside, evidenceRoot)
    }
    vi.spyOn(fs, "openSync").mockImplementation((path, ...rest) => {
      if (typeof path === "string" && path.startsWith(".workflow-read-")) swap()
      return originalOpen(path, ...rest)
    })
    vi.spyOn(fs, "writeFileSync").mockImplementation((path, data, options) => {
      if (typeof path === "string" && path.includes(`${join("phase0", ".workflow-read-")}`)) swap()
      return originalWrite(path, data, options)
    })
    syncBuiltinESMExports()
    vi.resetModules()
    const { runEvidenceCommand } = await import("../src/cli/evidence-summary.js")

    // When: the actual public evidence subcommand crosses its output boundary.
    const result = runEvidenceCommand(["read", target], { projectDir }, "ph")

    // Then: a containment race is bounded and creates no external record.
    expect(swapped).toBe(true)
    expect(result).toEqual({ status: 1, stdout: "", stderr: "Evidence read unavailable.\n" })
    expect(readdirSync(join(outside, "phase0"))).toEqual([])
    expect(existsSync(join(preserved, "phase0"))).toBe(true)
  })
})

function createProject(): string {
  const projectDir = join(tmpdir(), `persona-evidence-read-race-${crypto.randomUUID()}`)
  projects.push(projectDir)
  mkdirSync(join(projectDir, "src", "main", "java", "example"), { recursive: true })
  mkdirSync(join(projectDir, ".persona", "workflow"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "harness.jsonc"), "{}\n")
  return projectDir
}
