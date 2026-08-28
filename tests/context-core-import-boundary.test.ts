import { readFileSync, readdirSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

import {
  DEFAULT_CONTEXT_BUDGET,
  canonicalContextDigest,
  resolveEffectiveProfile,
} from "../src/context-core/index.js"

const contextCoreRoot = resolve(process.cwd(), "src/context-core")

describe("pure Context Core boundary", () => {
  it("preserves the deterministic effective-profile v1 result without a host", () => {
    const result = resolveEffectiveProfile({
      personalProfileAvailable: true,
      personalRules: [rule("personal-style", "style", "Personal style")],
      productInvariants: [rule("invariant-safety", "safety", "Do not weaken safety")],
      projectContracts: [rule("project-style", "style", "Project style")],
      relevance: { fileRole: "service", skillIds: [], topics: ["safety", "style"] },
      starterDefaults: [],
      taskDecisions: [],
    })

    expect(result).toEqual({
      capsules: [
        { id: "invariant-safety", rule: "Do not weaken safety", source: "invariant", topic: "safety" },
        { id: "project-style", rule: "Project style", source: "project", topic: "style" },
      ],
      selections: [
        { id: "invariant-safety", reason: "topic+scope", source: "invariant", topic: "safety" },
        { id: "project-style", reason: "topic+scope", source: "project", topic: "style" },
      ],
      status: "resolved",
    })
  })

  it("provides frozen experimental budget defaults and a key-order-independent digest", () => {
    expect(DEFAULT_CONTEXT_BUDGET).toEqual({ maxCapsules: 8, maxChars: 1_600 })
    expect(Object.isFrozen(DEFAULT_CONTEXT_BUDGET)).toBe(true)
    expect(canonicalContextDigest({ alpha: 1, nested: { beta: 2, gamma: [3, 4] } })).toBe(
      canonicalContextDigest({ nested: { gamma: [3, 4], beta: 2 }, alpha: 1 }),
    )
    expect(canonicalContextDigest({ alpha: 1 })).toMatch(/^[0-9a-f]{64}$/u)
  })

  it("imports only pure Core or Node digest dependencies", () => {
    const files = readdirSync(contextCoreRoot).filter((file) => file.endsWith(".ts")).sort()
    expect(files).toEqual([
      "context-budget.ts",
      "context-digest.ts",
      "context-envelope-builder.ts",
      "context-envelope-input.ts",
      "context-envelope.ts",
      "effective-context-input.ts",
      "effective-context-v2-input.ts",
      "effective-context-v2.ts",
      "effective-context.ts",
      "index.ts",
      "rule-types.ts",
    ])

    const rejectedImports = [
      "@opencode-ai/plugin",
      "../cli",
      "../runtime",
      "github",
      "workflow",
      "authority",
      "attestation",
      "evidence",
      "child_process",
      "java",
    ]
    for (const file of files) {
      const source = readFileSync(resolve(contextCoreRoot, file), "utf8")
      for (const importPath of importPaths(source)) {
        for (const rejected of rejectedImports) expect(importPath).not.toContain(rejected)
      }
    }
  })

  it("keeps the legacy runtime module as a compatibility re-export", () => {
    const source = readFileSync(resolve(process.cwd(), "src/runtime/effective-profile.ts"), "utf8")
    expect(source.trim()).toBe('export * from "../context-core/effective-context.js"')
  })
})

function rule(id: string, topic: string, content: string): Readonly<Record<string, string>> {
  return { id, rule: content, status: "active", topic }
}

function importPaths(source: string): readonly string[] {
  return [...source.matchAll(/from\s+["']([^"']+)["']/gu)].map((match) => match[1] ?? "")
}
