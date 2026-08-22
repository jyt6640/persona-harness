import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { dirname, join } from "node:path"
import { tmpdir } from "node:os"

import { describe, expect, it } from "vitest"

import {
  releaseWorkflowCheckerFixturePaths,
  releaseWorkflowCheckerWorkflowPaths,
} from "../scripts/release-workflow-checker-inputs.mjs"
import {
  CLEAN_PACKAGE_SOURCE_FIXTURE_PATHS,
  CLEAN_PACKAGE_SOURCE_FIXTURE_ROOT,
} from "./fixtures/clean-package-source-fixture-closure.mjs"

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

  it("keeps the release static fixture and clean Git verifier fixture deliberately root-separated", () => {
    const staticFixturePaths = releaseWorkflowCheckerFixturePaths()

    expect(staticFixturePaths).toContain("scripts/check-release-workflows.mjs")
    expect(staticFixturePaths).toContain("scripts/release-workflow-checker-inputs.mjs")
    expect(staticFixturePaths).toContain("scripts/consumer-authority-observer-gh-package-record.mjs")
    expect(staticFixturePaths).toContain("package.json")
    expect(staticFixturePaths).toContain("docs/current/release/consumer-authority-v0824-acceptance.json")
    expect(staticFixturePaths).not.toContain(CLEAN_PACKAGE_SOURCE_FIXTURE_ROOT)
    expect(CLEAN_PACKAGE_SOURCE_FIXTURE_PATHS).not.toContain("scripts/check-release-workflows.mjs")
  })

  it("rejects a Package consumer script that claims CI-owned observer proof", () => {
    const fixtureDir = mkdtempSync(join(tmpdir(), "release-workflow-package-responsibility-test-"))
    try {
      copyReleaseWorkflowCheckerFixture(fixtureDir)
      copyFileSync(join(process.cwd(), "package.json"), join(fixtureDir, "package.json"))
      const acceptancePath = "docs/current/release/consumer-authority-v0824-acceptance.json"
      const acceptanceTarget = join(fixtureDir, acceptancePath)
      mkdirSync(dirname(acceptanceTarget), { recursive: true })
      copyFileSync(join(process.cwd(), acceptancePath), acceptanceTarget)
      const packagePath = join(fixtureDir, "package.json")
      const packageRecord = JSON.parse(readFileSync(packagePath, "utf8")) as {
        scripts: Record<string, string>
      }
      packageRecord.scripts["test:installed-package-contract"] = "node scripts/test-installed-package-contract.mjs --observer-gh \"$PERSONA_HARNESS_OBSERVER_GH\""
      writeFileSync(packagePath, JSON.stringify(packageRecord, null, 2) + "\n")

      const result = spawnSync(process.execPath, ["scripts/check-release-workflows.mjs"], {
        cwd: fixtureDir,
        encoding: "utf8",
      })

      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain("Package observer responsibility")
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true })
    }
  })

  it("rejects floating action refs while accepting the exact immutable pins", () => {
    const fixtureDir = mkdtempSync(join(tmpdir(), "release-workflow-action-pin-test-"))
    try {
      copyReleaseWorkflowCheckerFixture(fixtureDir)
      for (const workflowPath of releaseWorkflowCheckerWorkflowPaths()) {
        const sourcePath = join(process.cwd(), workflowPath)
        const floatingText = readFileSync(sourcePath, "utf8")
          .replaceAll("actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5", "actions/checkout@v4")
          .replaceAll("actions/setup-java@b6effb05e454b25005698d916606bdc6ffcbf961", "actions/setup-java@v5")
          .replaceAll("actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020", "actions/setup-node@v4")
          .replaceAll("gradle/actions/setup-gradle@9c971963bec38e04b3d30dcc455b5382be2fdbfb", "gradle/actions/setup-gradle@v6")
          .replaceAll("actions/attest@ce27ba3b4a9a139d9a20a4a07d69fabb52f1e5bc", "actions/attest@v2")
          .replaceAll("actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02", "actions/upload-artifact@v4")
        writeFileSync(join(fixtureDir, workflowPath), floatingText)
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
      copyReleaseWorkflowCheckerFixture(fixtureDir)
      for (const workflowPath of releaseWorkflowCheckerWorkflowPaths()) {
        const sourcePath = join(process.cwd(), workflowPath)
        const source = readFileSync(sourcePath, "utf8")
        const unsafeSource = workflowPath === ".github/workflows/publish.yml"
          ? source
            .replace("          - staging\n", "")
            .replace('--approval-scope "$APPROVAL_SCOPE"', '--approval-scope ""')
          : source
        writeFileSync(join(fixtureDir, workflowPath), unsafeSource)
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
      copyReleaseWorkflowCheckerFixture(fixtureDir)
      for (const workflowPath of releaseWorkflowCheckerWorkflowPaths()) {
        const sourcePath = join(process.cwd(), workflowPath)
        const source = readFileSync(sourcePath, "utf8")
        const unsafeSource = workflowPath === ".github/workflows/publish.yml"
          ? `${source}\n      - name: Unsafe tag movement\n        run: git tag v0.7.0-rc.4\n`
          : source
        writeFileSync(join(fixtureDir, workflowPath), unsafeSource)
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
      copyReleaseWorkflowCheckerFixture(fixtureDir)
      for (const workflowPath of releaseWorkflowCheckerWorkflowPaths()) {
        const sourcePath = join(process.cwd(), workflowPath)
        const source = readFileSync(sourcePath, "utf8")
        const unsafeSource = workflowPath === ".github/workflows/staged-package-artifact-attestation.yml"
          ? source.replace(
            "    permissions:\n      contents: read\n    runs-on: ubuntu-latest",
            "    permissions:\n      contents: read\n      id-token: write\n    runs-on: ubuntu-latest",
          )
          : source
        writeFileSync(join(fixtureDir, workflowPath), unsafeSource)
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

function copyReleaseWorkflowCheckerFixture(fixtureDir: string): void {
  for (const relativePath of releaseWorkflowCheckerFixturePaths()) {
    const targetPath = join(fixtureDir, relativePath)
    mkdirSync(dirname(targetPath), { recursive: true })
    copyFileSync(join(process.cwd(), relativePath), targetPath)
  }
}
