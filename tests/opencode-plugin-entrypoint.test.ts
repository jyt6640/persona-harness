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
      "./context-external-validation": "./dist/context-external-validation.js",
      "./effective-profile": "./dist/effective-profile.js",
      "./portable-skill": "./dist/portable-skill.js",
    })
  })

  it("leaves host skill settings unchanged because ph init materializes project adapters", async () => {
    const config: Record<string, unknown> = {
      skills: {
        paths: ["/tmp/custom-skills"],
        urls: ["https://example.test/skills"],
      },
    }

    await applyPluginConfig(config)

    expect(config).toEqual({
      skills: {
        paths: ["/tmp/custom-skills"],
        urls: ["https://example.test/skills"],
      },
    })
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
