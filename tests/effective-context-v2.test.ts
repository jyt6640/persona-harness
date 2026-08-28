import { describe, expect, it } from "vitest"

import { resolveEffectiveContext, resolveEffectiveProfile } from "../src/context-core/index.js"

describe("effective Context v2", () => {
  it("selects every layer deterministically and explains shadowed rules", () => {
    const result = resolveEffectiveContext({
      commonDefaults: [rule("common", "common-topic", "Common rule")],
      languageDefaults: [
        rule("language", "language-topic", "Language rule"),
        rule("language-shadowed", "personal-topic", "Language shadowed"),
      ],
      personalRules: [
        rule("personal", "personal-topic", "Personal rule"),
        rule("personal-shadowed", "team-topic", "Personal shadowed"),
      ],
      productInvariants: [rule("invariant", "invariant-topic", "Invariant rule")],
      projectContracts: [
        rule("project", "project-topic", "Project rule"),
        rule("project-shadowed", "task-topic", "Project shadowed"),
      ],
      relevance: relevance([
        "common-topic",
        "invariant-topic",
        "language-topic",
        "personal-topic",
        "project-topic",
        "task-topic",
        "team-topic",
      ]),
      taskDecisions: [rule("task", "task-topic", "Task rule")],
      teamContracts: [
        rule("team", "team-topic", "Team rule"),
        rule("team-shadowed", "project-topic", "Team shadowed"),
      ],
    })

    expect(result).toMatchObject({ status: "resolved" })
    if (result.status !== "resolved") return
    expect(result.selected.map((selection) => [selection.id, selection.layer])).toEqual([
      ["invariant", "invariant"],
      ["task", "task"],
      ["project", "project"],
      ["team", "team"],
      ["personal", "personal"],
      ["language", "language"],
      ["common", "common"],
    ])
    expect(result.shadowed).toEqual([
      { id: "project-shadowed", reason: "higher-precedence", topic: "task-topic", winnerId: "task" },
      { id: "team-shadowed", reason: "higher-precedence", topic: "project-topic", winnerId: "project" },
      { id: "personal-shadowed", reason: "higher-precedence", topic: "team-topic", winnerId: "team" },
      { id: "language-shadowed", reason: "higher-precedence", topic: "personal-topic", winnerId: "personal" },
    ])
  })

  it("matches topic, file role, language, skill, and project/task/team scopes", () => {
    const result = resolveEffectiveContext({
      commonDefaults: [],
      languageDefaults: [],
      personalRules: [],
      productInvariants: [],
      projectContracts: [],
      relevance: relevance(["architecture"]),
      taskDecisions: [],
      teamContracts: [
        rule("matching", "architecture", "Matching rule", {
          fileRoles: ["service"],
          languages: ["typescript"],
          scope: { key: "platform", kind: "team" },
          skillIds: ["programming"],
        }),
        rule("wrong-language", "architecture", "Wrong language", { languages: ["java"] }),
        rule("wrong-scope", "architecture", "Wrong scope", { scope: { key: "other", kind: "team" } }),
      ],
    })

    expect(result).toMatchObject({ status: "resolved" })
    if (result.status !== "resolved") return
    expect(result.selected).toEqual([
      { id: "matching", layer: "team", reason: "topic+scope+file-role+language+skill", rule: "Matching rule", topic: "architecture" },
    ])
  })

  it("blocks same-layer conflicts and malformed or overflowing input without selecting a rule", () => {
    const conflict = resolveEffectiveContext({
      commonDefaults: [],
      languageDefaults: [],
      personalRules: [],
      productInvariants: [],
      projectContracts: [rule("first", "architecture", "First"), rule("second", "architecture", "Second")],
      relevance: relevance(["architecture"]),
      taskDecisions: [],
      teamContracts: [],
    })
    expect(conflict).toEqual({
      conflicts: [{ reason: "same-layer-conflict", ruleIds: ["first", "second"], topic: "architecture" }],
      reason: "ambiguous-conflict",
      selected: [],
      shadowed: [],
      status: "blocked",
    })

    const overflow = resolveEffectiveContext({
      commonDefaults: [rule("one", "one", "One"), rule("two", "two", "Two")],
      languageDefaults: [],
      maxCapsules: 1,
      personalRules: [],
      productInvariants: [],
      projectContracts: [],
      relevance: relevance(["one", "two"]),
      taskDecisions: [],
      teamContracts: [],
    })
    expect(overflow).toEqual({ conflicts: [], reason: "selection-overflow", selected: [], shadowed: [], status: "blocked" })

    const malformed = resolveEffectiveContext({
      commonDefaults: [],
      languageDefaults: [],
      personalRules: [],
      productInvariants: [],
      projectContracts: [],
      relevance: relevance(["architecture"]),
      taskDecisions: [],
      teamContracts: [],
      unknownLayer: [],
    })
    expect(malformed).toEqual({ conflicts: [], reason: "malformed-input", selected: [], shadowed: [], status: "blocked" })
  })

  it("excludes inactive rules and preserves the v1 starter alias result", () => {
    const v2 = resolveEffectiveContext({
      commonDefaults: [rule("active", "architecture", "Active"), rule("pending", "architecture", "Pending", { status: "pending" })],
      languageDefaults: [],
      personalRules: [],
      productInvariants: [],
      projectContracts: [],
      relevance: relevance(["architecture"]),
      taskDecisions: [],
      teamContracts: [],
    })
    expect(v2).toMatchObject({ status: "resolved" })
    if (v2.status !== "resolved") return
    expect(v2.selected.map((selection) => selection.id)).toEqual(["active"])

    expect(resolveEffectiveProfile({
      personalRules: [],
      productInvariants: [],
      projectContracts: [],
      relevance: { fileRole: "service", skillIds: [], topics: ["architecture"] },
      starterDefaults: [legacyRule("starter", "architecture", "Starter")],
      taskDecisions: [],
    })).toEqual({
      capsules: [{ id: "starter", rule: "Starter", source: "starter", topic: "architecture" }],
      selections: [{ id: "starter", reason: "topic+scope", source: "starter", topic: "architecture" }],
      status: "resolved",
    })
  })
})

function relevance(topics: readonly string[]) {
  return {
    fileRole: "service",
    language: "typescript",
    projectKey: "checkout",
    skillIds: ["programming"],
    taskKey: "checkout-task",
    teamKey: "platform",
    topics,
  }
}

function rule(id: string, topic: string, content: string, extra: Readonly<Record<string, unknown>> = {}) {
  return { id, rule: content, status: "active", topic, ...extra }
}

function legacyRule(id: string, topic: string, content: string) {
  return { id, rule: content, status: "active", topic }
}
