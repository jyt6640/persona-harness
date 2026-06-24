import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { initializePersonaHarness } from "../src/cli/init.js"
import { createPhase0Hooks } from "../src/runtime/hooks.js"
import { createInjectionBlock } from "../src/runtime/injection.js"
import type { TransformMessagesOutput } from "../src/runtime/types.js"

const tempProjects: string[] = []

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-bootstrap-test-"))
  tempProjects.push(projectDir)
  initializePersonaHarness({ projectDir, packageRoot: process.cwd() })
  return projectDir
}

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
            text: "README.md를 읽고 Gradle 기반 Spring 백엔드를 만들어줘.",
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function evidencePayloads(projectDir: string): readonly Record<string, unknown>[] {
  const evidenceDir = join(projectDir, ".persona", "evidence", "phase0")
  if (!existsSync(evidenceDir)) {
    return []
  }

  return readdirSync(evidenceDir)
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) => JSON.parse(readFileSync(join(evidenceDir, fileName), "utf8")))
    .filter(isRecord)
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("Phase 0 bootstrap injection", () => {
  it("selects Java backend bootstrap guidance for README targets", () => {
    const injection = createInjectionBlock("README.md", process.cwd())

    expect(injection.fileRole).toBe("project-bootstrap")
    expect(injection.selectedRules).toContain("backend/java-backend-bootstrap.md")
    expect(injection.block).toContain("Gradle 기반 Spring Boot backend project")
    expect(injection.block).toContain("presentation/application/domain/infrastructure")
    expect(injection.block).toContain("Service는 Map/List/AtomicLong/nextId/idCounter")
    expect(injection.block).toContain("static factory")
    expect(injection.block).toContain("private constructor")
    expect(injection.block).toContain("Spring/Gradle/JPA/database profile")
    expect(injection.block).toContain("실제 Spring Boot/Gradle/JPA")
    expect(injection.block).toContain("Node/JS/Python/shell shim")
  })

  it("selects Java backend bootstrap guidance for requirements targets", () => {
    const injection = createInjectionBlock("requirements.md", process.cwd())

    expect(injection.fileRole).toBe("requirements-bootstrap")
    expect(injection.selectedRules).toContain("backend/java-backend-bootstrap.md")
    expect(injection.block).toContain("요구사항을 먼저 backend product code shape 계획으로 변환")
  })

  it("selects Gradle bootstrap guidance for build and settings targets", () => {
    for (const targetFile of ["build.gradle", "settings.gradle"]) {
      const injection = createInjectionBlock(targetFile, process.cwd())

      expect(injection.fileRole).toBe("gradle-bootstrap")
      expect(injection.selectedRules).toContain("backend/gradle-bootstrap.md")
      expect(injection.block).toContain("Maven")
      expect(injection.block).toContain("Spring Boot")
      expect(injection.block).toContain("호환되는 Spring Boot plugin / Gradle launcher or wrapper / JDK toolchain 조합")
      expect(injection.block).toContain("bootJar")
      expect(injection.block).toContain("enabled = false")
      expect(injection.block).toContain("CopyProcessingSpec.getDirMode")
      expect(injection.block).toContain(":bootJar SKIPPED")
      expect(injection.block).toContain("junit-platform-launcher")
      expect(injection.block).toContain("Hard rule")
      expect(injection.block).toContain("Node/JS/Python/shell shim")
      expect(injection.block).toContain("환경 문제")
    }
  })

  it("does not apply bootstrap guidance to arbitrary markdown files", () => {
    for (const targetFile of ["docs/note.md", "CHANGELOG.md", "random.md"]) {
      const injection = createInjectionBlock(targetFile, process.cwd())

      expect(injection.fileRole).toBe("shared-skill")
      expect(injection.selectedRules).toEqual([])
      expect(injection.selectedSharedSkills).toEqual([])
    }
  })

  it("keeps frontend and infra parking surfaces out of bootstrap expansion", () => {
    const frontendInjection = createInjectionBlock("src/components/App.tsx", process.cwd())
    const infraInjection = createInjectionBlock("infra/main.tf", process.cwd())

    expect(frontendInjection.fileRole).toBe("frontend")
    expect(frontendInjection.selectedRules).toEqual([])
    expect(infraInjection.fileRole).toBe("infra")
    expect(infraInjection.selectedRules).toEqual([])
  })

  it("preserves existing Java Controller, Service, and Repository rule selection", () => {
    const controller = createInjectionBlock("src/main/java/com/example/coupon/presentation/CouponController.java")
    const service = createInjectionBlock("src/main/java/com/example/coupon/application/CouponService.java")
    const repository = createInjectionBlock("src/main/java/com/example/coupon/domain/CouponRepository.java")

    expect(controller.fileRole).toBe("controller")
    expect(controller.selectedRules).toContain("backend/spring-controller.md")
    expect(service.fileRole).toBe("service")
    expect(service.selectedRules).toContain("backend/spring-service.md")
    expect(repository.fileRole).toBe("repository")
    expect(repository.selectedRules).toContain("backend/spring-repository.md")
  })

  it("records bootstrap fileRole evidence when README injection reaches model input", async () => {
    const projectDir = createTempProject()
    writeFileSync(join(projectDir, "README.md"), "# Coupon API\n")
    writeFileSync(
      join(projectDir, ".persona", "project-profile.jsonc"),
      `${JSON.stringify(
        {
          schema: "persona.project-profile.v1",
          status: "draft",
          scope: {
            role: "backend",
            mvp: "java-spring-clean-code",
            productized: false,
          },
          questions: [
            {
              id: "package-style",
              prompt: "package-style",
              choices: [],
              answer: "domain-first",
            },
          ],
        },
        null,
        2,
      )}\n`,
    )
    const hooks = createPhase0Hooks({ projectDir })
    const sessionID = "bootstrap-session"
    const toolOutput = { title: "README.md", output: "# Coupon API", metadata: {} }

    await hooks["tool.execute.after"]?.(
      { tool: "read", sessionID, callID: "bootstrap-call", args: { path: "README.md" } },
      toolOutput,
    )
    const output = modelInput(sessionID)
    await hooks["experimental.chat.messages.transform"]?.({}, output)

    expect(toolOutput.output).toContain("파일 역할: project-bootstrap")
    expect(toolOutput.output).toContain("프로젝트 프로필 요약:")
    expect(firstText(output)).toContain("backend/java-backend-bootstrap.md")
    expect(
      evidencePayloads(projectDir).some(
        (payload) => payload.fileRole === "project-bootstrap" && payload.profileSummaryInjected === true,
      ),
    ).toBe(true)
  })
})
