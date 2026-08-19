import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

import { afterEach, describe, expect, it } from "vitest"

import { PERSONALIZATION_CANDIDATE_SCHEMA } from "../src/cli/personalization-profile-store.js"
import { runPersonaCli } from "../src/cli/index.js"
import type { PhilosophyRefinementInput } from "../src/cli/philosophy-refinement.js"
import { parseExplicitPersonaSkillCommand } from "../src/runtime/persona-shared-skill-activation.js"

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { force: true, recursive: true })
})

describe("explicit philosophy refinement", () => {
  it("routes only an explicit refinement command to the portable skill", () => {
    expect(parseExplicitPersonaSkillCommand("ordinary discussion about design")).toEqual({ kind: "none" })
    expect(parseExplicitPersonaSkillCommand("/persona philosophy-refinement")).toEqual({
      kind: "valid",
      skillId: "philosophy-refinement",
    })
  })

  it("does not start without an explicit refinement trigger", () => {
    const storeRoot = tempRoot()
    const result = refine(storeRoot, { ...completeRefinement("missing-trigger"), trigger: undefined })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("incomplete")
    expect(existsSync(storeRoot)).toBe(false)
  })

  it("requires the complete Socratic evidence before changing the profile", () => {
    const storeRoot = tempRoot()
    expect(refine(storeRoot, completeRefinement("stable")).status).toBe(0)
    const before = readFileSync(join(storeRoot, "profile.json"), "utf8")
    const result = refine(storeRoot, { ...completeRefinement("incomplete"), preferredAlternative: "" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("incomplete")
    expect(readFileSync(join(storeRoot, "profile.json"), "utf8")).toBe(before)
  })

  it("activates a complete explicit personal philosophy candidate", () => {
    const storeRoot = tempRoot()
    const result = refine(storeRoot, completeRefinement("explicit"))

    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout) as { status: string }).toMatchObject({
      classification: "personal-philosophy",
      status: "activated",
    })
    const stored = JSON.parse(readFileSync(join(storeRoot, "profile.json"), "utf8")) as {
      profile: { activeRules: readonly unknown[] }
    }
    expect(stored.profile.activeRules).toHaveLength(1)
    const serialized = readFileSync(join(storeRoot, "profile.json"), "utf8")
    expect(serialized).not.toContain("currentRationale")
    expect(serialized).not.toContain("preferredAlternative")
  })

  it("records an implementation mistake without creating a profile rule", () => {
    const storeRoot = tempRoot()
    const result = refine(storeRoot, { ...completeRefinement("mistake"), classification: "implementation-mistake" })

    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout) as { status: string }).toMatchObject({
      classification: "implementation-mistake",
      status: "no-profile-change",
    })
    expect(existsSync(storeRoot)).toBe(false)
  })

  it("records an explicit project decision through the same append-only lifecycle", () => {
    const storeRoot = tempRoot()
    const base = completeRefinement("project")
    const input = {
      ...base,
      candidate: {
        ...base.candidate,
        scope: { key: "checkout", kind: "project" as const },
      },
      classification: "project-decision" as const,
    }

    const result = refine(storeRoot, input)

    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout) as { status: string }).toMatchObject({
      classification: "project-decision",
      status: "activated",
    })
  })

  it("keeps a same-topic overlapping refinement pending without overwriting the active rule", () => {
    const storeRoot = tempRoot()
    expect(refine(storeRoot, completeRefinement("first")).status).toBe(0)
    const before = JSON.parse(readFileSync(join(storeRoot, "profile.json"), "utf8")) as {
      profile: { activeRules: readonly { ruleId: string }[] }
    }

    const result = refine(storeRoot, completeRefinement("second"))

    expect(result.status).toBe(1)
    expect(result.stdout).toContain('"status":"conflict"')
    const after = JSON.parse(readFileSync(join(storeRoot, "profile.json"), "utf8")) as {
      profile: { activeRules: readonly { ruleId: string }[]; pendingCandidates: readonly unknown[] }
    }
    expect(after.profile.activeRules).toEqual(before.profile.activeRules)
    expect(after.profile.pendingCandidates).toHaveLength(1)
  })

  it("rejects a project classification with a personal scope", () => {
    const storeRoot = tempRoot()
    const result = refine(storeRoot, { ...completeRefinement("scope"), classification: "project-decision" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("scope-mismatch")
    expect(existsSync(storeRoot)).toBe(false)
  })

  it("rejects unknown and sensitive refinement fields before any write", () => {
    const storeRoot = tempRoot()
    const unknown = refine(storeRoot, { ...completeRefinement("unknown"), prompt: "raw prompt" })
    const sensitive = refine(storeRoot, { ...completeRefinement("sensitive"), preferredAlternative: "token=do-not-store" })

    expect(unknown.status).toBe(1)
    expect(unknown.stderr).toContain("incomplete")
    expect(sensitive.status).toBe(1)
    expect(sensitive.stderr).toContain("unsafe")
    expect(existsSync(storeRoot)).toBe(false)
  })
})

function tempRoot(): string {
  const root = join(realpathSync(mkdtempSync(join(tmpdir(), "persona-refinement-test-"))), "store")
  roots.push(root)
  return root
}

function refine(storeRoot: string, value: Record<string, unknown>) {
  return runPersonaCli(["philosophy", "refine", "--stdin"], {
    personalizationStoreRoot: storeRoot,
    stdin: `${JSON.stringify(value)}\n`,
  })
}

function completeRefinement(candidateId: string): PhilosophyRefinementInput {
  return {
    candidate: {
      candidateId,
      counterexample: "A local exception may be safer for a bounded task.",
      outcome: "The decision remains explicit and reversible.",
      provenance: { kind: "user", reference: "refinement-1" },
      rationale: "Ownership near the data keeps the boundary reviewable.",
      rule: "Keep behavior with the object that owns its state.",
      schemaVersion: PERSONALIZATION_CANDIDATE_SCHEMA,
      scope: { key: "personal", kind: "personal" },
      topic: "object-ownership",
      tradeoffs: "Some coordination remains in the service layer.",
    },
    classification: "personal-philosophy",
    currentRationale: "The current approach keeps ownership near the data.",
    preferredAlternative: "The alternative makes the boundary explicit.",
    schemaVersion: "personalization-refinement.v1",
    trigger: "explicit-refinement",
  }
}
