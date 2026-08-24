import { readFileSync } from "node:fs"
import { join } from "node:path"
import type { Plugin } from "@opencode-ai/plugin"
import { describe, expect, it } from "vitest"

import * as pluginEntry from "../src/index.js"
import { PersonaHarnessPlugin } from "../src/index.js"

async function applyPluginConfig(config: Record<string, unknown>): Promise<void> {
  const hooks = await PersonaHarnessPlugin({ client: {}, directory: process.cwd() } as Parameters<Plugin>[0])
  const configure = hooks.config
  if (configure === undefined) {
    throw new Error("expected Persona Harness to expose the OpenCode config hook")
  }
  await configure(config as Parameters<typeof configure>[0])
}

describe("OpenCode plugin entrypoint", () => {
  it("exposes one named legacy plugin function for the host loader", () => {
    const plugin: Plugin = PersonaHarnessPlugin
    const callableExportNames = Object.entries(pluginEntry)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name)

    expect(plugin).toBe(PersonaHarnessPlugin)
    expect(callableExportNames).toEqual(["PersonaHarnessPlugin"])
  })

  it("keeps effective-profile APIs on an explicit package subpath", () => {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"))

    expect(packageJson.exports).toEqual({
      ".": "./dist/index.js",
      "./effective-profile": "./dist/effective-profile.js",
      "./portable-skill": "./dist/portable-skill.js",
    })
  })

  it("registers the packaged shared-skill catalog without replacing valid user settings", async () => {
    const config: Record<string, unknown> = {
      skills: {
        paths: ["/tmp/custom-skills"],
        urls: ["https://example.test/skills"],
      },
    }

    await applyPluginConfig(config)

    expect(config).toEqual({
      skills: {
        paths: ["/tmp/custom-skills", join(process.cwd(), "packages", "shared-skills", "skills")],
        urls: ["https://example.test/skills"],
      },
    })
  })

  it("also appends the catalog to a future array-shaped skill source setting", async () => {
    const config: Record<string, unknown> = {
      skills: ["/tmp/custom-skills", "https://example.test/skills"],
    }

    await applyPluginConfig(config)

    expect(config).toEqual({
      skills: [
        "/tmp/custom-skills",
        "https://example.test/skills",
        join(process.cwd(), "packages", "shared-skills", "skills"),
      ],
    })
  })

  it("creates a native OpenCode skill path when the consumer has none", async () => {
    const config: Record<string, unknown> = {}

    await applyPluginConfig(config)

    expect(config).toEqual({
      skills: {
        paths: [join(process.cwd(), "packages", "shared-skills", "skills")],
      },
    })
  })

  it("does not duplicate the packaged shared-skill catalog", async () => {
    const packagedSkillsPath = join(process.cwd(), "packages", "shared-skills", "skills")
    const config: Record<string, unknown> = { skills: { paths: [packagedSkillsPath] } }

    await applyPluginConfig(config)

    expect(config).toEqual({ skills: { paths: [packagedSkillsPath] } })
  })

  it.each([
    { skills: { paths: ["/tmp/custom-skills", 7] } },
    { skills: ["/tmp/custom-skills", 7] },
    { skills: { paths: "/tmp/custom-skills" } },
  ])("leaves an invalid user skill source setting untouched", async (config) => {
    const original = structuredClone(config)

    await applyPluginConfig(config)

    expect(config).toEqual(original)
  })
})
