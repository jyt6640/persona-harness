import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { join } from "node:path"
import { tmpdir } from "node:os"

import { describe, expect, it } from "vitest"

describe("CI and release workflow policy surface", () => {
  it("keeps GitHub release creation behind an explicit manual GA-approved gate", () => {
    const workflow = readFileSync(join(process.cwd(), ".github", "workflows", "release.yml"), "utf8")

    expect(workflow).toContain("workflow_dispatch:")
    expect(workflow).toContain("approval_scope:")
    expect(workflow).toContain("          - ga-approved")
    expect(workflow).toContain("tag:")
    expect(workflow).toContain("inputs.approval_scope == 'ga-approved'")
    expect(workflow).not.toContain("  push:")
    expect(workflow).not.toContain("tags:")
  })

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
      copyContextDiagnosticAction(fixtureDir)
      copyFileSync(
        join(process.cwd(), "scripts", "check-release-workflows.mjs"),
        join(fixtureDir, "scripts", "check-release-workflows.mjs"),
      )

      for (const workflowName of ["ci.yml", "publish.yml", "release.yml", "canonical-clean-ci-attestation-builder.yml", "persona-harness-project-finish.yml", "persona-harness-project-finish-context-diagnostic.yml", "staged-package-artifact-attestation.yml", "staged-producer-context-diagnostic.yml", "production-integrity-audit.yml"]) {
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

  it("rejects a publish workflow that omits the fixed staging approval surface", () => {
    const fixtureDir = mkdtempSync(join(tmpdir(), "release-workflow-staging-policy-test-"))
    try {
      mkdirSync(join(fixtureDir, "scripts"), { recursive: true })
      mkdirSync(join(fixtureDir, ".github", "workflows"), { recursive: true })
      copyContextDiagnosticAction(fixtureDir)
      copyFileSync(
        join(process.cwd(), "scripts", "check-release-workflows.mjs"),
        join(fixtureDir, "scripts", "check-release-workflows.mjs"),
      )

      for (const workflowName of ["ci.yml", "publish.yml", "release.yml", "canonical-clean-ci-attestation-builder.yml", "persona-harness-project-finish.yml", "persona-harness-project-finish-context-diagnostic.yml", "staged-package-artifact-attestation.yml", "staged-producer-context-diagnostic.yml", "production-integrity-audit.yml"]) {
        const sourcePath = join(process.cwd(), ".github", "workflows", workflowName)
        const source = readFileSync(sourcePath, "utf8")
        const unsafeSource = workflowName === "publish.yml"
          ? source
            .replace("          - staging\n", "")
            .replace('--approval-scope "$APPROVAL_SCOPE"', '--approval-scope ""')
          : source
        writeFileSync(join(fixtureDir, ".github", "workflows", workflowName), unsafeSource)
      }

      const result = spawnSync(process.execPath, ["scripts/check-release-workflows.mjs"], {
        cwd: fixtureDir,
        encoding: "utf8",
      })

      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain("publish staging approval")
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true })
    }
  })

  it("rejects a publish workflow that creates or moves a Git tag", () => {
    const fixtureDir = mkdtempSync(join(tmpdir(), "release-workflow-tag-movement-test-"))
    try {
      mkdirSync(join(fixtureDir, "scripts"), { recursive: true })
      mkdirSync(join(fixtureDir, ".github", "workflows"), { recursive: true })
      copyContextDiagnosticAction(fixtureDir)
      copyFileSync(
        join(process.cwd(), "scripts", "check-release-workflows.mjs"),
        join(fixtureDir, "scripts", "check-release-workflows.mjs"),
      )

      for (const workflowName of ["ci.yml", "publish.yml", "release.yml", "canonical-clean-ci-attestation-builder.yml", "persona-harness-project-finish.yml", "persona-harness-project-finish-context-diagnostic.yml", "staged-package-artifact-attestation.yml", "staged-producer-context-diagnostic.yml", "production-integrity-audit.yml"]) {
        const sourcePath = join(process.cwd(), ".github", "workflows", workflowName)
        const source = readFileSync(sourcePath, "utf8")
        const unsafeSource = workflowName === "publish.yml"
          ? `${source}\n      - name: Unsafe tag movement\n        run: git tag v0.7.0-rc.4\n`
          : source
        writeFileSync(join(fixtureDir, ".github", "workflows", workflowName), unsafeSource)
      }

      const result = spawnSync(process.execPath, ["scripts/check-release-workflows.mjs"], {
        cwd: fixtureDir,
        encoding: "utf8",
      })

      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain("publish no automatic tag movement")
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true })
    }
  })

  it("rejects a native staged producer diagnostic job that gains signing permission", () => {
    const fixtureDir = mkdtempSync(join(tmpdir(), "release-workflow-native-diagnostic-permission-test-"))
    try {
      mkdirSync(join(fixtureDir, "scripts"), { recursive: true })
      mkdirSync(join(fixtureDir, ".github", "workflows"), { recursive: true })
      copyContextDiagnosticAction(fixtureDir)
      copyFileSync(
        join(process.cwd(), "scripts", "check-release-workflows.mjs"),
        join(fixtureDir, "scripts", "check-release-workflows.mjs"),
      )

      for (const workflowName of ["ci.yml", "publish.yml", "release.yml", "canonical-clean-ci-attestation-builder.yml", "persona-harness-project-finish.yml", "persona-harness-project-finish-context-diagnostic.yml", "staged-package-artifact-attestation.yml", "staged-producer-context-diagnostic.yml", "production-integrity-audit.yml"]) {
        const sourcePath = join(process.cwd(), ".github", "workflows", workflowName)
        const source = readFileSync(sourcePath, "utf8")
        const unsafeSource = workflowName === "staged-package-artifact-attestation.yml"
          ? source.replace(
            "    permissions:\n      contents: read\n    runs-on: ubuntu-latest",
            "    permissions:\n      contents: read\n      id-token: write\n    runs-on: ubuntu-latest",
          )
          : source
        writeFileSync(join(fixtureDir, ".github", "workflows", workflowName), unsafeSource)
      }

      const result = spawnSync(process.execPath, ["scripts/check-release-workflows.mjs"], {
        cwd: fixtureDir,
        encoding: "utf8",
      })

      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain("staged artifact attester diagnostic isolation")
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true })
    }
  })
})

function copyContextDiagnosticAction(fixtureDir: string): void {
  const actionDirectory = join(fixtureDir, ".github", "actions", "project-finish-context-diagnostic")
  mkdirSync(actionDirectory, { recursive: true })
  for (const fileName of ["action.yml", "index.mjs"]) {
    copyFileSync(
      join(process.cwd(), ".github", "actions", "project-finish-context-diagnostic", fileName),
      join(actionDirectory, fileName),
    )
  }
}
