import { describe, expect, it } from "vitest"
import { existsSync } from "node:fs"

import { createPhase0Hooks } from "../src/phase0/hooks.js"
import { createInjectionBlock } from "../src/phase0/injection.js"
import {
  ACTIVE_SHARED_SKILL_NAMES,
  INACTIVE_VENDORED_SHARED_SKILL_NAMES,
  REMOVED_SHARED_SKILL_NAMES,
} from "../src/phase0/shared-skill-router.js"
import type { TransformMessagesOutput } from "../src/phase0/types.js"

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
    expect(injection.block).toContain("선택 스킬:")
    expect(injection.block).toContain("packages/shared-skills/skills/programming/SKILL.md")
    expect(injection.block).toContain("TypeScript")
  })

  it("selects programming and frontend for React component targets", () => {
    const injection = createInjectionBlock("src/components/ReservationList.tsx")

    expect(injection.selectedSharedSkills.map((skill) => skill.name)).toEqual(["programming", "frontend"])
    expect(injection.selectedSharedSkills.map((skill) => skill.domain)).toContain("frontend")
    expect(injection.block).toContain("packages/shared-skills/skills/frontend/SKILL.md")
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
    const hooks = createPhase0Hooks()
    const sessionID = "session-typescript"

    await hooks["tool.execute.before"]?.(
      { tool: "edit", sessionID, callID: "call-1" },
      { args: { filePath: "src/components/App.tsx" } },
    )

    const output = modelInput(sessionID)
    await hooks["experimental.chat.messages.transform"]?.({}, output)

    const text = firstText(output)
    expect(text).toContain("[Persona Harness Injection]")
    expect(text).toContain("선택 스킬:")
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
    expect(injection.block).toContain("packages/shared-skills/skills/programming/SKILL.md")
  })

  it("surfaces backend package architecture guidance for Spring Boot application entrypoints", () => {
    const injection = createInjectionBlock("src/main/java/com/example/library/LibraryApplication.java")

    expect(injection.fileRole).toBe("java-common")
    expect(injection.selectedRules).toContain("backend/layered-architecture.md")
    expect(injection.policies.join("\n")).toContain("구현 전에 package structure plan")
    expect(injection.policies.join("\n")).toContain("global/presentation/application/domain/infrastructure")
    expect(injection.policies.join("\n")).toContain("global은 error/response/config")
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

    expect(injection.fileRole).toBe("java-common")
    expect(injection.selectedRules).toContain("backend/java-common.md")
    expect(injection.selectedRules).toContain("backend/layered-architecture.md")
    expect(injection.selectedSharedSkills.map((skill) => skill.name)).toEqual(["programming"])
    expect(injection.block).toContain("Gradle Java build file detected")
  })
})
