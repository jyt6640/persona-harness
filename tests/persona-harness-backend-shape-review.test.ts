import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

const tempProjects: string[] = []

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-backend-shape-review-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

function writeFile(projectDir: string, relativePath: string, content: string): void {
  const fullPath = join(projectDir, relativePath)
  mkdirSync(join(fullPath, ".."), { recursive: true })
  writeFileSync(fullPath, content)
}

function readReport(projectDir: string): string {
  return readFileSync(join(projectDir, ".persona", "workflow", "backend-shape-report.md"), "utf8")
}

function writeCleanishSpringProject(projectDir: string): void {
  writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'library'\n")
  writeFileSync(
    join(projectDir, "build.gradle"),
    [
      "plugins { id 'org.springframework.boot' version '3.5.0' }",
      "dependencies { implementation 'org.springframework.boot:spring-boot-starter-web' }",
    ].join("\n"),
  )
  writeFileSync(join(projectDir, "gradlew"), "#!/bin/sh\nexit 0\n")
  writeFile(
    projectDir,
    "src/main/java/com/example/library/LibraryApplication.java",
    "import org.springframework.boot.autoconfigure.SpringBootApplication;\n@SpringBootApplication\nclass LibraryApplication {}\n",
  )
  writeFile(
    projectDir,
    "src/main/java/com/example/library/presentation/BookController.java",
    "import org.springframework.web.bind.annotation.RestController;\n@RestController\nclass BookController { BookResponse response() { return new BookResponse(); } }\n",
  )
  writeFile(projectDir, "src/main/java/com/example/library/application/BookService.java", "class BookService { BookResult find() { return new BookResult(); } }\n")
  writeFile(projectDir, "src/main/java/com/example/library/domain/Book.java", "class Book { boolean isAvailable() { return true; } }\n")
  writeFile(projectDir, "src/main/java/com/example/library/domain/BookRepository.java", "interface BookRepository {}\n")
  writeFile(projectDir, "src/main/java/com/example/library/infrastructure/JdbcBookRepository.java", "class JdbcBookRepository implements BookRepository {}\n")
  writeFile(projectDir, "src/main/java/com/example/library/presentation/dto/request/CreateBookRequest.java", "record CreateBookRequest() {}\n")
  writeFile(projectDir, "src/main/java/com/example/library/presentation/dto/response/BookResponse.java", "record BookResponse() {}\n")
}

function writeTaskRepositoryAdapterProject(projectDir: string): void {
  writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'tasks'\n")
  writeFileSync(
    join(projectDir, "build.gradle"),
    [
      "plugins { id 'org.springframework.boot' version '3.5.0' }",
      "dependencies { implementation 'org.springframework.boot:spring-boot-starter-web' }",
    ].join("\n"),
  )
  writeFileSync(join(projectDir, "gradlew"), "#!/bin/sh\nexit 0\n")
  writeFile(
    projectDir,
    "src/main/java/com/example/tasks/TaskApplication.java",
    "import org.springframework.boot.autoconfigure.SpringBootApplication;\n@SpringBootApplication\nclass TaskApplication {}\n",
  )
  writeFile(
    projectDir,
    "src/main/java/com/example/tasks/presentation/TaskController.java",
    "import org.springframework.web.bind.annotation.RestController;\n@RestController\nclass TaskController { TaskResponse response() { return new TaskResponse(); } }\n",
  )
  writeFile(projectDir, "src/main/java/com/example/tasks/application/TaskService.java", "class TaskService { TaskResult find() { return new TaskResult(); } }\n")
  writeFile(projectDir, "src/main/java/com/example/tasks/domain/Task.java", "class Task { boolean isOpen() { return true; } }\n")
  writeFile(projectDir, "src/main/java/com/example/tasks/domain/repository/TaskRepository.java", "interface TaskRepository {}\n")
  writeFile(projectDir, "src/main/java/com/example/tasks/infra/persistence/JdbcTaskRepository.java", "class JdbcTaskRepository implements TaskRepository {}\n")
  writeFile(projectDir, "src/main/java/com/example/tasks/presentation/dto/CreateTaskRequest.java", "record CreateTaskRequest() {}\n")
  writeFile(projectDir, "src/main/java/com/example/tasks/presentation/dto/TaskResponse.java", "record TaskResponse() {}\n")
}

function writeWorkflowScaffold(projectDir: string): void {
  mkdirSync(join(projectDir, ".persona", "workflow"), { recursive: true })
  mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "workflow", "plan.md"), "Status: accepted\n")
  writeFileSync(
    join(projectDir, ".persona", "workflow", "implementation-report.md"),
    "Status: filled\n- README ranges read: 1-220\n- Project profile ranges read: all\n- `npx ph bearshell --shell './gradlew test'`\n- `npx ph bearshell --shell './gradlew build'`\n",
  )
  writeFileSync(join(projectDir, ".persona", "workflow", "review-report.md"), "Status: filled\n- `npx ph bearshell --shell './gradlew bootRun'`\n")
  writeFileSync(join(projectDir, ".persona", "evidence", "phase0", "sample.json"), "{}\n")
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("ph review backend-shape report-only analyzer", () => {
  it("creates a report-only backend shape report with the required observation criteria", () => {
    const projectDir = createTempProject()
    writeCleanishSpringProject(projectDir)

    const result = runPersonaCli(["review", "backend-shape"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(existsSync(join(projectDir, ".persona", "workflow", "backend-shape-report.md"))).toBe(true)
    const report = readReport(projectDir)
    expect(report).toContain("workflow/structure observation report")
    expect(report).toContain("Not generated app product-quality certification")
    expect(report).toContain("Not rule enforcement, AST/linter, or build gate")
    expect(report).toContain("| Spring Boot app | PASS |")
    expect(report).toContain("| Gradle runtime | PASS |")
    expect(report).toContain("| Maven pom.xml absent | PASS |")
    expect(report).toContain("| Fake build shim absent | PASS |")
    expect(report).toContain("| Controller/Service/Repository/DTO/Domain boundary | PASS |")
    expect(report).toContain("| Entity direct exposure | PASS |")
  })

  it("records WARN findings for fake shim and Spring mismatch fixtures", () => {
    const projectDir = createTempProject()
    writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'fake'\n")
    writeFileSync(join(projectDir, "build.gradle"), "plugins { id 'java' }\n")
    writeFileSync(join(projectDir, "gradle-shim.js"), "console.log('fake gradle')\n")
    writeFile(projectDir, "src/main/java/com/example/Application.java", "class Application {}\n")
    writeFile(projectDir, "src/main/java/com/example/presentation/BookController.java", "class BookController { Book response() { return new Book(); } }\n")
    writeFile(projectDir, "src/main/java/com/example/domain/Book.java", "class Book {}\n")

    const result = runPersonaCli(["review", "backend-shape"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    const report = readReport(projectDir)
    expect(report).toContain("| Spring Boot app | WARN |")
    expect(report).toContain("| Fake build shim absent | WARN |")
    expect(report).toContain("gradle-shim.js")
    expect(report).toContain("| Entity direct exposure | WARN |")
  })

  it("recognizes common TaskRepository/JdbcTaskRepository and request/response DTO naming", () => {
    const projectDir = createTempProject()
    writeTaskRepositoryAdapterProject(projectDir)

    const result = runPersonaCli(["review", "backend-shape"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    const report = readReport(projectDir)
    expect(report).toContain("| Layer/package structure | PASS |")
    expect(report).toContain("| Domain repository port | PASS |")
    expect(report).toContain("TaskRepository.java")
    expect(report).toContain("| Infrastructure repository adapter | PASS |")
    expect(report).toContain("JdbcTaskRepository.java")
    expect(report).toContain("| DTO boundary | PASS |")
    expect(report).toContain("CreateTaskRequest.java")
    expect(report).toContain("TaskResponse.java")
  })

  it("surfaces backend-shape report status in workflow check without blocking finish", () => {
    const projectDir = createTempProject()
    writeWorkflowScaffold(projectDir)
    writeCleanishSpringProject(projectDir)

    const missing = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })
    expect(missing.status).toBe(0)
    expect(missing.stdout).toContain("backend shape report: missing (report-only; run `npx ph review backend-shape`)")

    const review = runPersonaCli(["review", "backend-shape"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const check = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(review.status).toBe(0)
    expect(check.status).toBe(0)
    expect(check.stdout).toContain("backend shape report: PASS")
  })
})
