import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { createPhase0Hooks } from "../src/runtime/hooks.js"
import { createInjectionBlock } from "../src/runtime/injection.js"
import {
  ACTIVE_SHARED_SKILL_NAMES,
  OPTIONAL_SHARED_SKILL_NAMES,
  REMOVED_SHARED_SKILL_NAMES,
} from "../src/runtime/shared-skill-router.js"
import type { TransformMessagesOutput } from "../src/runtime/types.js"

const tempProjects: string[] = []

function createOptInProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-shared-skill-routing-"))
  tempProjects.push(projectDir)
  mkdirSync(join(projectDir, ".persona"), { recursive: true })
  writeFileSync(
    join(projectDir, ".persona", "harness.jsonc"),
    `${JSON.stringify({ features: { runtimeInjection: true }, enabledDomains: ["programming", "frontend"] }, null, 2)}\n`,
  )
  return projectDir
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

function modelInput(sessionID: string): TransformMessagesOutput {
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
            text: "TypeScript 코드를 수정해줘.",
          },
        ],
      },
    ],
  }
}

function firstText(output: TransformMessagesOutput): string {
  const part = output.messages[0]?.parts[0]
  return part?.type === "text" ? part.text : ""
}

describe("Phase 0 shared skill routing", () => {
  it("selects the programming shared skill for TypeScript targets", () => {
    const injection = createInjectionBlock("src/lib/reservation.ts")

    expect(injection.selectedSharedSkills.map((skill) => skill.name)).toContain("programming")
    expect(injection.selectedSharedSkills.map((skill) => skill.path)).toContain("packages/shared-skills/skills/programming/SKILL.md")
    expect(injection.block).toContain("Selected skills:")
    expect(injection.block).not.toContain("packages/shared-skills/skills/programming/SKILL.md")
    expect(injection.block).toContain("TypeScript")
  })

  it("selects programming for React component targets without auto-injecting the optional frontend overlay", () => {
    const injection = createInjectionBlock("src/components/ReservationList.tsx")

    expect(injection.selectedSharedSkills.map((skill) => skill.name)).toEqual(["programming"])
    expect(injection.selectedSharedSkills.map((skill) => skill.domain)).not.toContain("frontend")
    expect(injection.selectedSharedSkills.map((skill) => skill.path)).not.toContain("packages/shared-skills/skills/frontend/SKILL.md")
    expect(injection.block).toContain("programming")
  })

  it("does not add frontend for non-React TypeScript module targets", () => {
    const injection = createInjectionBlock("src/domain/reservation.ts")

    expect(injection.selectedSharedSkills.map((skill) => skill.name)).toEqual(["programming"])
  })

  it("keeps optional and removed OMO surfaces out of automatic routing", () => {
    const selectedSkillNames = [
      ...createInjectionBlock("src/components/ReservationList.tsx").selectedSharedSkills.map((skill) => skill.name),
      ...createInjectionBlock("Dockerfile").selectedSharedSkills.map((skill) => skill.name),
      ...createInjectionBlock("src/main/java/com/example/reservation/ReservationController.java").selectedSharedSkills.map(
        (skill) => skill.name,
      ),
    ]

    expect(ACTIVE_SHARED_SKILL_NAMES).toEqual(["programming"])
    expect(OPTIONAL_SHARED_SKILL_NAMES).toEqual(["frontend", "visual-qa", "ast-grep", "lsp-setup"])
    const activeSkillNames = new Set<string>(ACTIVE_SHARED_SKILL_NAMES)
    expect(selectedSkillNames.every((name) => activeSkillNames.has(name))).toBe(true)
  })

  it("does not package OMO-specific orchestration baggage as Persona skills", () => {
    expect(REMOVED_SHARED_SKILL_NAMES).toEqual([
      "advanced/superpowers-driver",
      "debugging",
      "git-master",
      "init-deep",
      "remove-ai-slops",
      "review-work",
      "start-work",
      "ultraresearch",
      "ulw-plan",
    ])
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as { readonly files: readonly string[] }
    expect(REMOVED_SHARED_SKILL_NAMES.every((name) => !packageJson.files.includes(`packages/shared-skills/skills/${name}`))).toBe(true)
  })

  it("injects shared skill guidance for TypeScript files through hooks", async () => {
    const projectDir = createOptInProject()
    const hooks = createPhase0Hooks({ projectDir })
    const sessionID = "session-typescript"

    await hooks["tool.execute.after"]?.(
      { tool: "edit", sessionID, callID: "call-1", args: { filePath: "src/components/App.tsx" } },
      { title: "edit", output: undefined as unknown as string, metadata: {} },
    )

    const output = modelInput(sessionID)
    await hooks["experimental.chat.messages.transform"]?.({}, output)

    const text = firstText(output)
    expect(text).toContain("[Persona Harness Injection]")
    expect(text).toContain("Selected skills:")
    expect(text).toContain("programming")
    expect(text).not.toContain("- frontend (")
    expect(text).toContain("TypeScript 코드를 수정해줘.")
  })

  it("selects Java backend rules and the programming shared skill for Java targets", () => {
    const injection = createInjectionBlock("src/main/java/com/example/reservation/ReservationService.java")

    expect(injection.fileRole).toBe("service")
    expect(injection.selectedRules).toContain("backend/spring-service.md")
    expect(injection.selectedSharedSkills.map((skill) => skill.name)).toEqual(["programming"])
    expect(injection.block).toContain("Java target detected")
    expect(injection.selectedSharedSkills.map((skill) => skill.path)).toEqual(["packages/shared-skills/skills/programming/SKILL.md"])
    expect(injection.block).not.toContain("packages/shared-skills/skills/programming/SKILL.md")
  })

  it("keeps backend package architecture guidance conditional for Spring Boot application entrypoints", () => {
    const injection = createInjectionBlock("src/main/java/com/example/library/LibraryApplication.java")

    expect(injection.fileRole).toBe("java-common")
    expect(injection.selectedRules).toContain("backend/layered-architecture.md")
    expect(injection.selectedRules.some((path) => path.startsWith("backend/packs/"))).toBe(false)
    expect(injection.selectedRules).not.toContain("backend/packs/domain-layout.md")
    expect(injection.selectedRules).not.toContain("backend/packs/persistence-jpa.md")
    expect(injection.selectedRules).not.toContain("backend/packs/error-contract-global.md")
  })

  it("selects the programming shared skill for Gradle Java build files", () => {
    const injection = createInjectionBlock("build.gradle")

    expect(injection.fileRole).toBe("gradle-bootstrap")
    expect(injection.selectedRules).toContain("backend/gradle-bootstrap.md")
    expect(injection.selectedSharedSkills.map((skill) => skill.name)).toEqual(["programming"])
    expect(injection.block).toContain("Gradle Java build file detected")
  })

  it("classifies infrastructure-looking targets as infra parking surface with no active rules or skills", () => {
    const terraformInjection = createInjectionBlock("infra/main.tf")
    const dockerInjection = createInjectionBlock("Dockerfile")

    expect(terraformInjection.fileRole).toBe("infra")
    expect(terraformInjection.selectedRules).toEqual([])
    expect(terraformInjection.selectedSharedSkills).toEqual([])
    expect(terraformInjection.block).toContain("File role: infra")
    expect(terraformInjection.block).toContain("- None")

    expect(dockerInjection.fileRole).toBe("infra")
    expect(dockerInjection.selectedRules).toEqual([])
    expect(dockerInjection.selectedSharedSkills).toEqual([])
  })
})
