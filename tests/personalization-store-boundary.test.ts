import * as fs from "node:fs"
import { join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  emptyPersonalizationStore, proposePersonalizationCandidate, readPersonalizationStore,
  writePersonalizationStore,
} from "../src/cli/personalization-profile-store.js"
import { cleanupProjects, createProject } from "./helpers/rule-fixtures.js"

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>()
  return { ...actual, readFileSync: vi.fn(actual.readFileSync), readSync: vi.fn(actual.readSync), writeFileSync: vi.fn(actual.writeFileSync) }
})

afterEach(() => { vi.resetAllMocks(); cleanupProjects() })

function fixture() {
  const root = fs.realpathSync(createProject())
  const storeRoot = join(root, "store")
  fs.mkdirSync(storeRoot)
  writePersonalizationStore(emptyPersonalizationStore(), { storeRoot })
  return { root, storeRoot, profile: join(storeRoot, "profile.json") }
}

function candidate(id: string) {
  return {
    schemaVersion: "personalization-candidate.v1", candidateId: id, topic: id,
    rule: "Keep reviewable decisions explicit.", scope: { kind: "personal", key: "personal" },
    provenance: { kind: "user", reference: "approved-fixture" },
    rationale: "Preserve the approved decision.", outcome: "History retains every successful decision.",
    tradeoffs: "Some metadata is retained.", counterexample: "Reconsider after explicit user approval.",
  }
}

describe("personalization store transaction boundary", () => {
  it.skipIf(process.platform === "win32")("preserves private directory and file modes", () => {
    const { storeRoot, profile } = fixture()
    expect(fs.statSync(storeRoot).mode & 0o777).toBe(0o700)
    expect(fs.statSync(profile).mode & 0o777).toBe(0o600)
  })

  it.skipIf(process.platform === "win32")("retains the private file mode under a restrictive caller umask", () => {
    const { storeRoot, profile } = fixture()
    const prior = process.umask(0o777)
    try { writePersonalizationStore(emptyPersonalizationStore(), { storeRoot }) }
    finally { process.umask(prior) }
    expect(fs.statSync(profile).mode & 0o777).toBe(0o600)
  })

  it("does not report a competing proposal as successful and then discard its history", () => {
    const { storeRoot } = fixture()
    let competing: string | undefined
    const result = proposePersonalizationCandidate(candidate("outer"), {
      storeRoot,
      now: () => {
        try { competing = proposePersonalizationCandidate(candidate("inner"), { storeRoot }).status }
        catch (error) { competing = error instanceof Error ? error.message : "unexpected-error" }
        return new Date("2026-09-07T00:00:00Z")
      },
    })
    expect(result.status).toBe("activated")
    expect.soft(competing).toBe("personalization-store-busy")
    const saved = readPersonalizationStore({ storeRoot })
    expect(saved.history.events).toHaveLength(competing === "activated" ? 2 : 1)
    expect(proposePersonalizationCandidate(candidate("retry"), { storeRoot }).status).toBe("activated")
    expect(readPersonalizationStore({ storeRoot }).history.events).toHaveLength(2)
  })

  it("rejects oversized valid JSON before parsing", () => {
    const { storeRoot, profile } = fixture()
    fs.writeFileSync(profile, `${" ".repeat(8 * 1024 * 1024 + 1)}${JSON.stringify(emptyPersonalizationStore())}`)
    expect(() => readPersonalizationStore({ storeRoot })).toThrow("personalization-store-unsafe")
  })

  it("never accepts a profile replaced by a symlink immediately before a path read", async () => {
    const { root, storeRoot, profile } = fixture()
    const external = join(root, "external.json")
    fs.writeFileSync(external, JSON.stringify(emptyPersonalizationStore()))
    const actual = await vi.importActual<typeof import("node:fs")>("node:fs")
    vi.mocked(fs.readFileSync).mockImplementation((...args) => {
      if (args[0] === profile) {
        fs.unlinkSync(profile)
        fs.symlinkSync(external, profile, "file")
      }
      return actual.readFileSync(...args)
    })
    // A descriptor-based reader never invokes this unsafe path-read hook.
    const saved = readPersonalizationStore({ storeRoot })
    expect(saved).toEqual(emptyPersonalizationStore())
    expect(fs.lstatSync(profile).isSymbolicLink()).toBe(false)
  })

  it("does not write through a store parent replaced just before publication", async () => {
    const { root, storeRoot } = fixture()
    const external = join(root, "external")
    fs.mkdirSync(external)
    const actual = await vi.importActual<typeof import("node:fs")>("node:fs")
    let replaced = false
    vi.mocked(fs.writeFileSync).mockImplementation((...args) => {
      if (!replaced) {
        replaced = true
        fs.renameSync(storeRoot, join(root, "original-store"))
        fs.symlinkSync(external, storeRoot, "dir")
      }
      return actual.writeFileSync(...args)
    })
    expect(() => writePersonalizationStore(emptyPersonalizationStore(), { storeRoot }))
      .toThrow("personalization-store-unsafe")
    expect(fs.readdirSync(external)).toEqual([])
  })

  it.each(["file", "parent"] as const)("rejects %s replacement during descriptor reads", async (kind) => {
    const { root, storeRoot, profile } = fixture()
    const external = join(root, "external")
    fs.mkdirSync(external)
    fs.writeFileSync(join(external, "profile.json"), JSON.stringify(emptyPersonalizationStore()))
    const actual = await vi.importActual<typeof import("node:fs")>("node:fs")
    vi.mocked(fs.readSync).mockImplementationOnce((...args) => {
      const count = actual.readSync(...args)
      if (kind === "file") {
        fs.unlinkSync(profile)
        fs.symlinkSync(join(external, "profile.json"), profile, "file")
      } else {
        fs.renameSync(storeRoot, join(root, "original-store"))
        fs.symlinkSync(external, storeRoot, "dir")
      }
      return count
    })
    expect(() => readPersonalizationStore({ storeRoot })).toThrow("personalization-store-unsafe")
  })
})
