import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = process.cwd()
const workflowPath = join(root, ".github", "workflows", "persona-harness-project-finish.yml")
const scriptPath = join(root, "scripts", "build-project-finish-attestation.mjs")
const callerFixturePath = join(root, "tests", "fixtures", "project-finish-attestation", "caller-workflow.yml")

describe("project finish attestation producer workflow contract", () => {
  it("declares a pinned reusable producer with no caller-controlled inputs", () => {
    expect(existsSync(workflowPath)).toBe(true)
    expect(existsSync(scriptPath)).toBe(true)

    const workflow = readFileSync(workflowPath, "utf8")

    expect(workflow).toContain("workflow_call:")
    expect(workflow).not.toContain("workflow_dispatch:")
    expect(workflow).not.toContain("\n  inputs:")
    expect(workflow).toContain("github.event_name == 'push'")
    expect(workflow).toContain("github.ref == 'refs/heads/main'")
    expect(workflow).toContain("github.event.repository.private == false")
    expect(workflow).toContain("actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5")
    expect(workflow).toContain("actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020")
    expect(workflow).toContain("actions/attest@ce27ba3b4a9a139d9a20a4a07d69fabb52f1e5bc")
    expect(workflow).toContain("actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02")
    expect(workflow).toContain("subject-path: .ci/project-finish-attestation/receipt.json")
    expect(workflow).toContain("predicate-path: .ci/project-finish-attestation/predicate.json")
    expect(workflow).toContain("project-finish-attestation.1")
    expect(workflow).toContain("if: always()")
    expect(workflow).toContain("failure-diagnostic.json")
    expect(workflow).toContain("contents: read")
    expect(workflow).toContain("id-token: write")
    expect(workflow).toContain("attestations: write")
    expect(workflow).toContain("artifact-metadata: write")
    expect(workflow).not.toContain("contents: write")
    expect(workflow).not.toContain("npm publish")
    expect(workflow).not.toContain("git tag")
    expect(workflow).not.toContain("git push")
    expect(workflow).not.toContain("workflow finish")
  })

  it("uses only platform-derived OIDC workflow claims in the bounded artifact builder", () => {
    const source = readFileSync(scriptPath, "utf8")

    expect(source).toContain("ACTIONS_ID_TOKEN_REQUEST_URL")
    expect(source).toContain("ACTIONS_ID_TOKEN_REQUEST_TOKEN")
    expect(source).toContain("job_workflow_ref")
    expect(source).toContain("job_workflow_sha")
    expect(source).toContain("workflow_ref")
    expect(source).toContain("workflow_sha")
    expect(source).toContain("runProjectFinishAttestationProducer")
    expect(source).not.toContain("--repository")
    expect(source).not.toContain("--workflow")
    expect(source).not.toContain("--command")
    expect(source).not.toContain("npm publish")
  })

  it("keeps the postmerge caller path pinned to an immutable reusable workflow SHA", () => {
    expect(existsSync(callerFixturePath)).toBe(true)

    const caller = readFileSync(callerFixturePath, "utf8")

    expect(caller).toContain("push:")
    expect(caller).toContain("- main")
    expect(caller).toMatch(
      /uses: jyt6640\/persona-harness\/\.github\/workflows\/persona-harness-project-finish\.yml@[a-f0-9]{40}/u,
    )
    expect(caller).not.toContain("@main")
  })
})
