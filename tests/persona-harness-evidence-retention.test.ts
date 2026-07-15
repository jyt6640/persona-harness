import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

const projects: string[] = []

afterEach(() => {
  for (const projectDir of projects.splice(0)) {
    rmSync(projectDir, { force: true, recursive: true })
  }
})

function createProject(config?: { readonly evidenceDir?: string }): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-evidence-retention-"))
  projects.push(projectDir)
  if (config !== undefined) {
    mkdirSync(join(projectDir, ".persona"), { recursive: true })
    writeFileSync(
      join(projectDir, ".persona", "harness.jsonc"),
      `${JSON.stringify(config, null, 2)}\n`,
    )
  }
  return projectDir
}

function writeEvidence(projectDir: string, relativePath: string, content = "{}\n"): string {
  const path = join(projectDir, ".persona", "evidence", relativePath)
  mkdirSync(join(path, ".."), { recursive: true })
  writeFileSync(path, content)
  return path
}

function treeSnapshot(projectDir: string): readonly string[] {
  const personaDir = join(projectDir, ".persona")
  if (!existsSync(personaDir)) {
    return []
  }
  return readdirSync(personaDir, { recursive: true }).map(String).sort()
}

describe("ph evidence retain", () => {
  it("defaults to a zero-write dry-run and reports bounded candidates", () => {
    const projectDir = createProject()
    writeEvidence(projectDir, "phase0/old-a.json", "a\n")
    writeEvidence(projectDir, "phase0/old-b.json", "b\n")
    writeEvidence(projectDir, "phase0/old-c.json", "c\n")
    writeEvidence(projectDir, "verification-receipts/receipt.json", "authority\n")
    writeEvidence(projectDir, "unknown/custom.json", "unknown\n")
    const before = treeSnapshot(projectDir)
    const beforeBytes = readFileSync(join(projectDir, ".persona", "evidence", "phase0", "old-a.json"), "utf8")

    const result = runPersonaCli(["evidence", "retain", "--json"], {
      cwd: projectDir,
      env: {
        PH_EVIDENCE_SUMMARY_WARN_FILE_COUNT: "1",
        PH_EVIDENCE_SUMMARY_WARN_TOTAL_BYTES: "50",
      },
      invocationName: "ph",
    })

    expect(result.status).toBe(0)
    const report = JSON.parse(result.stdout) as {
      readonly mode: string
      readonly candidates: readonly { readonly relativePath: string }[]
      readonly writes: number
    }
    expect(report.mode).toBe("dry-run")
    expect(report.candidates.length).toBeGreaterThan(0)
    expect(report.writes).toBe(0)
    expect(treeSnapshot(projectDir)).toEqual(before)
    expect(readFileSync(join(projectDir, ".persona", "evidence", "phase0", "old-a.json"), "utf8")).toBe(beforeBytes)
    expect(result.stdout).not.toContain(projectDir)
  })

  it("applies only bounded diagnostic candidates and is idempotent", () => {
    const projectDir = createProject()
    const oldA = writeEvidence(projectDir, "phase0/old-a.json", "a\n")
    const oldB = writeEvidence(projectDir, "phase0/old-b.json", "b\n")
    writeEvidence(projectDir, "phase0/old-c.json", "c\n")
    writeEvidence(projectDir, "verification-receipts/receipt.json", "authority\n")
    writeEvidence(projectDir, "unknown/custom.json", "unknown\n")

    const first = runPersonaCli(["evidence", "retain", "--apply", "--json"], {
      cwd: projectDir,
      env: {
        PH_EVIDENCE_SUMMARY_WARN_FILE_COUNT: "1",
        PH_EVIDENCE_SUMMARY_WARN_TOTAL_BYTES: "50",
      },
      invocationName: "ph",
    })
    const second = runPersonaCli(["evidence", "retain", "--apply", "--json"], {
      cwd: projectDir,
      env: {
        PH_EVIDENCE_SUMMARY_WARN_FILE_COUNT: "1",
        PH_EVIDENCE_SUMMARY_WARN_TOTAL_BYTES: "50",
      },
      invocationName: "ph",
    })

    expect(first.status).toBe(0)
    expect(second.status).toBe(0)
    expect(existsSync(oldA)).toBe(false)
    expect(existsSync(oldB)).toBe(false)
    expect(existsSync(join(projectDir, ".persona", "evidence", "phase0", "old-c.json"))).toBe(true)
    expect(readFileSync(join(projectDir, ".persona", "evidence", "verification-receipts", "receipt.json"), "utf8")).toBe("authority\n")
    expect(readFileSync(join(projectDir, ".persona", "evidence", "unknown", "custom.json"), "utf8")).toBe("unknown\n")
    const secondReport = JSON.parse(second.stdout) as { readonly deleted: number; readonly candidates: readonly unknown[] }
    expect(secondReport.deleted).toBe(0)
    expect(secondReport.candidates).toHaveLength(0)
  })

  it("uses the configured root and leaves the default root untouched", () => {
    const projectDir = createProject({ evidenceDir: ".persona/custom-evidence" })
    const customPath = join(projectDir, ".persona", "custom-evidence", "phase0", "old.json")
    mkdirSync(join(customPath, ".."), { recursive: true })
    writeFileSync(customPath, "custom\n")
    writeEvidence(projectDir, "phase0/default.json", "default\n")

    const result = runPersonaCli(["evidence", "retain", "--apply", "--json"], {
      cwd: projectDir,
      env: {
        PH_EVIDENCE_SUMMARY_WARN_FILE_COUNT: "1",
        PH_EVIDENCE_SUMMARY_WARN_TOTAL_BYTES: "1",
      },
      invocationName: "ph",
    })

    expect(result.status).toBe(0)
    expect(existsSync(customPath)).toBe(false)
    expect(readFileSync(join(projectDir, ".persona", "evidence", "phase0", "default.json"), "utf8")).toBe("default\n")
  })

  it("fails closed on symlinks without deleting the link or target", () => {
    if (process.platform === "win32") {
      return
    }
    const projectDir = createProject()
    const outside = mkdtempSync(join(tmpdir(), "persona-retention-outside-"))
    projects.push(outside)
    const outsideFile = join(outside, "keep.json")
    writeFileSync(outsideFile, "outside\n")
    const link = writeEvidence(projectDir, "phase0/link.json")
    rmSync(link)
    symlinkSync(outsideFile, link)

    const result = runPersonaCli(["evidence", "retain", "--apply", "--json"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(result.status).toBe(1)
    expect(result.stdout + result.stderr).toContain("walker.symlink_cycle")
    expect(lstatSync(link).isSymbolicLink()).toBe(true)
    expect(readFileSync(outsideFile, "utf8")).toBe("outside\n")
  })

  it("fails closed on an escaping configured root without creating or touching it", () => {
    const projectDir = createProject({ evidenceDir: "../outside" })
    const before = treeSnapshot(projectDir)

    const result = runPersonaCli(["evidence", "retain", "--apply", "--json"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(result.status).toBe(1)
    const report = JSON.parse(result.stdout) as {
      readonly diagnostics: readonly string[]
      readonly writes: number
    }
    expect(report.diagnostics).toContain("config.path_invalid")
    expect(report.writes).toBe(0)
    expect(treeSnapshot(projectDir)).toEqual(before)
    expect(existsSync(join(projectDir, "outside"))).toBe(false)
  })
})
