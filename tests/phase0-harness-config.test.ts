import { writeFileSync } from "node:fs"

import { afterEach, describe, expect, it } from "vitest"

import { createInjectionBlock } from "../src/runtime/injection.js"
import { createPhase0Hooks } from "../src/runtime/hooks.js"
import { CONTROLLER_REPOSITORY_CONVENTION } from "../src/config/convention-registry.js"
import { loadHarnessConfig, loadHarnessConfigResult } from "../src/config/harness-config.js"
import { loadRulesForRole } from "../src/rules/rule-loader.js"
import type { TransformMessagesOutput } from "../src/runtime/types.js"
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
  it("defaults to Java backend MVP and AI workflow domains", () => {
    const projectDir = createProject()

    const config = loadHarnessConfig(projectDir)

    expect(config.enabledDomains).toEqual(["backend", "programming", "workflow"])
    expect(config.enforce.executeVerification).toBe(false)
    expect(config.enforce.compaction).toEqual({
      cooldownMs: 600_000,
      enabled: false,
      threshold: 0.78,
    })
    expect(config.enforce.idleContinuation).toBe(false)
    expect(config.enforce.systemConstitution).toBe(true)
    expect(config.enforce.writeDeny).toBe(false)
    expect(config.telemetry.tokenUsage).toBe(true)
    expect(config.multiAgent).toEqual({
      enabled: false,
      roles: ["test-writer", "jaeki", "roach"],
      models: {},
    })
    expect(config.conventions[CONTROLLER_REPOSITORY_CONVENTION.id]).toBe(CONTROLLER_REPOSITORY_CONVENTION.defaultLevel)
    expect(CONTROLLER_REPOSITORY_CONVENTION.blockerId).toBe("architecture-controller-repository-direct-dependency")
    expect(CONTROLLER_REPOSITORY_CONVENTION.fixPath).toContain("Service layer")
  })

  it("uses token telemetry opt-out from harness.jsonc", () => {
    const projectDir = createProject()
    writeHarnessConfig(projectDir, { telemetry: { tokenUsage: false } })

    const config = loadHarnessConfig(projectDir)

    expect(config.telemetry.tokenUsage).toBe(false)
  })

  it("uses executeVerification enforcement opt-in from harness.jsonc", () => {
    const projectDir = createProject()
    writeHarnessConfig(projectDir, {
      enforce: {
        compaction: {
          cooldownMs: 120_000,
          enabled: true,
          threshold: 0.8,
        },
        executeVerification: true,
        idleContinuation: true,
        systemConstitution: false,
        writeDeny: true,
      },
    })

    const config = loadHarnessConfig(projectDir)

    expect(config.enforce.executeVerification).toBe(true)
    expect(config.enforce.compaction).toEqual({
      cooldownMs: 120_000,
      enabled: true,
      threshold: 0.8,
    })
    expect(config.enforce.idleContinuation).toBe(true)
    expect(config.enforce.systemConstitution).toBe(false)
    expect(config.enforce.writeDeny).toBe(true)
  })

  it("uses multi-agent relay opt-in from harness.jsonc", () => {
    const projectDir = createProject()
    writeHarnessConfig(projectDir, {
      multiAgent: {
        enabled: true,
        roles: ["test-writer", "jaeki", "roach"],
        models: {
          roach: "provider/strong-reviewer",
        },
      },
    })

    const config = loadHarnessConfig(projectDir)

    expect(config.multiAgent.enabled).toBe(true)
    expect(config.multiAgent.roles).toEqual(["test-writer", "jaeki", "roach"])
    expect(config.multiAgent.models).toEqual({ roach: "provider/strong-reviewer" })
  })

  it("uses convention levels from harness.jsonc", () => {
    const projectDir = createProject()
    writeHarnessConfig(projectDir, { conventions: { "controller.repository-dependency": "warn" } })

    const config = loadHarnessConfig(projectDir)

    expect(config.conventions["controller.repository-dependency"]).toBe("warn")
  })

  it("keeps malformed config diagnostics-only while falling back to defaults", () => {
    const projectDir = createProject()
    writeHarnessConfig(projectDir, { enabledDomains: ["frontend"] })
    writeFileSync(`${projectDir}/.persona/harness.jsonc`, "{ broken jsonc")

    const result = loadHarnessConfigResult(projectDir)
    const injection = createInjectionBlock("README.md", projectDir)

    expect(result.config.enabledDomains).toEqual(["backend", "programming", "workflow"])
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
