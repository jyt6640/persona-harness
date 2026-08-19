import { mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

import { afterEach, describe, expect, it } from "vitest"

import { createInjectionBlock } from "../src/runtime/injection.js"
import {
  resolveEffectiveProfile,
  type EffectiveProfileRuleInput,
} from "../src/runtime/effective-profile.js"
import { renderRuntimeContextSections } from "../src/runtime/runtime-context.js"

const projects: string[] = []

afterEach(() => {
  for (const project of projects.splice(0)) {
    rmSync(project, { force: true, recursive: true })
  }
})

describe("effective profile resolution", () => {
  it("selects the highest-precedence relevant layer without mutating lower layers", () => {
    const result = resolveEffectiveProfile({
      productInvariants: [],
      taskDecisions: [rule("task", "architecture", "task rule", { kind: "task", key: "checkout-task" })],
      projectContracts: [rule("project", "architecture", "project rule", { kind: "project", key: "checkout" })],
      personalRules: [rule("personal", "architecture", "personal rule", { kind: "personal", key: "personal" })],
      starterDefaults: [rule("starter", "architecture", "starter rule")],
      relevance: {
        topics: ["architecture"],
        fileRole: "service",
        skillIds: ["programming"],
        projectKey: "checkout",
        taskKey: "checkout-task",
      },
    })

    expect(result).toMatchObject({ status: "resolved" })
    if (result.status !== "resolved") return
    expect(result.capsules.map((capsule) => capsule.id)).toEqual(["task"])
    expect(result.selections).toEqual([{ id: "task", source: "task", topic: "architecture", reason: "topic+scope+file-role+skill" }])
  })

  it("selects only relevant active capsules and never injects pending or superseded entries", () => {
    const result = resolveEffectiveProfile({
      productInvariants: [],
      taskDecisions: [],
      projectContracts: [],
      personalRules: [
        rule("relevant", "architecture", "relevant rule"),
        rule("unrelated", "testing", "unrelated rule"),
        rule("pending", "architecture", "pending rule", undefined, "pending"),
        rule("superseded", "architecture", "superseded rule", undefined, "superseded"),
      ],
      starterDefaults: [],
      relevance: { topics: ["architecture"], fileRole: "service", skillIds: ["programming"] },
    })

    expect(result).toMatchObject({ status: "resolved" })
    if (result.status !== "resolved") return
    expect(result.capsules.map((capsule) => capsule.id)).toEqual(["relevant"])
  })

  it("fails closed on equal-priority ambiguity and selection overflow", () => {
    const ambiguous = resolveEffectiveProfile({
      productInvariants: [],
      taskDecisions: [],
      projectContracts: [],
      personalRules: [rule("first", "architecture", "first"), rule("second", "architecture", "second")],
      starterDefaults: [],
      relevance: { topics: ["architecture"], fileRole: "service", skillIds: ["programming"] },
    })
    expect(ambiguous).toEqual({ status: "blocked", reason: "ambiguous-conflict", capsules: [], selections: [] })

    const overflow = resolveEffectiveProfile({
      productInvariants: [],
      taskDecisions: [],
      projectContracts: [],
      personalRules: [],
      starterDefaults: [rule("one", "one", "one"), rule("two", "two", "two")],
      relevance: { topics: ["one", "two"], fileRole: "service", skillIds: ["programming"] },
      maxCapsules: 1,
    })
    expect(overflow).toEqual({ status: "blocked", reason: "selection-overflow", capsules: [], selections: [] })
  })

  it("fails closed on malformed or unknown layer input", () => {
    const result = resolveEffectiveProfile({
      productInvariants: [],
      taskDecisions: [],
      projectContracts: [],
      personalRules: [],
      starterDefaults: [],
      relevance: { topics: ["architecture"], fileRole: "service", skillIds: [] },
      extraLayer: [],
    })

    expect(result).toEqual({ status: "blocked", reason: "malformed-input", capsules: [], selections: [] })

    const unknownState = resolveEffectiveProfile({
      productInvariants: [],
      taskDecisions: [],
      projectContracts: [],
      personalRules: [{ ...rule("unknown", "architecture", "unknown state"), status: "unknown" }],
      starterDefaults: [],
      relevance: { topics: ["architecture"], fileRole: "service", skillIds: ["programming"] },
    } as unknown)
    expect(unknownState).toEqual({ status: "blocked", reason: "malformed-input", capsules: [], selections: [] })

    const unavailable = resolveEffectiveProfile({
      productInvariants: [],
      taskDecisions: [],
      projectContracts: [],
      personalRules: [],
      starterDefaults: [],
      relevance: { topics: ["architecture"], fileRole: "service", skillIds: [] },
      personalProfileAvailable: false,
    })
    expect(unavailable).toEqual({ status: "blocked", reason: "profile-unavailable", capsules: [], selections: [] })
  })

  it("renders selected personal capsules as a compact semantic section", () => {
    const project = mkdtempSync(join(tmpdir(), "effective-profile-test-"))
    projects.push(project)
    const injection = createInjectionBlock("src/main/java/example/Service.java", project, {
      effectiveProfile: {
        available: true,
        personalRules: [rule("personal", "architecture", "Keep service orchestration explicit.")],
        productInvariants: [],
        starterDefaults: [],
        context: { topics: ["architecture"], fileRole: "service", skillIds: ["programming"] },
      },
    })

    const rendered = renderRuntimeContextSections(injection.semanticSections)
    expect(rendered).toContain("[capsules]")
    expect(rendered).toContain("Keep service orchestration explicit.")
    expect(injection.selectedProfileRuleIds).toEqual(["personal"])
    expect(injection.profileSelectionReasons).toEqual(["topic+scope+file-role+skill"])
  })
})

function rule(
  id: string,
  topic: string,
  text: string,
  scope?: EffectiveProfileRuleInput["scope"],
  status: EffectiveProfileRuleInput["status"] = "active",
): EffectiveProfileRuleInput {
  return {
    fileRoles: ["service"],
    id,
    rule: text,
    scope,
    skillIds: ["programming"],
    status,
    topic,
  }
}
