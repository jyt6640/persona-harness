import { existsSync, readFileSync, readdirSync, realpathSync, renameSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runContextCommand } from "../src/cli/context-command.js"
import { readContextPreview } from "../src/cli/context-preview.js"
import { selectContextForTargets } from "../src/context-delivery/context-target-selection.js"
import { approveProjectRule, checkoutScopeFixture as fixture } from "./helpers/context-scope-fixtures.js"
import { cleanupProjects, createProject, writeHarnessConfig } from "./helpers/rule-fixtures.js"

afterEach(cleanupProjects)

describe("explicit checkout-local project scope binding", () => {
  it("stores only a full checkout digest and scope key, not paths or rule text", () => {
    const input = fixture()
    approveProjectRule(input)

    expect(runContextCommand(["scope", "bind", "--project", "checkout-a"], "ph", input).status).toBe(0)

    const directory = join(input.personalization.storeRoot, "project-bindings")
    const files = readdirSync(directory)
    expect(files).toHaveLength(1)
    expect(files[0]).toMatch(/^[a-f0-9]{64}\.json$/u)
    const text = readFileSync(join(directory, files[0] ?? "missing"), "utf8")
    expect(JSON.parse(text)).toEqual({
      schemaVersion: "persona-context-checkout-binding.1",
      checkoutDigest: (files[0] ?? "missing").replace(/\.json$/u, ""),
      projectKey: "checkout-a",
    })
    expect(text).not.toContain(input.projectDir)
    expect(text).not.toContain(input.personalization.storeRoot)
    expect(text).not.toContain("Preserve established public names.")
  })

  it.each(["{", '{"schemaVersion":"unknown"}'])("blocks automatic selection for corrupt binding %j", (text) => {
    const input = fixture()
    approveProjectRule(input)
    expect(runContextCommand(["scope", "bind", "--project", "checkout-a"], "ph", input).status).toBe(0)
    const directory = join(input.personalization.storeRoot, "project-bindings")
    const file = readdirSync(directory)[0]
    if (file === undefined) throw new Error("expected binding file")
    writeFileSync(join(directory, file), text)

    const result = readContextPreview(["src/App.java"], input.projectDir, input)

    expect(result).toEqual({ status: "blocked", code: "context-scope-unavailable" })
    expect(selectContextForTargets(input.projectDir, ["src/App.java"], input))
      .toEqual({ status: "blocked", reason: "preview-unavailable" })
    expect(runContextCommand(["scope", "bind", "--project", "checkout-a"], "ph", input).status).toBe(1)
    expect(readFileSync(join(directory, file), "utf8")).toBe(text)
  })

  it("rejects a symlinked binding without reading, replacing or removing its target", () => {
    const input = fixture()
    approveProjectRule(input)
    expect(runContextCommand(["scope", "bind", "--project", "checkout-a"], "ph", input).status).toBe(0)
    const directory = join(input.personalization.storeRoot, "project-bindings")
    const file = readdirSync(directory)[0]
    if (file === undefined) throw new Error("expected binding file")
    const target = join(realpathSync(createProject()), "user-owned.txt")
    writeFileSync(target, "user-owned content")
    unlinkSync(join(directory, file))
    symlinkSync(target, join(directory, file))

    const result = runContextCommand(["scope", "unbind", "--project", "checkout-a"], "ph", input)

    expect(result).toMatchObject({ status: 1, stderr: "context-scope-unavailable\n" })
    expect(readFileSync(target, "utf8")).toBe("user-owned content")
  })

  it("does not reuse a binding after the checkout moves", () => {
    const input = fixture()
    approveProjectRule(input)
    expect(runContextCommand(["scope", "bind", "--project", "checkout-a"], "ph", input).status).toBe(0)
    const moved = join(realpathSync(createProject()), "moved")
    renameSync(input.projectDir, moved)

    const result = runContextCommand(["scope"], "ph", { ...input, projectDir: moved })

    expect(JSON.parse(result.stdout)).toEqual({ status: "unbound" })
  })

  it("preserves explicit opt-out even with a bound project", () => {
    const input = fixture()
    approveProjectRule(input)
    expect(runContextCommand(["scope", "bind", "--project", "checkout-a"], "ph", input).status).toBe(0)
    writeHarnessConfig(input.projectDir, { context: { enabled: false } })

    const result = selectContextForTargets(input.projectDir, ["src/App.java"], input)

    expect(result).toEqual({ status: "skipped", reason: "context-disabled" })
  })

  it("reports an unbound checkout without creating personal state", () => {
    const input = fixture()

    const result = runContextCommand(["scope"], "ph", input)

    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout)).toEqual({ status: "unbound" })
    expect(existsSync(input.personalization.storeRoot)).toBe(false)
  })

  it("rejects a binding without an active matching project rule", () => {
    const input = fixture()

    const result = runContextCommand(["scope", "bind", "--project", "checkout-a"], "ph", input)

    expect(result).toMatchObject({ status: 1, stderr: "context-scope-rule-missing\n" })
    expect(existsSync(input.personalization.storeRoot)).toBe(false)
  })

  it("reuses an approved binding automatically without changing the profile or project config", () => {
    const input = fixture()
    approveProjectRule(input)
    const profilePath = join(input.personalization.storeRoot, "profile.json")
    const configPath = join(input.projectDir, ".persona", "harness.jsonc")
    const originalProfile = readFileSync(profilePath)
    const originalConfig = readFileSync(configPath)

    const result = runContextCommand(["scope", "bind", "--project", "checkout-a"], "ph", input)

    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout)).toEqual({ status: "bound", projectKey: "checkout-a" })
    expect(readContextPreview(["src/App.java", "--topic", "naming"], input.projectDir, input))
      .toMatchObject({ preview: { resolution: { selected: [{ id: "rule-approved-checkout-a", layer: "project" }] }, envelope: { warnings: [] } } })
    const delivery = selectContextForTargets(input.projectDir, ["src/App.java"], input)
    expect(delivery).toMatchObject({ status: "selected", ruleIds: expect.arrayContaining(["rule-approved-checkout-a"]) })
    expect(readFileSync(profilePath)).toEqual(originalProfile)
    expect(readFileSync(configPath)).toEqual(originalConfig)
  })

  it("does not carry a binding into another checkout sharing the same personal profile", () => {
    const input = fixture()
    approveProjectRule(input)
    expect(runContextCommand(["scope", "bind", "--project", "checkout-a"], "ph", input).status).toBe(0)
    const otherDir = realpathSync(createProject())
    writeHarnessConfig(otherDir, { context: { enabled: true, maxCapsules: 16, maxChars: 4_000 } })

    const result = readContextPreview(["src/App.java"], otherDir, input)

    expect(result).toMatchObject({ preview: { envelope: { warnings: [{ code: "project-scope-unbound" }] } } })
    if (result.status !== "ready") throw new Error("expected inspectable unbound checkout")
    expect(result.preview.resolution.selected.every((rule) => rule.layer !== "project")).toBe(true)
  })

  it("requires the existing key to unbind and never overwrites another binding", () => {
    const input = fixture()
    approveProjectRule(input)
    approveProjectRule(input, "checkout-b")
    expect(runContextCommand(["scope", "bind", "--project", "checkout-a"], "ph", input).status).toBe(0)

    const replacement = runContextCommand(["scope", "bind", "--project", "checkout-b"], "ph", input)

    expect(replacement).toMatchObject({ status: 1, stderr: "context-scope-existing-binding\n" })
    expect(runContextCommand(["scope", "unbind", "--project", "checkout-b"], "ph", input))
      .toMatchObject({ status: 1, stderr: "context-scope-key-mismatch\n" })
    expect(runContextCommand(["scope", "unbind", "--project", "checkout-a"], "ph", input).status).toBe(0)
    expect(JSON.parse(runContextCommand(["scope"], "ph", input).stdout)).toEqual({ status: "unbound" })
  })
})
