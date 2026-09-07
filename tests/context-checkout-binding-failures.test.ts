import { linkSync, readFileSync, readdirSync, realpathSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { runContextCommand } from "../src/cli/context-command.js"
import { readContextPreview } from "../src/cli/context-preview.js"
import { approveProjectRule, checkoutScopeFixture } from "./helpers/context-scope-fixtures.js"
import { cleanupProjects, createProject } from "./helpers/rule-fixtures.js"

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>()
  return { ...actual, linkSync: vi.fn(actual.linkSync), unlinkSync: vi.fn(actual.unlinkSync) }
})

afterEach(() => { cleanupProjects(); vi.clearAllMocks() })

describe("checkout binding fail-closed publication", () => {
  it("rejects a competing binding until an in-progress unbind releases its mutation lock", async () => {
    const input = checkoutScopeFixture()
    approveProjectRule(input)
    approveProjectRule(input, "checkout-b")
    expect(runContextCommand(["scope", "bind", "--project", "checkout-a"], "ph", input).status).toBe(0)
    const actual = await vi.importActual<typeof import("node:fs")>("node:fs")
    let competing: ReturnType<typeof runContextCommand> | undefined
    vi.mocked(unlinkSync).mockImplementationOnce((path) => {
      actual.unlinkSync(path)
      competing = runContextCommand(["scope", "bind", "--project", "checkout-b"], "ph", input)
    })

    const result = runContextCommand(["scope", "unbind", "--project", "checkout-a"], "ph", input)

    expect(result.status).toBe(0)
    expect(competing).toMatchObject({ status: 1, stderr: "context-scope-unavailable\n" })
    expect(JSON.parse(runContextCommand(["scope"], "ph", input).stdout)).toEqual({ status: "unbound" })
    expect(readdirSync(join(input.personalization.storeRoot, "project-bindings"))).toEqual([])
  })

  it("leaves no binding or temporary file when atomic publication fails", () => {
    const input = checkoutScopeFixture()
    approveProjectRule(input)
    vi.mocked(linkSync).mockImplementationOnce(() => { throw Object.assign(new Error("synthetic failure"), { code: "EIO" }) })

    const result = runContextCommand(["scope", "bind", "--project", "checkout-a"], "ph", input)

    expect(result).toMatchObject({ status: 1, stderr: "context-scope-unavailable\n" })
    expect(readdirSync(join(input.personalization.storeRoot, "project-bindings"))).toEqual([])
    expect(JSON.parse(runContextCommand(["scope"], "ph", input).stdout)).toEqual({ status: "unbound" })
  })

  it("does not follow a symlinked binding directory during explicit creation", () => {
    const input = checkoutScopeFixture()
    approveProjectRule(input)
    const outside = realpathSync(createProject())
    symlinkSync(outside, join(input.personalization.storeRoot, "project-bindings"), "dir")

    const result = runContextCommand(["scope", "bind", "--project", "checkout-a"], "ph", input)

    expect(result).toMatchObject({ status: 1, stderr: "context-scope-unavailable\n" })
    expect(readdirSync(outside)).toEqual([])
  })

  it("blocks a copied record even when it is placed at another checkout's expected filename", () => {
    const first = checkoutScopeFixture()
    const second = { ...checkoutScopeFixture(), personalization: first.personalization }
    approveProjectRule(first)
    expect(runContextCommand(["scope", "bind", "--project", "checkout-a"], "ph", first).status).toBe(0)
    const directory = join(first.personalization.storeRoot, "project-bindings")
    const original = readdirSync(directory)[0]
    if (original === undefined) throw new Error("expected original binding")
    expect(runContextCommand(["scope", "bind", "--project", "checkout-a"], "ph", second).status).toBe(0)
    const other = readdirSync(directory).find((name) => name !== original)
    if (other === undefined) throw new Error("expected second binding")
    writeFileSync(join(directory, other), readFileSync(join(directory, original)))

    const result = readContextPreview(["src/App.java"], second.projectDir, second)

    expect(result).toEqual({ status: "blocked", code: "context-scope-unavailable" })
  })
})
