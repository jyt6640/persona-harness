import { realpathSync } from "node:fs"
import { join } from "node:path"
import { proposePersonalizationCandidate } from "../../src/cli/personalization-profile-store.js"
import { createProject, writeHarnessConfig } from "./rule-fixtures.js"

export function checkoutScopeFixture() {
  const projectDir = realpathSync(createProject())
  const personalization = { storeRoot: join(realpathSync(createProject()), "profile") }
  writeHarnessConfig(projectDir, { context: { enabled: true, maxCapsules: 16, maxChars: 4_000 } })
  return { personalization, projectDir }
}

export function approveProjectRule(input: ReturnType<typeof checkoutScopeFixture>, key = "checkout-a") {
  return proposePersonalizationCandidate({
    candidateId: `approved-${key}`,
    counterexample: "Reconsider when the public naming contract changes.",
    outcome: "Preserve the approved project convention.",
    provenance: { kind: "user", reference: "approved-checkout-naming" },
    rationale: "Keep names consistent in this project.",
    rule: "Preserve established public names.",
    schemaVersion: "personalization-candidate.v1",
    scope: { kind: "project", key },
    topic: "naming",
    tradeoffs: "Public compatibility constrains naming consistency.",
  }, input.personalization)
}

export function approveTaskRule(input: ReturnType<typeof checkoutScopeFixture>, key = "task-a") {
  return proposePersonalizationCandidate({
    candidateId: `approved-${key}`, schemaVersion: "personalization-candidate.v1",
    scope: { kind: "task", key }, topic: "naming",
    rule: "Keep the public operation name register for this task.",
    rationale: "Existing callers use this operation.", outcome: "Preserve the agreed task interface.",
    tradeoffs: "Internal naming consistency yields to compatibility.",
    counterexample: "Reconsider for a separately approved API migration.",
    provenance: { kind: "user", reference: "explicit-task-resume" },
  }, input.personalization)
}
