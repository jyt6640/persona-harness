import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { join } from "node:path"
import { tmpdir } from "node:os"

import { describe, expect, it } from "vitest"

describe("CI and release workflow policy surface", () => {
  it("passes the repository workflow policy checker", () => {
    const result = spawnSync(process.execPath, ["scripts/check-release-workflows.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Release workflow policy: PASS")
  })

  it("rejects floating action refs while accepting the exact immutable pins", () => {
    const fixtureDir = mkdtempSync(join(tmpdir(), "release-workflow-action-pin-test-"))
    try {
      mkdirSync(join(fixtureDir, "scripts"), { recursive: true })
      mkdirSync(join(fixtureDir, ".github", "workflows"), { recursive: true })
      copyFileSync(
        join(process.cwd(), "scripts", "check-release-workflows.mjs"),
        join(fixtureDir, "scripts", "check-release-workflows.mjs"),
      )

      for (const workflowName of ["ci.yml", "publish.yml", "release.yml", "canonical-clean-ci-attestation-builder.yml"]) {
        const sourcePath = join(process.cwd(), ".github", "workflows", workflowName)
        const floatingText = readFileSync(sourcePath, "utf8")
          .replaceAll("actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5", "actions/checkout@v4")
          .replaceAll("actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020", "actions/setup-node@v4")
          .replaceAll("actions/attest@ce27ba3b4a9a139d9a20a4a07d69fabb52f1e5bc", "actions/attest@v2")
          .replaceAll("actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02", "actions/upload-artifact@v4")
        writeFileSync(join(fixtureDir, ".github", "workflows", workflowName), floatingText)
      }

      const result = spawnSync(process.execPath, ["scripts/check-release-workflows.mjs"], {
        cwd: fixtureDir,
        encoding: "utf8",
      })

      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain("immutable action pin")
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true })
    }
  })
})
