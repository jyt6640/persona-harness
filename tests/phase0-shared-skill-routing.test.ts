import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { createPhase0Hooks } from "../src/runtime/hooks.js"
import { createInjectionBlock } from "../src/runtime/injection.js"
import {
  ACTIVE_SHARED_SKILL_NAMES,
  INACTIVE_VENDORED_SHARED_SKILL_NAMES,
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

  it("selects programming and frontend for React component targets", () => {
    const injection = createInjectionBlock("src/components/ReservationList.tsx")

    expect(injection.selectedSharedSkills.map((skill) => skill.name)).toEqual(["programming", "frontend"])
    expect(injection.selectedSharedSkills.map((skill) => skill.domain)).toContain("frontend")
    expect(injection.selectedSharedSkills.map((skill) => skill.path)).toContain("packages/shared-skills/skills/frontend/SKILL.md")
    expect(injection.block).not.toContain("packages/shared-skills/skills/frontend/SKILL.md")
  })

  it("does not add frontend for non-React TypeScript module targets", () => {
    const injection = createInjectionBlock("src/domain/reservation.ts")

    expect(injection.selectedSharedSkills.map((skill) => skill.name)).toEqual(["programming"])
  })

  it("keeps inactive vendored skills out of automatic routing", () => {
    const selectedSkillNames = [
      ...createInjectionBlock("src/components/ReservationList.tsx").selectedSharedSkills.map((skill) => skill.name),
      ...createInjectionBlock("Dockerfile").selectedSharedSkills.map((skill) => skill.name),
      ...createInjectionBlock("src/main/java/com/example/reservation/ReservationController.java").selectedSharedSkills.map(
        (skill) => skill.name,
      ),
    ]

    expect(ACTIVE_SHARED_SKILL_NAMES).toEqual(["programming", "frontend"])
    expect(INACTIVE_VENDORED_SHARED_SKILL_NAMES).toEqual([
      "debugging",
      "visual-qa",
      "ast-grep",
      "git-master",
      "refactor",
      "review-work",
      "start-work",
      "ulw-plan",
      "ultraresearch",
      "init-deep",
      "remove-ai-slops",
      "lsp-setup",
    ])
    const activeSkillNames = new Set<string>(ACTIVE_SHARED_SKILL_NAMES)
    expect(selectedSkillNames.every((name) => activeSkillNames.has(name))).toBe(true)
  })

  it("does not vendor LazyCodex-only shared skills", () => {
    expect(REMOVED_SHARED_SKILL_NAMES).toEqual(["lcx-report-bug", "lcx-contribute-bug-fix", "lcx-doctor"])
    expect(REMOVED_SHARED_SKILL_NAMES.every((name) => !existsSync(`packages/shared-skills/skills/${name}`))).toBe(true)
  })

  it("injects shared skill guidance for TypeScript files through hooks", async () => {
    const projectDir = createOptInProject()
    const hooks = createPhase0Hooks({ projectDir })
    const sessionID = "session-typescript"

    await hooks["tool.execute.before"]?.(
      { tool: "edit", sessionID, callID: "call-1" },
      { args: { filePath: "src/components/App.tsx" } },
    )

    const output = modelInput(sessionID)
    await hooks["experimental.chat.messages.transform"]?.({}, output)

    const text = firstText(output)
    expect(text).toContain("[Persona Harness Injection]")
    expect(text).toContain("Selected skills:")
    expect(text).toContain("programming")
    expect(text).toContain("frontend")
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

  it("surfaces backend package architecture guidance for Spring Boot application entrypoints", () => {
    const injection = createInjectionBlock("src/main/java/com/example/library/LibraryApplication.java")

    expect(injection.fileRole).toBe("java-common")
    expect(injection.selectedRules).toContain("backend/layered-architecture.md")
    expect(injection.policies.join("\n")).toContain("구현 전에 package structure plan")
    expect(injection.policies.join("\n")).toContain("root package는 Spring Boot Application class")
    expect(injection.policies.join("\n")).toContain("global은 root package 바로 아래")
    expect(injection.policies.join("\n")).toContain("도메인 패키지는 global과 같은 depth")
    expect(injection.policies.join("\n")).toContain("root/global/exception")
    expect(injection.policies.join("\n")).toContain("root/<domain>/application")
    expect(injection.policies.join("\n")).toContain("root/<domain>/domain")
    expect(injection.policies.join("\n")).toContain("root/<domain>/infrastructure")
    expect(injection.policies.join("\n")).toContain("root/<domain>/presentation")
    expect(injection.policies.join("\n")).toContain("Application class가 com.example.library")
    expect(injection.policies.join("\n")).toContain("library 아래에 loan 같은 추가 도메인 패키지를 만들지 않는다")
    expect(injection.policies.join("\n")).toContain("presentation/dto/request")
    expect(injection.policies.join("\n")).toContain("application/dto/command")
    expect(injection.policies.join("\n")).toContain("Repository interface는 domain")
    expect(injection.policies.join("\n")).toContain("구현체는 infrastructure")
    expect(injection.policies.join("\n")).toContain("Presentation")
    expect(injection.policies.join("\n")).toContain("Application")
    expect(injection.policies.join("\n")).toContain("Domain")
    expect(injection.policies.join("\n")).toContain("Infrastructure")
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
