import type { Plugin } from "@opencode-ai/plugin"
import { describe, expect, it } from "vitest"

import * as pluginEntry from "../src/index.js"
import { PersonaHarnessPlugin } from "../src/index.js"

describe("OpenCode plugin entrypoint", () => {
  it("exposes one named legacy plugin function for the host loader", () => {
    const plugin: Plugin = PersonaHarnessPlugin
    const callableExportNames = Object.entries(pluginEntry)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name)

    expect(plugin).toBe(PersonaHarnessPlugin)
    expect(callableExportNames).toEqual(["PersonaHarnessPlugin"])
  })
})
