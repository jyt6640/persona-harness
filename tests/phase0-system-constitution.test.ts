import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import type { Model } from "@opencode-ai/sdk"
import { afterEach, describe, expect, it } from "vitest"

import { createPhase0Hooks } from "../src/runtime/hooks.js"
import { SYSTEM_CONSTITUTION_MARKER } from "../src/runtime/system-constitution.js"

const tempProjects: string[] = []

function createProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-system-constitution-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

function writeHarnessConfig(projectDir: string, config: Record<string, unknown>): void {
  mkdirSync(join(projectDir, ".persona"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "harness.jsonc"), `${JSON.stringify(config, null, 2)}\n`)
}

function testModel(): Model {
  return {
    api: {
      id: "test-api",
      npm: "@test/provider",
      url: "http://localhost",
    },
    capabilities: {
      attachment: false,
      input: {
        audio: false,
        image: false,
        pdf: false,
        text: true,
        video: false,
      },
      output: {
        audio: false,
        image: false,
        pdf: false,
        text: true,
        video: false,
      },
      reasoning: false,
      temperature: false,
      toolcall: true,
    },
    cost: {
      cache: {
        read: 0,
        write: 0,
      },
      input: 0,
      output: 0,
    },
    headers: {},
    id: "test-model",
    limit: {
      context: 8192,
      output: 2048,
    },
    name: "Test Model",
    options: {},
    providerID: "test",
    status: "active",
  }
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("Phase 0 system constitution hook", () => {
  it("injects the PH system constitution once by default", async () => {
    const projectDir = createProject()
    const hooks = createPhase0Hooks({ projectDir })
    const output = { system: ["Existing host system prompt."] }

    await hooks["experimental.chat.system.transform"]?.({ model: testModel() }, output)
    await hooks["experimental.chat.system.transform"]?.({ model: testModel() }, output)

    const joinedSystem = output.system.join("\n")
    expect(output.system).toHaveLength(2)
    expect(joinedSystem.match(/\[Persona Harness System Constitution\]/g)).toHaveLength(1)
    expect(joinedSystem).toContain("Turn-local intent reset")
    expect(joinedSystem).toContain("Context-completion gate")
    expect(joinedSystem).toContain("Finish guard")
    expect(joinedSystem).toContain("System prompt text is still prose and may be ignored")
  })

  it("does not inject when systemConstitution is disabled", async () => {
    const projectDir = createProject()
    writeHarnessConfig(projectDir, { enforce: { systemConstitution: false } })
    const hooks = createPhase0Hooks({ projectDir })
    const output = { system: ["Existing host system prompt."] }

    await hooks["experimental.chat.system.transform"]?.({ model: testModel() }, output)

    expect(output.system).toEqual(["Existing host system prompt."])
  })

  it("does not duplicate an existing PH constitution marker", async () => {
    const projectDir = createProject()
    const hooks = createPhase0Hooks({ projectDir })
    const output = { system: [`${SYSTEM_CONSTITUTION_MARKER}\nexisting`] }

    await hooks["experimental.chat.system.transform"]?.({ model: testModel() }, output)

    expect(output.system).toEqual([`${SYSTEM_CONSTITUTION_MARKER}\nexisting`])
  })
})
