import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"
import { inspectReadySigstoreTrust } from "./helpers/sigstore-trust-readiness.js"

const projects: string[] = []

function project(): string {
  const directory = mkdtempSync(join(tmpdir(), "persona-entry-steering-doctor-"))
  projects.push(directory)
  return directory
}

function doctor(projectDir: string) {
  return runPersonaCli(["doctor"], {
    cwd: projectDir,
    doctorSigstoreTrustInspector: inspectReadySigstoreTrust,
    env: {
      PH_DOCTOR_OPENCODE_VERSION: "1.0.0-test",
      PH_DOCTOR_REGISTRY_DIST_TAGS: "{}",
    },
  })
}

afterEach(() => {
  for (const directory of projects) {
    rmSync(directory, { force: true, recursive: true })
  }
})

describe("ph doctor entry steering status", () => {
  it("reports default-off status without creating files", () => {
    const result = doctor(project())

    expect(result.stdout).toContain("Entry steering: OFF")
    expect(result.stdout).toContain("Entry steering decisions: 0")
  })

  it("reports valid fired/not-fired counts and corrupt records read-only", () => {
    const projectDir = project()
    const evidenceDir = join(projectDir, ".persona", "evidence", "entry-steering")
    mkdirSync(evidenceDir, { recursive: true })
    writeFileSync(
      join(projectDir, ".persona", "harness.jsonc"),
      `${JSON.stringify({ features: { entrySteering: true } }, null, 2)}\n`,
    )
    writeFileSync(
      join(evidenceDir, "valid.json"),
      `${JSON.stringify({ decision: "detected", fired: true, rationale: { language: "en", mode: "explicit", verb: "implement", codeNoun: "api" }, sessionKey: "abc" })}\n`,
    )
    const corruptPath = join(evidenceDir, "corrupt.json")
    writeFileSync(corruptPath, "{ nope\n")
    const before = readFileSync(corruptPath, "utf8")

    const result = doctor(projectDir)

    expect(result.stdout).toContain("Entry steering: ON (default-off opt-in)")
    expect(result.stdout).toContain("Entry steering decisions: 1")
    expect(result.stdout).toContain("Entry steering fired: 1")
    expect(result.stdout).toContain("Entry steering invalid records: 1")
    expect(readFileSync(corruptPath, "utf8")).toBe(before)
  })
})
