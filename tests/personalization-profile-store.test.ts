import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { homedir, tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  PERSONALIZATION_HISTORY_SCHEMA,
  PERSONALIZATION_PROFILE_SCHEMA,
  PERSONALIZATION_RULE_SCHEMA,
  PERSONALIZATION_CANDIDATE_SCHEMA,
  resolvePersonalizationStoreRoot,
  readPersonalizationStore,
  type PersonalizationStoreDocument,
} from "../src/cli/personalization-profile-store.js"
import { runPersonaCli } from "../src/cli/index.js"

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { force: true, recursive: true })
})

describe("personalization profile store", () => {
  it("resolves PH_HOME, Windows APPDATA, XDG, then the home fallback", () => {
    expect(resolvePersonalizationStoreRoot({
      env: { PH_HOME: "/private/ph", APPDATA: "/private/appdata", XDG_CONFIG_HOME: "/private/xdg", HOME: "/private/home" },
      platform: "linux",
    })).toBe("/private/ph")
    expect(resolvePersonalizationStoreRoot({
      env: { APPDATA: "C:\\Users\\dev\\AppData\\Roaming", XDG_CONFIG_HOME: "C:\\xdg", USERPROFILE: "C:\\Users\\dev" },
      platform: "win32",
    })).toBe("C:\\Users\\dev\\AppData\\Roaming\\persona-harness")
    expect(resolvePersonalizationStoreRoot({
      env: { XDG_CONFIG_HOME: "/private/xdg", HOME: "/private/home" },
      platform: "linux",
    })).toBe("/private/xdg/persona-harness")
    expect(resolvePersonalizationStoreRoot({ env: { HOME: "/private/home" }, platform: "linux" })).toBe("/private/home/.config/persona-harness")
  })

  it("inspects the starter profile without creating a personal store", () => {
    const storeRoot = tempRoot()
    const result = runPersonaCli(["philosophy", "status"], { personalizationStoreRoot: storeRoot })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("starter")
    expect(result.stdout).not.toContain(storeRoot)
    expect(existsSync(storeRoot)).toBe(false)
  })

  it("activates a complete non-conflicting candidate and records versioned state", () => {
    const storeRoot = tempRoot()
    const candidate = completeCandidate("candidate-a")
    const result = propose(storeRoot, candidate)

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("activated")
    const document = readStoredDocument(storeRoot)
    expect(document.profile.schemaVersion).toBe(PERSONALIZATION_PROFILE_SCHEMA)
    expect(document.profile.activeRules[0]).toMatchObject({
      schemaVersion: PERSONALIZATION_RULE_SCHEMA,
      ruleId: "rule-candidate-a",
      topic: "object-ownership",
    })
    expect(document.profile.pendingCandidates).toEqual([])
    expect(document.profile.decisions[0]).toMatchObject({
      schemaVersion: "personalization-decision.v1",
      action: "activate",
    })
    expect(document.history.schemaVersion).toBe(PERSONALIZATION_HISTORY_SCHEMA)
    expect(document.history.events[0]).toMatchObject({
      schemaVersion: PERSONALIZATION_HISTORY_SCHEMA,
      event: "activated",
    })
    expect(JSON.stringify(document)).not.toContain("prompt")
    expect(JSON.stringify(document)).not.toContain(storeRoot)
  })

  it("keeps same-topic overlapping candidates pending without overwriting active state", () => {
    const storeRoot = tempRoot()
    propose(storeRoot, completeCandidate("candidate-a"))
    const result = propose(storeRoot, completeCandidate("candidate-b"))

    expect(result.status).toBe(1)
    expect(result.stdout).toContain("conflict")
    const document = readStoredDocument(storeRoot)
    expect(document.profile.activeRules.map((rule: { ruleId: string }) => rule.ruleId)).toEqual(["rule-candidate-a"])
    expect(document.profile.pendingCandidates.map((item: { candidateId: string }) => item.candidateId)).toEqual(["candidate-b"])
  })

  it("allows explicit retain, project/task exception, supersede, pending, and append-only rollback", () => {
    const storeRoot = tempRoot()
    propose(storeRoot, completeCandidate("candidate-a"))
    propose(storeRoot, completeCandidate("candidate-b"))
    expect(resolve(storeRoot, "candidate-b", "retain").status).toBe(0)

    propose(storeRoot, completeCandidate("candidate-c"))
    expect(resolve(storeRoot, "candidate-c", "exception", "project", "checkout").status).toBe(0)
    expect(readStoredDocument(storeRoot).profile.activeRules).toHaveLength(2)

    propose(storeRoot, completeCandidate("candidate-d", { scopeKey: "checkout" }))
    expect(resolve(storeRoot, "candidate-d", "supersede").status).toBe(0)
    const beforeRollback = readStoredDocument(storeRoot)
    const activeRule = beforeRollback.profile.activeRules.find((rule: { scope: { kind: string; key: string } }) => rule.scope.kind === "project" && rule.scope.key === "checkout")
    if (activeRule === undefined) throw new Error("expected project rule")

    expect(runPersonaCli(["philosophy", "rollback", activeRule.ruleId], { personalizationStoreRoot: storeRoot }).status).toBe(0)
    const afterRollback = readStoredDocument(storeRoot)
    expect(afterRollback.profile.activeRules.some((rule: { ruleId: string }) => rule.ruleId === activeRule.ruleId)).toBe(false)
    expect(afterRollback.history.events.at(-1)).toMatchObject({ event: "rollback" })
    expect(afterRollback.history.events.length).toBeGreaterThan(beforeRollback.history.events.length)

    const pendingRoot = tempRoot()
    expect(propose(pendingRoot, completeCandidate("candidate-pending"), ["--pending"]).status).toBe(0)
    const pending = readStoredDocument(pendingRoot)
    expect(pending.profile.activeRules).toEqual([])
    expect(pending.profile.pendingCandidates).toHaveLength(1)
  })

  it("rejects partial, unknown, sensitive, and absolute-path candidates without mutation", () => {
    const storeRoot = tempRoot()
    const valid = propose(storeRoot, completeCandidate("candidate-a"))
    expect(valid.status).toBe(0)
    const before = readFileSync(join(storeRoot, "profile.json"), "utf8")

    const invalidCandidates = [
      { ...completeCandidate("partial"), rationale: undefined },
      { ...completeCandidate("unknown"), prompt: "raw prompt" },
      { ...completeCandidate("secret"), outcome: "token=do-not-store" },
      { ...completeCandidate("path"), rule: "Use /Users/example/project directly." },
    ]
    for (const candidate of invalidCandidates) {
      const result = propose(storeRoot, candidate)
      expect(result.status).toBe(1)
      expect(result.stdout).toBe("")
      expect(readFileSync(join(storeRoot, "profile.json"), "utf8")).toBe(before)
    }
  })

  it("fails closed on corrupt or symlinked state without changing active state", () => {
    const storeRoot = tempRoot()
    mkdirSync(storeRoot, { recursive: true })
    writeFileSync(join(storeRoot, "profile.json"), "{broken", "utf8")
    const corrupt = runPersonaCli(["philosophy", "status"], { personalizationStoreRoot: storeRoot })
    expect(corrupt.status).toBe(1)
    expect(corrupt.stderr).toContain("personalization-store-corrupt")

    const symlinkRoot = tempRoot()
    const target = tempRoot()
    symlinkSync(target, symlinkRoot, "dir")
    expect(() => readPersonalizationStore({ storeRoot: symlinkRoot })).toThrow("personalization-store-unsafe")
    expect(lstatSync(symlinkRoot).isSymbolicLink()).toBe(true)
  })
})

function tempRoot(): string {
  const root = join(mkdtempSync(join(tmpdir(), "persona-philosophy-test-")), "store")
  roots.push(root)
  return root
}

function completeCandidate(candidateId: string, options: { readonly scopeKey?: string } = {}): Record<string, unknown> {
  return {
    candidateId,
    counterexample: "A small task may need a local exception.",
    outcome: "The decision is easier to review and revisit.",
    provenance: { kind: "user", reference: "conversation-1" },
    rationale: "Keeping ownership near the data makes the boundary explicit.",
    rule: "Keep behavior with the object that owns its state.",
    schemaVersion: PERSONALIZATION_CANDIDATE_SCHEMA,
    scope: { key: options.scopeKey ?? "personal", kind: options.scopeKey === undefined ? "personal" : "project" },
    topic: "object-ownership",
    tradeoffs: "Some coordination code remains in the service layer.",
  }
}

function propose(storeRoot: string, candidate: Record<string, unknown>, extra: readonly string[] = []) {
  return runPersonaCli(["philosophy", "propose", "--stdin", ...extra], {
    stdin: `${JSON.stringify(candidate)}\n`,
    personalizationStoreRoot: storeRoot,
  })
}

function resolve(storeRoot: string, candidateId: string, action: string, scopeKind?: string, scopeKey?: string) {
  const args = ["philosophy", "resolve", candidateId, action]
  if (scopeKind !== undefined && scopeKey !== undefined) args.push("--scope", scopeKind, "--scope-key", scopeKey)
  return runPersonaCli(args, { personalizationStoreRoot: storeRoot })
}

function readStoredDocument(storeRoot: string): PersonalizationStoreDocument {
  return JSON.parse(readFileSync(join(storeRoot, "profile.json"), "utf8")) as PersonalizationStoreDocument
}
