import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = process.cwd()
const contractPath = "docs/current/hq-orchestration/control-contract.json"
const resultFields = ["role", "state", "delta", "evidence", "decision", "next", "risk"]
const ledgerColumns = ["goal", "owner", "current candidate", "required gate", "next predicate", "blocker"]
const pilotMetrics = [
  "rail-starts",
  "heavy-check-repetition",
  "repeated-evidence-prose",
  "retries",
  "blocked-time-cause",
]

function readText(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8")
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readControlContract(): Readonly<Record<string, unknown>> {
  const parsed: unknown = JSON.parse(readText(contractPath))
  if (!isRecord(parsed)) {
    throw new TypeError("HQ control contract must be a JSON object")
  }
  return parsed
}

describe("HQ orchestration control contract", () => {
  it("defines owner-default closure and only named conditional gate starts", () => {
    const contract = readControlContract()

    expect(contract).toMatchObject({
      schema: "persona.hq-control.1",
      sourceOfTruth: [
        contractPath,
        "docs/current/hq-orchestration/protocol.md",
        "docs/current/hq-orchestration/templates/result-report-format.md",
        "docs/current/hq-orchestration/thread-index.md",
      ],
      closure: { defaultOwner: "owner" },
      gates: {
        source: { start: "named-source-predicate" },
        package: { start: "named-package-predicate" },
        hosted: { start: "named-hosted-predicate" },
      },
      controlLedger: { columns: ledgerColumns },
      result: { fields: resultFields, maximumLines: 12 },
      completePackets: {
        allowedStages: ["candidate-freeze", "independent-acceptance", "final-hosted-evidence"],
      },
      pins: { maximum: 3, roles: ["delivery-control", "owner-workspace", "active-external-gate"] },
      automation: {
        mode: "event-driven",
        prohibited: ["polling", "retries", "diagnostic-wrapper-chains"],
      },
      pilot: { issueCount: { minimum: 3, maximum: 5 }, metrics: pilotMetrics },
    })
  })

  it("routes tracked current entrypoints and result templates to the structured contract", () => {
    const readme = readText("docs/current/hq-orchestration/README.md")
    const protocol = readText("docs/current/hq-orchestration/protocol.md")
    const resultTemplate = readText("docs/current/hq-orchestration/templates/result-report-format.md")
    const dispatchHeader = readText("docs/current/hq-orchestration/templates/common-dispatch-header.md")
    const threadIndex = readText("docs/current/hq-orchestration/thread-index.md")

    expect(readme).toContain("control-contract.json")
    expect(protocol).toContain("control-contract.json")
    expect(threadIndex).toContain("## Pin Policy")

    for (const field of resultFields) {
      expect(resultTemplate).toContain(`${field}=`)
      expect(dispatchHeader).toContain(`${field}=`)
    }
  })

  it("pins external OpenCode model actions without affecting non-model execution", () => {
    const contract = readControlContract()
    const protocol = readText("docs/current/hq-orchestration/protocol.md")
    const dispatchHeader = readText("docs/current/hq-orchestration/templates/common-dispatch-header.md")

    expect(contract).toMatchObject({
      externalOpenCodeModel: {
        scope: "opencode-external-model-invocation-only",
        provider: "openai",
        modelId: "gpt-5.3-codex-spark",
        configuredModel: "openai/gpt-5.3-codex-spark",
        evidenceField: "configuredOpenCodeModel",
        unavailable: "blocked-before-model-or-product-action",
        prohibitedSubstitutions: ["model", "provider", "alias", "local-simulation"],
        exclusions: [
          "github-actions-ci-release-publish",
          "ordinary-npm-package-checks",
          "non-opencode-fixture-steps",
          "historical-evidence",
        ],
      },
    })
    expect(protocol).toContain("externalOpenCodeModel")
    expect(dispatchHeader).toContain("externalOpenCodeModel")
  })

  it("keeps the operating contract outside the published package surface", () => {
    const packageJson: Readonly<Record<string, unknown>> = JSON.parse(readText("package.json"))

    expect(packageJson).toMatchObject({
      files: expect.not.arrayContaining([
        "AGENTS.md",
        "docs/current/hq-orchestration",
        contractPath,
      ]),
    })
  })
})
