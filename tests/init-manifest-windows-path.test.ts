import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => {
  vi.doUnmock("node:path")
  vi.resetModules()
})

describe("init manifest Windows path handling", () => {
  it("accepts slash-separated owned paths when the host resolver adds a drive prefix", async () => {
    vi.resetModules()
    vi.doMock("node:path", async () => {
      const actual = await vi.importActual<typeof import("node:path")>("node:path")
      return {
        ...actual,
        relative: actual.win32.relative,
        resolve: (...segments: string[]) => actual.win32.resolve("D:\\", ...segments.filter((segment) => segment !== "/")),
        sep: actual.win32.sep,
      }
    })

    const { createInitManifest, parseInitManifestBytes } = await import("../src/cli/init-manifest.js")
    const manifest = createInitManifest(
      {
        name: "persona-harness",
        templateDigest: "a".repeat(64),
        version: "0.8.6",
      },
      {
        profileDigest: null,
        realPath: "D:\\fixture",
      },
      [{
        digest: "b".repeat(64),
        marker: "ph-init-owned-v1",
        owner: "persona-harness",
        path: ".persona/harness.jsonc",
      }],
    )

    expect(parseInitManifestBytes(Buffer.from(JSON.stringify(manifest))).files.map((entry) => entry.path)).toEqual([
      ".persona/harness.jsonc",
    ])
  })
})
