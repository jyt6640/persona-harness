import { mkdirSync, realpathSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { readContextPreview } from "../src/cli/context-preview.js"
import {
  emptyPersonalizationStore,
  proposePersonalizationCandidate,
  resolvePersonalizationCandidate,
  writePersonalizationStore,
  type PersonalizationScope,
} from "../src/cli/personalization-profile-store.js"
import { selectContextForTargets } from "../src/context-delivery/context-target-selection.js"
import { cleanupProjects, createProject, writeHarnessConfig } from "./helpers/rule-fixtures.js"

afterEach(cleanupProjects)

function fixture() {
  const projectDir = realpathSync(createProject())
  const personalization = { storeRoot: join(projectDir, "personalization") }
  writeHarnessConfig(projectDir, { context: { enabled: true, maxCapsules: 16, maxChars: 4_000 } })
  return { personalization, projectDir }
}

function activate(input: ReturnType<typeof fixture>, scope: PersonalizationScope, id: string) {
  proposePersonalizationCandidate({
    candidateId: id,
    counterexample: "Reconsider when the public contract changes.",
    outcome: "The scoped naming rule is applied.",
    provenance: { kind: "user", reference: "approved-decision" },
    rationale: "Use the approved local convention.",
    rule: `Use the ${id} naming convention.`,
    schemaVersion: "personalization-candidate.v1",
    scope,
    topic: "naming",
    tradeoffs: "A scoped convention can differ from the personal default.",
  }, input.personalization)
}

describe("approved personal, project and task Context scopes", () => {
  it("keeps a complementary same-topic proposal inactive until explicit consolidation approval", () => {
    const input = fixture()
    activate(input, { kind: "personal", key: "personal" }, "original")
    const proposal = {
      candidateId: "combined",
      counterexample: "Reconsider when the public naming contract changes.",
      outcome: "Both naming obligations remain operative.",
      provenance: { kind: "user", reference: "approved-combined-naming" },
      rationale: "The obligations address different parts of one naming decision.",
      rule: "Use the original naming convention. Preserve established public names.",
      schemaVersion: "personalization-candidate.v1",
      scope: { kind: "personal", key: "personal" },
      topic: "naming",
      tradeoffs: "Public compatibility constrains naming consistency.",
    } as const

    const pending = proposePersonalizationCandidate(proposal, input.personalization)

    expect(pending.status).toBe("conflict")
    expect(pending.document.profile.activeRules.map((rule) => rule.ruleId)).toEqual(["rule-original"])
    expect(pending.document.profile.pendingCandidates).toEqual([proposal])
    expect(readContextPreview(["src/App.java", "--topic", "naming"], input.projectDir, input))
      .toMatchObject({ preview: { resolution: { selected: [{
        id: "rule-original", rule: "Use the original naming convention.",
      }] } } })
  })

  it("carries every explicitly approved consolidated obligation through stored scope and target delivery", () => {
    const input = fixture()
    activate(input, { kind: "project", key: "checkout-a" }, "original")
    const combinedRule = "Use the original naming convention. Preserve established public names."
    const pending = proposePersonalizationCandidate({
      candidateId: "combined",
      counterexample: "Reconsider when the public naming contract changes.",
      outcome: "Both naming obligations remain operative.",
      provenance: { kind: "user", reference: "approved-combined-naming" },
      rationale: "The obligations address different parts of one naming decision.",
      rule: combinedRule,
      schemaVersion: "personalization-candidate.v1",
      scope: { kind: "project", key: "checkout-a" },
      topic: "naming",
      tradeoffs: "Public compatibility constrains naming consistency.",
    }, input.personalization)

    const approved = resolvePersonalizationCandidate("combined", "supersede", input.personalization)

    expect(approved.document.history.events.slice(0, -1)).toEqual(pending.document.history.events)
    expect(approved.document.profile.activeRules).toMatchObject([{
      ruleId: "rule-combined", rule: combinedRule,
      scope: { kind: "project", key: "checkout-a" },
      provenance: { kind: "user", reference: "approved-combined-naming" },
    }])
    expect(approved.document.profile.pendingCandidates).toEqual([])
    expect(readContextPreview(["src/App.java", "--topic", "naming", "--project", "checkout-a"], input.projectDir, input))
      .toMatchObject({ preview: { resolution: { selected: [{ id: "rule-combined", rule: combinedRule }] } } })
    const selected = selectContextForTargets(input.projectDir, ["src/App.java"], { ...input, projectKey: "checkout-a" })
    if (selected.status !== "selected") throw new Error("expected selected approved project rule")
    expect(selected.ruleIds).toContain("rule-combined")
    expect(selected.ruleIds).not.toContain("rule-original")
    expect(selected.block).toContain(combinedRule)
    const unrelated = selectContextForTargets(input.projectDir, ["src/App.java"], { ...input, projectKey: "checkout-b" })
    if (unrelated.status !== "selected") throw new Error("expected unrelated project defaults")
    expect(unrelated.ruleIds).not.toContain("rule-combined")
  })

  it("reports unbound scope identities without guessing a project or task", () => {
    const input = fixture()
    activate(input, { kind: "project", key: "checkout-a" }, "project")
    activate(input, { kind: "task", key: "change-a" }, "task")
    const unbound = readContextPreview(["src/App.java"], input.projectDir, input)
    expect(unbound).toMatchObject({ preview: { envelope: { warnings: [
      { code: "project-scope-unbound" }, { code: "task-scope-unbound" },
    ] } } })
    const bound = readContextPreview(["src/App.java", "--project", "checkout-a", "--task", "change-a"], input.projectDir, input)
    expect(bound).toMatchObject({ preview: { envelope: { warnings: [] } } })
  })

  it("applies task > project > team > personal for explicit matching scopes", () => {
    const input = fixture()
    activate(input, { kind: "personal", key: "personal" }, "personal")
    activate(input, { kind: "project", key: "checkout-a" }, "project")
    activate(input, { kind: "task", key: "change-a" }, "task")
    mkdirSync(join(input.projectDir, ".persona"), { recursive: true })
    writeFileSync(join(input.projectDir, ".persona", "team-profile.json"), JSON.stringify({
      schemaVersion: "persona-team-profile.v1", teamKey: "core-team",
      rules: [{ id: "team.naming", topic: "naming", rule: "Use the team naming convention.", status: "active" }],
    }))

    for (const [selectors, id, layer] of [
      [[], "team.naming", "team"],
      [["--project", "checkout-a"], "rule-project", "project"],
      [["--project", "checkout-a", "--task", "change-a"], "rule-task", "task"],
      [["--project", "other", "--task", "other"], "team.naming", "team"],
    ] as const) {
      const result = readContextPreview(["src/App.java", "--topic", "naming", ...selectors], input.projectDir, input)
      expect(result).toMatchObject({ preview: { resolution: {
        status: "resolved", selected: [{ id, layer, topic: "naming" }],
      } } })
    }
  })

  it("reports a missing profile without claiming personal selection or creating a store", () => {
    const input = fixture()
    const result = readContextPreview(["src/App.java"], input.projectDir, input)
    expect(result).toMatchObject({ preview: { envelope: {
      warnings: [{ code: "personal-profile-missing" }],
    } } })
    if (result.status !== "ready") throw new Error("expected inspectable preview")
    expect(result.preview.envelope.selected.every((rule) => rule.layer !== "personal")).toBe(true)
  })

  it("distinguishes an initialized empty profile from an unavailable profile", () => {
    const input = fixture()
    writePersonalizationStore(emptyPersonalizationStore(), input.personalization)
    const empty = readContextPreview(["src/App.java"], input.projectDir, input)
    expect(empty).toMatchObject({ preview: { envelope: { warnings: [{ code: "personal-profile-empty" }] } } })
    activate(input, { kind: "personal", key: "personal" }, "personal")
    const active = readContextPreview(["src/App.java"], input.projectDir, input)
    expect(active).toMatchObject({ preview: { envelope: { warnings: [] } } })
  })
})
