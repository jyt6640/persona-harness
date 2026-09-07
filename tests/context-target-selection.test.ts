import { mkdirSync, realpathSync, symlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { readContextPreview } from "../src/cli/context-preview.js"
import * as personalizationSource from "../src/cli/context-personalization.js"
import { proposePersonalizationCandidate, readPersonalizationStore, writePersonalizationStore } from "../src/cli/personalization-profile-store.js"
import { selectContextForTargets } from "../src/context-delivery/context-target-selection.js"
import { cleanupProjects, createProject, writeHarnessConfig } from "./helpers/rule-fixtures.js"

afterEach(() => { vi.restoreAllMocks(); cleanupProjects() })

function fixture(maxChars = 4_000) {
  const projectDir = realpathSync(createProject())
  const options = { personalization: { storeRoot: join(projectDir, "personalization") } }
  writeHarnessConfig(projectDir, { context: { enabled: true, maxCapsules: 16, maxChars } })
  mkdirSync(join(projectDir, ".persona"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "team-profile.json"), JSON.stringify({
    schemaVersion: "persona-team-profile.v1", teamKey: "team",
    rules: [
      { id: "service.atomic", topic: "transactions", rule: "Make the transfer atomic.", fileRoles: ["service"], status: "active" },
      { id: "controller.response", topic: "responses", rule: "Preserve the public error response.", fileRoles: ["controller"], status: "active" },
    ],
  }))
  return { options, projectDir }
}

describe("multi-file Context selection", () => {
  it("uses one profile snapshot across a batch and refreshes on the next batch", () => {
    const { projectDir, options } = fixture()
    proposePersonalizationCandidate({
      schemaVersion: "personalization-candidate.v1", candidateId: "audit-format", topic: "audit-format",
      rule: "Use the first approved audit format.", scope: { kind: "personal", key: "personal" },
      rationale: "Keep the audit format consistent.", outcome: "All changed files use the same format.",
      counterexample: "Reconsider after an approved format change.", tradeoffs: "One format across modules.",
      provenance: { kind: "user", reference: "synthetic-approved-fixture" },
    }, options.personalization)
    const read = personalizationSource.readContextPersonalization
    let reads = 0
    const spy = vi.spyOn(personalizationSource, "readContextPersonalization").mockImplementation((store, keys) => {
      const snapshot = read(store, keys)
      if (++reads === 1) {
        const document = readPersonalizationStore(options.personalization)
        writePersonalizationStore({ ...document, profile: { ...document.profile, activeRules: document.profile.activeRules.map((rule) => ({ ...rule, rule: "Use the second approved audit format." })) } }, options.personalization)
      }
      return snapshot
    })
    const targets = ["src/TransferService.java", "src/TransferController.java"]
    const first = selectContextForTargets(projectDir, targets, options)
    if (first.status !== "selected") throw new Error("fixture not selected")
    expect(first.block).toContain("Use the first approved audit format.")
    expect(first.block).not.toContain("Use the second approved audit format.")
    expect(spy).toHaveBeenCalledTimes(1)
    const next = selectContextForTargets(projectDir, targets, options)
    if (next.status !== "selected") throw new Error("fixture not selected")
    expect(next.block).toContain("Use the second approved audit format.")
    expect(next.block).not.toContain("Use the first approved audit format.")
  })

  it("preserves both file-specific decisions and deduplicates shared rules", () => {
    const { projectDir, options } = fixture()
    const result = selectContextForTargets(projectDir, ["src/TransferService.java", "src/TransferController.java"], options)
    expect(result.status).toBe("selected")
    if (result.status !== "selected") throw new Error("fixture not selected")
    expect(result.block).toContain('For "src/TransferService.java": Make the transfer atomic.')
    expect(result.block).toContain('For "src/TransferController.java": Preserve the public error response.')
    expect(result.block.match(/Require evidence before claiming completion\./gu)).toHaveLength(1)
    expect(result.usedChars).toBe(result.block.length)
    expect(result.warningCodes).toEqual(["personal-profile-missing"])
  })

  it("uses Preview's full character count for one target, including profile notices", () => {
    const { projectDir, options } = fixture()
    const preview = readContextPreview(["src/TransferService.java"], projectDir, options)
    const selection = selectContextForTargets(projectDir, ["src/TransferService.java"], options)
    if (preview.status !== "ready" || selection.status !== "selected") throw new Error("fixture not selected")
    expect(selection.usedChars).toBe(preview.preview.envelope.budget.usedChars)
  })

  it("blocks the complete selection when the union no longer fits", () => {
    const { projectDir, options } = fixture()
    const single = selectContextForTargets(projectDir, ["src/TransferService.java"], options)
    if (single.status !== "selected") throw new Error("fixture not selected")
    writeHarnessConfig(projectDir, { context: { enabled: true, maxCapsules: 16, maxChars: single.usedChars + 10 } })
    expect(selectContextForTargets(projectDir, ["src/TransferService.java", "src/TransferController.java"], options))
      .toEqual({ status: "blocked", reason: "budget-exceeded" })
  })

  it("does not deliver a safe prefix when another target escapes or follows a symlink", () => {
    const { projectDir, options } = fixture()
    const outside = realpathSync(createProject())
    symlinkSync(outside, join(projectDir, "linked"), "dir")
    for (const unsafe of ["../outside.java", "linked/a.java"]) {
      expect(selectContextForTargets(projectDir, ["src/TransferService.java", unsafe], options))
        .toEqual({ status: "blocked", reason: "target-invalid" })
    }
  })

  it("honors an explicit opt-out independently of legacy injection", () => {
    const { projectDir, options } = fixture()
    writeHarnessConfig(projectDir, { context: { enabled: false }, features: { runtimeInjection: true } })
    expect(selectContextForTargets(projectDir, ["src/TransferService.java"], options))
      .toEqual({ status: "skipped", reason: "context-disabled" })
  })
})
