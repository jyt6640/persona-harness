import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = process.cwd()
const workflowPath = join(root, ".github", "workflows", "canonical-clean-ci-attestation-builder.yml")
const builderPath = join(root, "scripts", "build-clean-ci-attestation.mjs")

describe("canonical clean CI attestation builder contract", () => {
  it("declares reusable, manual, and non-main staging triggers without caller inputs", () => {
    const workflow = readFileSync(workflowPath, "utf8")
    const callStart = workflow.indexOf("  workflow_call:")
    const dispatchStart = workflow.indexOf("  workflow_dispatch:")

    expect(callStart).toBeGreaterThanOrEqual(0)
    expect(dispatchStart).toBeGreaterThan(callStart)
    expect(workflow.slice(callStart, dispatchStart)).not.toContain("inputs:")
    expect(workflow).toContain("  push:")
    expect(workflow).toContain("    branches-ignore:")
    expect(workflow).toContain("      - main")
  })

  it("keeps builder output explicitly non-authoritative", () => {
    const workflow = readFileSync(workflowPath, "utf8")
    const builder = readFileSync(builderPath, "utf8")

    expect(builder).toContain('authorityEligible: false')
    expect(builder).toContain('"staging-non-authoritative"')
    expect(builder).toContain('"clean-ci-builder.1"')
    expect(builder).toContain("GITHUB_WORKFLOW_REF")
    expect(builder).toContain("GITHUB_RUN_ATTEMPT")
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
    expect(workflow).toContain("predicate-type: https://github.com/jyt6640/persona-harness/attestations/clean-ci-builder.1")
  })
})
