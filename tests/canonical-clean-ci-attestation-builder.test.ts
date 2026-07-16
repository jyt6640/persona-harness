import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { createFailureDiagnostic, FIXED_COMMANDS } from "../scripts/build-clean-ci-attestation.mjs"

const root = process.cwd()
const workflowPath = join(root, ".github", "workflows", "canonical-clean-ci-attestation-builder.yml")
const builderPath = join(root, "scripts", "build-clean-ci-attestation.mjs")

describe("canonical clean CI attestation builder contract", () => {
  it("declares only the protected-main push trigger", () => {
    const workflow = readFileSync(workflowPath, "utf8")
    expect(workflow).toContain("  push:")
    expect(workflow).toContain("    branches:")
    expect(workflow).toContain("      - main")
    expect(workflow).not.toContain("workflow_call:")
    expect(workflow).not.toContain("workflow_dispatch:")
  })

  it("emits the versioned external finish predicate while keeping failure diagnostics non-authoritative", () => {
    const workflow = readFileSync(workflowPath, "utf8")
    const builder = readFileSync(builderPath, "utf8")

    expect(builder).toContain('authorityEligible: true')
    expect(builder).toContain('"finish-attestation.1"')
    expect(builder).toContain('"external-attested"')
    expect(builder).toContain("captureCleanSourceIdentity")
    expect(builder).toContain("GITHUB_EVENT_NAME")
    expect(builder).toContain("GITHUB_REPOSITORY_ID")
    expect(builder).toContain("GITHUB_WORKFLOW_REF")
    expect(builder).toContain("GITHUB_RUN_ATTEMPT")
    expect(builder).toContain("RUNNER_ENVIRONMENT")
    expect(builder).toContain("RUNNER_OS")
    expect(builder).toContain("authorityEligible: false")
    expect(workflow).not.toContain("workflow finish")
    expect(workflow).not.toContain("workflow-finish-authority")
  })

  it("uses fixed commands, explicit source bindings, and immutable action pins", () => {
    const workflow = readFileSync(workflowPath, "utf8")
    const builder = readFileSync(builderPath, "utf8")

    for (const required of [
      "GITHUB_REPOSITORY",
      "GITHUB_REF",
      "GITHUB_SHA",
      "GITHUB_WORKFLOW_SHA",
      "GITHUB_RUN_ID",
      "GITHUB_RUN_ATTEMPT",
      "--porcelain=v1",
      "argvDigest",
      "numTotalTests",
      "actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5",
      "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020",
      "actions/attest@ce27ba3b4a9a139d9a20a4a07d69fabb52f1e5bc",
      "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02",
    ]) {
      expect(`${workflow}\n${builder}`).toContain(required)
    }

    expect(workflow).toContain("contents: read")
    expect(workflow).toContain("id-token: write")
    expect(workflow).toContain("attestations: write")
    expect(workflow).toContain("artifact-metadata: write")
    expect(workflow).toContain("predicate-type: https://github.com/jyt6640/persona-harness/attestations/finish-attestation.1")
  })

  it("pins the hosted-CI Vitest timeout in the immutable test command", () => {
    const testCommand = FIXED_COMMANDS.find((command) => command.id === "tests")

    expect(testCommand?.args ?? []).toContain("--testTimeout=15000")
  })

  it("uploads only a bounded sanitized failure diagnostic after any builder outcome", () => {
    const workflow = readFileSync(workflowPath, "utf8")
    const builder = readFileSync(builderPath, "utf8")

    expect(workflow).toContain("if: always()")
    expect(workflow).toContain("canonical-clean-ci-attestation-builder-failure")
    expect(workflow).toContain("failure-diagnostic.json")
    expect(workflow).toContain("if-no-files-found: ignore")
    expect(builder).toContain("clean-ci-builder-failure.1")
    expect(builder).toContain("authorityEligible: false")
    expect(builder).toContain("rawOutputIncluded: false")
    expect(builder).toContain("failedTestFiles")
    expect(builder).toContain("report")
    expect(builder).not.toContain("rawFailureMessage")
  })

  it("summarizes a failed test report without persisting raw output", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "canonical-builder-failure-diagnostic-"))
    const reportPath = join(fixtureRoot, ".ci", "canonical-clean-ci-attestation-builder", "test-results.json")
    try {
      mkdirSync(join(fixtureRoot, ".ci", "canonical-clean-ci-attestation-builder"), { recursive: true })
      writeFileSync(
        reportPath,
        JSON.stringify({
          numFailedTests: 1,
          numPassedTests: 1101,
          numPendingTests: 0,
          numSkippedTests: 0,
          numTodoTests: 0,
          numTotalTests: 1102,
          secretMarker: "DO_NOT_PERSIST",
          testResults: [
            {
              assertionResults: [{ status: "failed", title: "SECRET_ASSERTION_TITLE" }],
              name: "/workspace/repo/tests/failing-builder.test.ts",
              status: "failed",
            },
            {
              assertionResults: [],
              name: "tests/fixtures/alpha.js",
              status: "failed",
            },
            {
              assertionResults: [],
              name: "tests/fixtures/beta.mjs",
              status: "failed",
            },
            {
              assertionResults: [],
              name: "tests/fixtures/delta.tsx",
              status: "failed",
            },
            {
              assertionResults: [],
              name: "tests/fixtures/gamma.mts",
              status: "failed",
            },
            {
              assertionResults: [],
              name: "tests/safe-relative.test.ts",
              status: "failed",
            },
            {
              assertionResults: [],
              name: "/outside/tests/escaped.test.ts",
              status: "failed",
            },
            {
              assertionResults: [],
              name: "../outside.test.ts",
              status: "failed",
            },
            {
              assertionResults: [],
              name: "tests/nested/../traversal.ts",
              status: "failed",
            },
            {
              assertionResults: [],
              name: "/workspace/repo/tests/../secrets.txt",
              status: "failed",
            },
            {
              assertionResults: [],
              name: "tests/disallowed.cjs",
              status: "failed",
            },
            {
              assertionResults: [],
              name: "tests/disallowed.cts",
              status: "failed",
            },
            {
              assertionResults: [],
              name: "tests/disallowed.jsx",
              status: "failed",
            },
            {
              assertionResults: [],
              name: "tests/disallowed.mtsx",
              status: "failed",
            },
            {
              assertionResults: [],
              name: "C:\\repo\\tests\\windows.test.ts",
              status: "failed",
            },
            null,
            { name: 42, status: "failed" },
          ],
        }),
      )

      const diagnostic = createFailureDiagnostic(
        { commandId: "tests", exitCode: 1, exitState: "exit-nonzero" },
        reportPath,
        "/workspace/repo",
      )
      const serialized = JSON.stringify(diagnostic)

      expect(diagnostic.authorityEligible).toBe(false)
      expect(diagnostic.rawOutputIncluded).toBe(false)
      expect(diagnostic.report.path).toBe(".ci/canonical-clean-ci-attestation-builder/test-results.json")
      expect(diagnostic.report.available).toBe(true)
      expect(diagnostic.report.digest).toMatch(/^sha256:/)
      expect(diagnostic.report.summary).toEqual({ failed: 1, passed: 1101, skipped: 0, total: 1102 })
      expect(diagnostic.report.failedTestFiles).toEqual([
        "tests/failing-builder.test.ts",
        "tests/fixtures/alpha.js",
        "tests/fixtures/beta.mjs",
        "tests/fixtures/delta.tsx",
        "tests/fixtures/gamma.mts",
        "tests/safe-relative.test.ts",
      ])
      expect(serialized).not.toContain("DO_NOT_PERSIST")
      expect(serialized).not.toContain("SECRET_ASSERTION_TITLE")
      expect(serialized).not.toContain("/workspace/repo")
      expect(serialized).not.toContain("/outside")
      expect(serialized).not.toContain("stdout")
      expect(serialized).not.toContain("stderr")
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true })
    }
  })
})
