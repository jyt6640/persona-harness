import { describe, expect, it } from "vitest"

import { createInjectionBlock } from "../src/runtime/injection.js"

describe("Phase 0 backend product-code shape guidance", () => {
  it("keeps the default bootstrap surface on the core rule set", () => {
    const injection = createInjectionBlock("README.md", process.cwd())

    expect(injection.selectedRules).toContain("backend/java-backend-bootstrap.md")
    expect(injection.selectedRules).not.toContain("backend/packs/domain-layout.md")
    expect(injection.selectedRules).not.toContain("backend/packs/persistence-jpa.md")
    expect(injection.selectedRules).not.toContain("backend/packs/error-contract-global.md")
    expect(injection.selectedRules).not.toContain("backend/packs/workflow-evidence.md")
  })

  it("keeps core Java roles separate without assuming a package layout", () => {
    const controller = createInjectionBlock("src/main/java/example/presentation/BookController.java", process.cwd())
    const service = createInjectionBlock("src/main/java/example/application/BookService.java", process.cwd())
    const repository = createInjectionBlock("src/main/java/example/domain/BookRepository.java", process.cwd())
    const entity = createInjectionBlock("src/main/java/example/domain/BookEntity.java", process.cwd())

    expect(controller.selectedRules).toContain("backend/spring-controller.md")
    expect(service.selectedRules).toContain("backend/spring-service.md")
    expect(repository.selectedRules).toContain("backend/spring-repository.md")
    expect(entity.selectedRules).toContain("backend/spring-entity.md")
    for (const injection of [controller, service, repository, entity]) {
      expect(injection.selectedRules.some((path) => path.startsWith("backend/packs/"))).toBe(false)
    }
  })

  it("keeps API, entity, constructor, and repository boundaries in the core roles", () => {
    const controller = createInjectionBlock("src/main/java/example/presentation/BookController.java", process.cwd())
    const entity = createInjectionBlock("src/main/java/example/domain/BookEntity.java", process.cwd())
    const repository = createInjectionBlock("src/main/java/example/domain/BookRepository.java", process.cwd())

    expect(controller.selectedRules).toEqual(expect.arrayContaining(["backend/spring-controller.md", "backend/spring-dto.md"]))
    expect(entity.selectedRules).toContain("backend/spring-entity.md")
    expect(repository.selectedRules).toContain("backend/spring-repository.md")
  })
})
