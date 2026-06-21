import { writeFileSync } from "node:fs"

import { afterEach, describe, expect, it } from "vitest"

import { createInjectionBlock } from "../src/phase0/injection.js"
import { createPhase0Hooks } from "../src/phase0/hooks.js"
import { loadHarnessConfig, loadHarnessConfigResult } from "../src/phase0/harness-config.js"
import { loadRulesForRole } from "../src/phase0/rule-loader.js"
import type { TransformMessagesOutput } from "../src/phase0/types.js"
import { cleanupProjects, createProject, writeHarnessConfig, writeRule } from "./helpers/rule-fixtures.js"

afterEach(cleanupProjects)

function emptyModelInput(sessionID: string): TransformMessagesOutput {
  return {
    messages: [
      {
        info: {
          id: "msg-1",
          sessionID,
          role: "user",
          time: { created: Date.now() },
          agent: "build",
          model: {
            providerID: "test",
            modelID: "test-model",
          },
        },
        parts: [
          {
            id: "part-1",
            sessionID,
            messageID: "msg-1",
            type: "text",
            text: "예약 API를 수정해줘.",
          },
        ],
      },
    ],
  }
}

describe("Phase 0 harness config", () => {
  it("defaults to the Java backend MVP domains only", () => {
    const projectDir = createProject()

    const config = loadHarnessConfig(projectDir)

    expect(config.enabledDomains).toEqual(["backend", "programming"])
  })

  it("keeps malformed config diagnostics-only while falling back to defaults", () => {
    const projectDir = createProject()
    writeHarnessConfig(projectDir, { enabledDomains: ["frontend"] })
    writeFileSync(`${projectDir}/.persona/harness.jsonc`, "{ broken jsonc")

    const result = loadHarnessConfigResult(projectDir)
    const injection = createInjectionBlock("README.md", projectDir)

    expect(result.config.enabledDomains).toEqual(["backend", "programming"])
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "malformed_config",
        message: expect.stringContaining("Failed to parse .persona/harness.jsonc"),
      }),
    ])
    expect(injection.selectedHarnessConfigDiagnostics).toEqual(result.diagnostics)
    expect(injection.block).toContain("설정 진단:")
    expect(injection.block).toContain("malformed_config")
  })

  it("uses rulesDir from harness.jsonc", () => {
    const projectDir = createProject()
    writeHarnessConfig(projectDir, { rulesDir: ".persona/custom-rules" })
    writeRule(
      projectDir,
      "../custom-rules/backend/spring-controller.md",
      `
id: backend.spring.controller
source: backend-policy
domain: backend
topic: controller-responsibility
globs:
  - "**/*Controller.java"
severity: must
`,
      ["custom controller policy"],
    )

    const loadedRules = loadRulesForRole(projectDir, "controller", "src/main/java/ReservationController.java")

    expect(loadedRules.find((rule) => rule.path === "backend/spring-controller.md")?.policies).toEqual([
      "custom controller policy",
    ])
  })

  it("uses maxRulesPerInjection from harness.jsonc", () => {
    const projectDir = createProject()
    writeHarnessConfig(projectDir, { maxRulesPerInjection: 1 })
    writeRule(
      projectDir,
      "clean-code/common.md",
      `
id: clean-code.common
source: clean-code
domain: common
topic: readability
globs:
  - "**/*.java"
severity: must
`,
      ["first policy", "second policy"],
    )

    const injection = createInjectionBlock("src/main/java/ReservationController.java", projectDir)

    expect(injection.policies).toHaveLength(1)
  })

  it("does not inject when the harness is disabled", async () => {
    const projectDir = createProject()
    writeHarnessConfig(projectDir, { enabled: false })
    const hooks = createPhase0Hooks({ projectDir })
    const output = emptyModelInput("disabled-session")

    await hooks["tool.execute.before"]?.(
      { tool: "read", sessionID: "disabled-session", callID: "call-1" },
      { args: { filePath: "src/main/java/ReservationController.java" } },
    )
    await hooks["experimental.chat.messages.transform"]?.({}, output)

    const part = output.messages[0]?.parts[0]
    expect(part?.type === "text" ? part.text : "").not.toContain("[Persona Harness Injection]")
  })

  it("does not inject when backend is not an enabled domain", async () => {
    const projectDir = createProject()
    writeHarnessConfig(projectDir, { enabledDomains: ["frontend"] })
    const hooks = createPhase0Hooks({ projectDir })
    const output = emptyModelInput("domain-session")

    await hooks["tool.execute.before"]?.(
      { tool: "read", sessionID: "domain-session", callID: "call-1" },
      { args: { filePath: "src/main/java/ReservationController.java" } },
    )
    await hooks["experimental.chat.messages.transform"]?.({}, output)

    const part = output.messages[0]?.parts[0]
    expect(part?.type === "text" ? part.text : "").not.toContain("[Persona Harness Injection]")
  })
})
