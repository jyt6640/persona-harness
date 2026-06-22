import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

const tempProjects: string[] = []

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-doctor-review-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

function writeFile(projectDir: string, relativePath: string, content: string): void {
  const fullPath = join(projectDir, relativePath)
  mkdirSync(join(fullPath, ".."), { recursive: true })
  writeFileSync(fullPath, content)
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("ph doctor", () => {
  it("reports local Persona Harness integration state", () => {
    const projectDir = createTempProject()
    mkdirSync(join(projectDir, ".opencode"), { recursive: true })
    mkdirSync(join(projectDir, ".persona", "rules"), { recursive: true })
    writeFileSync(join(projectDir, ".opencode", "opencode.json"), JSON.stringify({ plugin: ["/tmp/persona/dist/index.js"] }, null, 2))
    writeFileSync(join(projectDir, ".persona", "harness.jsonc"), "{}\n")

    const result = runPersonaCli(["doctor"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Persona Harness Doctor")
    expect(result.stdout).toContain("Node:")
    expect(result.stdout).toContain("npm:")
    expect(result.stdout).toContain("OpenCode:")
    expect(result.stdout).toContain(".opencode/opencode.json: present")
    expect(result.stdout).toContain("Persona plugin path: configured")
    expect(result.stdout).toContain(".persona/harness.jsonc: present")
    expect(result.stdout).toContain(".persona/rules: present")
    expect(result.stdout).toContain("npm registry: unchecked")
  })
})

describe("ph review backend-shape", () => {
  it("writes a report-only backend shape report for a clean layered Gradle project", () => {
    const projectDir = createTempProject()
    writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'library'\n")
    writeFileSync(join(projectDir, "build.gradle"), "plugins { id 'org.springframework.boot' version '3.5.0' }\n")
    writeFile(projectDir, "src/main/java/com/example/library/presentation/BookController.java", "class BookController {}\n")
    writeFile(projectDir, "src/main/java/com/example/library/application/BookService.java", "class BookService {}\n")
    writeFile(
      projectDir,
      "src/main/java/com/example/library/domain/Book.java",
      "class Book { boolean isOwner(String name) { return true; } }\n",
    )
    writeFile(projectDir, "src/main/java/com/example/library/domain/BookRepository.java", "interface BookRepository {}\n")
    writeFile(
      projectDir,
      "src/main/java/com/example/library/infrastructure/JdbcBookRepository.java",
      "class JdbcBookRepository implements BookRepository {}\n",
    )
    writeFile(projectDir, "src/main/java/com/example/library/presentation/dto/request/CreateBookRequest.java", "record CreateBookRequest() {}\n")
    writeFile(projectDir, "src/main/java/com/example/library/presentation/dto/response/BookResponse.java", "record BookResponse() {}\n")
    mkdirSync(join(projectDir, ".persona", "workflow"), { recursive: true })
    writeFileSync(join(projectDir, ".persona", "workflow", "implementation-report.md"), "Status: filled\nnpx ph bearshell gradle test\nnpx ph bearshell gradle build\nbootRun\n")

    const result = runPersonaCli(["review", "backend-shape"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Backend shape report written")
    const report = readFileSync(join(projectDir, ".persona", "workflow", "backend-shape-report.md"), "utf8")
    expect(report).toContain("# Backend Shape Report")
    expect(report).toContain("| Gradle only | PASS |")
    expect(report).toContain("| Layer/package structure | PASS |")
    expect(report).toContain("| Domain repository port | PASS |")
    expect(report).toContain("| Infrastructure repository adapter | PASS |")
    expect(report).toContain("| Service storage/id sequence ownership | PASS |")
    expect(report).toContain("| Domain behavior | PASS |")
    expect(report).toContain("| DTO boundary | PASS |")
  })

  it("reports service-owned storage and Maven drift as WARN findings", () => {
    const projectDir = createTempProject()
    writeFileSync(join(projectDir, "pom.xml"), "<project />\n")
    writeFile(projectDir, "src/main/java/com/example/library/application/BookService.java", "class BookService { private java.util.concurrent.atomic.AtomicLong nextId; }\n")
    writeFile(projectDir, "src/main/java/com/example/library/domain/Book.java", "record Book(String name) {}\n")

    const result = runPersonaCli(["review", "backend-shape"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    const report = readFileSync(join(projectDir, ".persona", "workflow", "backend-shape-report.md"), "utf8")
    expect(report).toContain("| Gradle only | WARN |")
    expect(report).toContain("| Service storage/id sequence ownership | WARN |")
    expect(report).toContain("AtomicLong")
    expect(report).toContain("| Domain behavior | WARN |")
    expect(report).toContain("domain record")
  })
})
