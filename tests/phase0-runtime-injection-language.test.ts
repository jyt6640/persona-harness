import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { loadHarnessConfig } from "../src/config/harness-config.js"
import { createInjectionBlock } from "../src/runtime/injection.js"
import { createJavaRoleReadFollowUp, formatJavaRoleDiscoveryBlock } from "../src/runtime/java-role-discovery.js"
import { createSystemConstitutionBlock } from "../src/runtime/system-constitution.js"
import { loadWorkflowSkillBlock, type WorkflowSkillName } from "../src/runtime/workflow-skill-loader.js"

const tempProjects: string[] = []
const KOREAN_TEXT_PATTERN = /[가-힣]/u

function createProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-runtime-language-test-"))
  tempProjects.push(projectDir)
  writeFileSync(join(projectDir, "README.md"), "# Runtime language fixture\n")
  return projectDir
}

function expectNoKoreanText(text: string): void {
  expect(text.match(KOREAN_TEXT_PATTERN)?.[0]).toBeUndefined()
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("runtime injected prompt language", () => {
  it("keeps target-file, Java role, and system constitution injected guard text in English", () => {
    const projectDir = createProject()
    const injection = createInjectionBlock("README.md", projectDir)

    expectNoKoreanText(injection.block)
    expect(injection.block).toContain("Current file: README.md")
    expect(injection.block).toContain("Selected skills:")

    const javaInjection = createInjectionBlock("src/main/java/com/example/TaskController.java", projectDir)
    expectNoKoreanText(formatJavaRoleDiscoveryBlock([javaInjection]))
    const followUp = createJavaRoleReadFollowUp([javaInjection])
    expect(followUp).not.toBeUndefined()
    expectNoKoreanText(followUp?.block ?? "")
    expectNoKoreanText(createSystemConstitutionBlock(loadHarnessConfig(projectDir)))
  })

  it("keeps workflow runtime blocks in English", () => {
    const blocks: ReadonlyArray<readonly [WorkflowSkillName, string]> = [
      ["programming", "default"],
      ["debug", "default"],
      ["review", "default"],
      ["refactor", "default"],
      ["git", "default"],
      ["requirements", "draft"],
      ["requirements", "approval"],
      ["requirements", "file"],
      ["requirements", "prompt"],
      ["requirements", "continuation"],
    ]

    for (const [skill, block] of blocks) {
      expectNoKoreanText(
        loadWorkflowSkillBlock(skill, block, {
          detectedIntent: "test-intent",
          reason: "test reason",
          secondaryIntents: "none",
          selectedSkillPath: "packages/shared-skills/skills/workflow/requirements/SKILL.md",
          sourceFile: "README.md",
        }),
      )
    }
  })
})
