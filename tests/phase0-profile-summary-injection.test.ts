import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { createInjectionBlock } from "../src/phase0/injection.js"

const tempProjects: string[] = []

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-profile-summary-test-"))
  tempProjects.push(projectDir)
  mkdirSync(join(projectDir, ".persona"), { recursive: true })
  return projectDir
}

function writeProfile(projectDir: string, profile: unknown): void {
  writeFileSync(join(projectDir, ".persona", "project-profile.jsonc"), `${JSON.stringify(profile, null, 2)}\n`)
}

function backendProfile(answers: Readonly<Record<string, string | null>>): unknown {
  return {
    schema: "persona.project-profile.v1",
    status: "draft",
    scope: {
      role: "backend",
      mvp: "java-spring-clean-code",
      productized: false,
    },
    questions: Object.entries(answers).map(([id, answer]) => ({
      id,
      prompt: id,
      choices: [],
      answer,
    })),
  }
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("Phase 0 backend profile summary injection", () => {
  it("keeps injection unchanged when no project profile exists", () => {
    const projectDir = createTempProject()
    const injection = createInjectionBlock("src/main/java/com/example/coupon/application/CouponService.java", projectDir)

    expect(injection.block).not.toContain("프로젝트 프로필 요약:")
    expect(injection.selectedRules).toContain("backend/spring-service.md")
    expect(injection.selectedSharedSkills.map((skill) => skill.name)).toEqual(["programming"])
  })

  it("adds filled backend profile answers to Java service injection", () => {
    const projectDir = createTempProject()
    writeProfile(
      projectDir,
      backendProfile({
        "project-context": "personal",
        "project-scale": "small",
        storage: "in-memory",
        "persistence-technology": "undecided",
        "migration-style": "none",
        "package-style": "domain-first",
        "dto-strictness": "strict",
        "philosophy-overlay": "none",
      }),
    )

    const injection = createInjectionBlock("src/main/java/com/example/coupon/application/CouponService.java", projectDir)

    expect(injection.block).toContain("프로젝트 프로필 요약:")
    expect(injection.block).toContain("- project-context: personal")
    expect(injection.block).toContain("- storage: in-memory")
    expect(injection.block).toContain("- package-style: domain-first")
    expect(injection.block).toContain("구현 전 architecture/technology plan 참고용")
    expect(injection.block).toContain("rule enforcement나 product-quality 보증이 아니다")
    expect(injection.selectedRules).toContain("backend/spring-service.md")
  })

  it("does not render null answers as strong profile decisions", () => {
    const projectDir = createTempProject()
    writeProfile(
      projectDir,
      backendProfile({
        "project-context": null,
        storage: null,
        "package-style": "domain-first",
      }),
    )

    const injection = createInjectionBlock("README.md", projectDir)

    expect(injection.block).toContain("프로젝트 프로필 요약:")
    expect(injection.block).toContain("- package-style: domain-first")
    expect(injection.block).not.toContain("- project-context:")
    expect(injection.block).not.toContain("- storage:")
  })

  it("does not crash or inject profile summary for malformed profile content", () => {
    const projectDir = createTempProject()
    writeFileSync(join(projectDir, ".persona", "project-profile.jsonc"), "{ broken jsonc")

    const injection = createInjectionBlock("src/main/java/com/example/coupon/application/CouponService.java", projectDir)

    expect(injection.block).not.toContain("프로젝트 프로필 요약:")
    expect(injection.selectedRules).toContain("backend/spring-service.md")
  })

  it("adds backend profile summary to bootstrap targets", () => {
    const projectDir = createTempProject()
    writeProfile(projectDir, backendProfile({ storage: "database", "package-style": "domain-first" }))

    const injection = createInjectionBlock("README.md", projectDir)

    expect(injection.fileRole).toBe("project-bootstrap")
    expect(injection.block).toContain("프로젝트 프로필 요약:")
    expect(injection.block).toContain("- storage: database")
    expect(injection.selectedRules).toContain("backend/java-backend-bootstrap.md")
  })

  it("does not add backend profile summary to non-Java non-bootstrap targets", () => {
    const projectDir = createTempProject()
    writeProfile(projectDir, backendProfile({ storage: "database", "package-style": "domain-first" }))

    const injection = createInjectionBlock("src/components/App.tsx", projectDir)

    expect(injection.fileRole).toBe("frontend")
    expect(injection.block).not.toContain("프로젝트 프로필 요약:")
    expect(injection.selectedRules).toEqual([])
    expect(injection.selectedSharedSkills.map((skill) => skill.name)).toEqual(["programming", "frontend"])
  })

  it("does not inject unsupported profile scopes as backend guidance", () => {
    const projectDir = createTempProject()
    writeProfile(projectDir, {
      schema: "persona.project-profile.v1",
      scope: {
        role: "frontend",
        mvp: "react",
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
    })

    const injection = createInjectionBlock("src/main/java/com/example/coupon/application/CouponService.java", projectDir)

    expect(injection.block).not.toContain("프로젝트 프로필 요약:")
    expect(injection.selectedRules).toContain("backend/spring-service.md")
  })
})
