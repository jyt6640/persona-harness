import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = process.cwd()
const workflowPath = join(root, ".github", "workflows", "production-integrity-audit.yml")
const runnerPath = join(root, "scripts", "production-integrity-audit-runner.mjs")

describe("production integrity audit workflow", () => {
  it("is a fixed protected-main read-only dispatch with a sanitized durable artifact", () => {
    expect(existsSync(workflowPath)).toBe(true)

    const workflow = readFileSync(workflowPath, "utf8")
    expect(workflow).toContain("workflow_dispatch:")
    expect(workflow).not.toContain("inputs:")
    expect(workflow).not.toContain("pull_request:")
    expect(workflow).not.toContain("push:")
    expect(workflow).toContain("github.repository == 'jyt6640/persona-harness'")
    expect(workflow).toContain("github.ref == 'refs/heads/main'")
    expect(workflow).toContain("permissions:\n  contents: read")
    expect(workflow).not.toContain("id-token:")
    expect(workflow).not.toContain("attestations:")
    expect(workflow).not.toContain("npm publish")
    expect(workflow).not.toContain("git tag")
    expect(workflow).not.toContain("git push")
    expect(workflow).not.toContain("gh release")
    expect(workflow).not.toContain("workflow finish")
    expect(workflow).toContain("node scripts/run-production-integrity-audit.mjs")
    expect(workflow).toContain("if: always()")
    expect(workflow).toContain("production-integrity-audit-summary")
    expect(workflow).toContain(".ci/production-integrity-audit/summary.json")
  })

  it("keeps direct registry installation separate from downloaded-tarball binding", () => {
    const runner = readFileSync(runnerPath, "utf8")

    expect(runner).toContain("deriveProductionIntegrityAuditChannel(version)")
    expect(runner).toContain('if (channel === "latest")')
    expect(runner).toContain('"install"')
    expect(runner).toContain("PRODUCTION_INTEGRITY_AUDIT_PACKAGE}@${version}")
    expect(runner).toContain('"--registry"')
    expect(runner).toContain('"https://registry.npmjs.org"')
    expect(runner).toContain("runInstalledCompletionIntegrityMatrix(registryConsumer.consumer")
    expect(runner).toMatch(/"--channel",\s+channel/u)
    expect(runner).not.toContain("PRODUCTION_INTEGRITY_AUDIT_CHANNEL")
    expect(runner).not.toContain("createStablePromotionConsumer")
  })
})
