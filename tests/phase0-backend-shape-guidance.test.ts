import { describe, expect, it } from "vitest"

import { createInjectionBlock } from "../src/phase0/injection.js"

function policiesFor(targetFile: string): string {
  return createInjectionBlock(targetFile, process.cwd()).policies.join("\n")
}

function blockFor(targetFile: string): string {
  return createInjectionBlock(targetFile, process.cwd()).block
}

describe("Phase 0 backend product-code shape guidance", () => {
  it("keeps project bootstrap guidance on root domain packages instead of feature wrappers", () => {
    const policies = policiesFor("README.md")

    expect(policies).toContain("package structure plan")
    expect(policies).toContain("root package 바로 아래")
    expect(policies).toContain("global")
    expect(policies).toContain("root/<domain>/presentation")
    expect(policies).toContain("root/<domain>/application")
    expect(policies).toContain("root/<domain>/domain")
    expect(policies).toContain("root/<domain>/infrastructure")
    expect(policies).toContain("feature/features/module/modules")
    expect(policies).toContain("presentation/dto/request")
    expect(policies).toContain("presentation/dto/response")
    expect(policies).toContain("application/dto/command")
    expect(policies).toContain("application/dto/result")
  })

  it("tells bootstrap runs to plan and re-open role-specific Java targets before continuing", () => {
    const policies = policiesFor("README.md")

    expect(policies).toContain("구현 전에 package structure plan")
    expect(policies).toContain("Domain")
    expect(policies).toContain("Repository")
    expect(policies).toContain("Service")
    expect(policies).toContain("DTO")
    expect(policies).toContain("Controller")
    expect(policies).toContain("다시 읽고")
  })

  it("keeps common Java guidance explicit about root/global/domain package depth", () => {
    const policies = policiesFor("src/main/java/com/example/library/LibraryApplication.java")

    expect(policies).toContain("feature/features/module/modules")
    expect(policies).toContain("root/global/exception")
    expect(policies).toContain("root/<domain>/application/dto/command")
    expect(policies).toContain("root/<domain>/application/dto/result")
    expect(policies).toContain("root/<domain>/presentation/dto/request")
    expect(policies).toContain("root/<domain>/presentation/dto/response")
  })

  it("keeps controller DTO guidance out of nested controller records", () => {
    const block = blockFor("src/main/java/com/example/library/presentation/BookController.java")

    expect(block).toContain("backend/spring-dto.md")
    expect(block).toContain("Controller 내부 중첩")
    expect(block).toContain("presentation/dto/request")
    expect(block).toContain("presentation/dto/response")
    expect(block).toContain("Request DTO를 Command")
    expect(block).toContain("Result를 Response DTO")
  })

  it("keeps service guidance out of nested response records and presentation DTO returns", () => {
    const block = blockFor("src/main/java/com/example/library/application/BookService.java")

    expect(block).toContain("backend/spring-service.md")
    expect(block).toContain("Service 내부 중첩")
    expect(block).toContain("*Response/*Item/*View")
    expect(block).toContain("presentation Response DTO")
    expect(block).toContain("application/dto/result")
  })

  it("keeps repository guidance from cross-repository aggregate assembly", () => {
    const block = blockFor("src/main/java/com/example/library/domain/BookRepository.java")

    expect(block).toContain("backend/spring-repository.md")
    expect(block).toContain("다른 Repository 구현체를 주입받아")
    expect(block).toContain("aggregate")
    expect(block).toContain("N+1")
  })

  it("uses programming as limited support without replacing backend Java rules", () => {
    const service = createInjectionBlock("src/main/java/com/example/library/application/BookService.java")
    const gradle = createInjectionBlock("build.gradle")

    expect(service.selectedSharedSkills.map((skill) => skill.name)).toEqual(["programming"])
    expect(service.selectedRules).toContain("backend/spring-service.md")
    expect(service.selectedRules.length).toBeGreaterThan(0)
    expect(service.selectedSharedSkills.map((skill) => skill.name)).not.toContain("frontend")

    expect(gradle.selectedSharedSkills.map((skill) => skill.name)).toEqual(["programming"])
    expect(gradle.selectedRules).toContain("backend/gradle-bootstrap.md")
  })
})
