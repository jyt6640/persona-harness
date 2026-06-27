import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  backendShapeBoundaryForTest,
  backendShapeCheckCriteriaForTest,
  normalizeBackendShapePathForTest,
  stripJavaCommentsAndLiteralsForTest,
} from "../src/cli/backend-shape.js"
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

type BackendShapeReportRow = {
  readonly result: string
  readonly evidence: string
}

function backendShapeReportRows(report: string): ReadonlyMap<string, BackendShapeReportRow> {
  const rows = new Map<string, BackendShapeReportRow>()
  for (const line of report.split(/\r?\n/u)) {
    const match = /^\| (?<criterion>[^|]+) \| (?<result>PASS|WARN) \| (?<evidence>[^|]*) \|$/u.exec(line)
    if (match?.groups === undefined) {
      continue
    }
    rows.set(match.groups.criterion.trim(), {
      result: match.groups.result,
      evidence: match.groups.evidence.trim(),
    })
  }
  return rows
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

function writeHexagonalTaskRepositoryAdapterProject(projectDir: string): void {
  writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'tasks'\n")
  writeFileSync(
    join(projectDir, "build.gradle"),
    [
      "plugins { id 'org.springframework.boot' version '3.5.0' }",
      "dependencies { implementation 'org.springframework.boot:spring-boot-starter-web' }",
    ].join("\n"),
  )
  writeFileSync(join(projectDir, "gradlew.bat"), "@echo off\r\nexit /b 0\r\n")
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
  writeFile(projectDir, "src/main/java/com/example/tasks/application/port/out/TaskRepository.java", "interface TaskRepository {}\n")
  writeFile(projectDir, "src/main/java/com/example/tasks/domain/Task.java", "class Task { boolean isOpen() { return true; } }\n")
  writeFile(projectDir, "src/main/java/com/example/tasks/infrastructure/persistence/JdbcTaskRepository.java", "class JdbcTaskRepository implements TaskRepository {}\n")
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

function writeWindowsVerificationWorkflowScaffold(projectDir: string): void {
  mkdirSync(join(projectDir, ".persona", "workflow"), { recursive: true })
  writeFileSync(
    join(projectDir, ".persona", "workflow", "implementation-report.md"),
    [
      "Status: filled",
      "## Verification",
      "- [x] `npx ph bearshell --shell 'call gradlew.bat test'` 결과를 확인했다.",
      "- [x] `npx ph bearshell --shell 'call gradlew.bat build'` 결과를 확인했다.",
    ].join("\n"),
  )
  writeFileSync(
    join(projectDir, ".persona", "workflow", "review-report.md"),
    [
      "Status: filled",
      "- [x] `npx ph bearshell --shell 'call gradlew.bat bootRun --args=\"--server.port=8085\"'` smoke-started the app.",
    ].join("\n"),
  )
}

function writeWindowsTestBuildVerificationWorkflowScaffold(projectDir: string): void {
  mkdirSync(join(projectDir, ".persona", "workflow"), { recursive: true })
  writeFileSync(
    join(projectDir, ".persona", "workflow", "implementation-report.md"),
    [
      "Status: filled",
      "## Verification",
      "$ npx ph bearshell --shell 'call gradlew.bat test'",
      "BUILD SUCCESSFUL in 2s",
      "$ npx ph bearshell --shell 'call gradlew.bat build'",
      "BUILD SUCCESSFUL in 2s",
    ].join("\n"),
  )
  writeFileSync(
    join(projectDir, ".persona", "workflow", "review-report.md"),
    [
      "Status: filled",
      "- [ ] 실행 가능한 Spring Boot 앱이면 `npx ph bearshell --shell 'call gradlew.bat bootRun --args=\"--server.port=8085\"'` 결과를 확인했다.",
    ].join("\n"),
  )
}

function writeWindowsFailedDependencyVerificationWorkflowScaffold(projectDir: string): void {
  mkdirSync(join(projectDir, ".persona", "workflow"), { recursive: true })
  writeFileSync(
    join(projectDir, ".persona", "workflow", "implementation-report.md"),
    [
      "Status: filled",
      "## Verification",
      "$ npx ph bearshell --shell 'call gradlew.bat test'",
      "gradlew.bat test: exit 1",
      "Could not resolve all files for configuration ':runtimeClasspath'.",
      "Could not resolve org.springframework.boot:spring-boot-starter-web:.",
      "$ npx ph bearshell --shell 'call gradlew.bat build'",
      "gradlew.bat build: exit 1",
      "Could not resolve org.flywaydb:flyway-core:.",
    ].join("\n"),
  )
  writeFileSync(
    join(projectDir, ".persona", "workflow", "review-report.md"),
    [
      "Status: filled",
      "- test/build 통과라고 쓰면 안 되는 dependency resolution failure case.",
    ].join("\n"),
  )
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("ph review backend-shape report-only analyzer", () => {
  it("keeps backend-shape report criteria in one structured checklist", () => {
    expect(backendShapeCheckCriteriaForTest()).toStrictEqual([
      "Spring Boot app",
      "Gradle runtime",
      "Gradle only",
      "Maven pom.xml absent",
      "Fake build shim absent",
      "Layer/package structure",
      "Controller/Service/Repository/DTO/Domain boundary",
      "Domain repository port",
      "Infrastructure repository adapter",
      "Service storage/id sequence ownership",
      "Domain behavior",
      "DTO boundary",
      "Entity direct exposure",
      "bootJar",
      "Verification report",
    ])
  })

  it("normalizes Windows fixture-v2 source paths before role matching", () => {
    const sourcePath = String.raw`C:\fixture\src\main\java\com\example\taskapi\task\domain\TaskRepository.java`
    const adapterPath = String.raw`C:\fixture\src\main\java\com\example\taskapi\task\infrastructure\JdbcTaskRepository.java`
    const requestPath = String.raw`C:\fixture\src\main\java\com\example\taskapi\task\presentation\dto\request\CreateTaskRequest.java`
    const responsePath = String.raw`C:\fixture\src\main\java\com\example\taskapi\task\presentation\dto\response\TaskResponse.java`

    expect(normalizeBackendShapePathForTest(sourcePath)).toContain("/domain/TaskRepository.java")
    expect(normalizeBackendShapePathForTest(adapterPath)).toContain("/infrastructure/JdbcTaskRepository.java")
    expect(normalizeBackendShapePathForTest(requestPath)).toContain("/presentation/dto/request/CreateTaskRequest.java")
    expect(normalizeBackendShapePathForTest(responsePath)).toContain("/presentation/dto/response/TaskResponse.java")
  })

  it("recognizes Windows-style DTO and domain aggregate boundary paths", () => {
    const result = backendShapeBoundaryForTest([
      String.raw`C:\fixture\src\main\java\com\example\inventory\presentation\ItemController.java`,
      String.raw`C:\fixture\src\main\java\com\example\inventory\application\InventoryApplicationService.java`,
      String.raw`C:\fixture\src\main\java\com\example\inventory\domain\Item.java`,
      String.raw`C:\fixture\src\main\java\com\example\inventory\domain\ItemRepository.java`,
      String.raw`C:\fixture\src\main\java\com\example\inventory\infrastructure\JdbcItemRepository.java`,
      String.raw`C:\fixture\src\main\java\com\example\inventory\presentation\dto\request\CreateItemRequest.java`,
      String.raw`C:\fixture\src\main\java\com\example\inventory\presentation\dto\response\ItemResponse.java`,
    ])

    expect(result.result).toBe("PASS")
    expect(result.evidence).toBe("role files observed")
  })

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

  it("recognizes hexagonal application port repository interfaces as repository port evidence", () => {
    const projectDir = createTempProject()
    writeHexagonalTaskRepositoryAdapterProject(projectDir)

    const result = runPersonaCli(["review", "backend-shape"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    const rows = backendShapeReportRows(readReport(projectDir))
    expect(rows.get("Domain repository port")).toStrictEqual({
      result: "PASS",
      evidence: "src/main/java/com/example/tasks/application/port/out/TaskRepository.java",
    })
    expect(rows.get("Infrastructure repository adapter")).toStrictEqual({
      result: "PASS",
      evidence: "src/main/java/com/example/tasks/infrastructure/persistence/JdbcTaskRepository.java",
    })
  })

  it("keeps domain behavior PASS when exception messages contain the word record", () => {
    const projectDir = createTempProject()
    writeCleanishSpringProject(projectDir)
    writeFile(
      projectDir,
      "src/main/java/com/example/library/domain/LendingAlreadyReturnedException.java",
      "class LendingAlreadyReturnedException extends RuntimeException { LendingAlreadyReturnedException(Long id) { super(\"Lending record already returned: \" + id); } }\n",
    )

    const result = runPersonaCli(["review", "backend-shape"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    const report = readReport(projectDir)
    expect(report).toContain("| Domain behavior | PASS |")
    expect(report).not.toContain("domain record:")
  })

  it("does not report entity exposure from validation message string literals", () => {
    const projectDir = createTempProject()
    writeCleanishSpringProject(projectDir)
    writeFile(
      projectDir,
      "src/main/java/com/example/library/presentation/dto/request/LendItemRequest.java",
      [
        "import jakarta.validation.constraints.NotNull;",
        "import jakarta.validation.constraints.Positive;",
        "public record LendItemRequest(",
        "  @NotNull(message = \"Item id is required.\") @Positive(message = \"Member id must be positive.\") Long itemId,",
        "  @NotNull(message = \"Member id is required.\") Long memberId",
        ") {}",
      ].join("\n"),
    )

    const result = runPersonaCli(["review", "backend-shape"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(stripJavaCommentsAndLiteralsForTest("String message = \"Item id is required.\"; // Member note")).not.toContain("Item id")
    expect(result.status).toBe(0)
    const report = readReport(projectDir)
    expect(report).toContain("| Entity direct exposure | PASS |")
    expect(report).not.toContain("LendItemRequest.java exposes Item")
    expect(report).not.toContain("LendItemRequest.java exposes Member")
  })

  it("keeps entity direct exposure WARN when a presentation DTO imports a domain entity type", () => {
    const projectDir = createTempProject()
    writeCleanishSpringProject(projectDir)
    writeFile(
      projectDir,
      "src/main/java/com/example/library/presentation/dto/response/LeakyBookResponse.java",
      [
        "import com.example.library.domain.Book;",
        "public record LeakyBookResponse(Book book) {}",
      ].join("\n"),
    )

    const result = runPersonaCli(["review", "backend-shape"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    const report = readReport(projectDir)
    expect(report).toContain("| Entity direct exposure | WARN |")
    expect(report).toContain("LeakyBookResponse.java exposes Book")
  })

  it("does not treat nested generic dependencies, annotations, lambdas, comments, or text blocks as service-owned storage", () => {
    const projectDir = createTempProject()
    writeCleanishSpringProject(projectDir)
    writeFile(
      projectDir,
      "src/main/java/com/example/library/application/BookService.java",
      [
        "import java.util.List;",
        "import java.util.Map;",
        "import java.util.function.BiFunction;",
        "import java.util.function.Function;",
        "class BookService {",
        "  @SuppressWarnings({\"Map\", \"AtomicLong\", \"nextId\"})",
        "  private final Function<String, List<BookRepository>> lookupFactory = name -> List.of();",
        "  private final BiFunction<String, String, String> labels = (left, right) -> left + \",\" + right;",
        "  BookService(",
        "    BookRepository bookRepository,",
        "    Map<String, List<BookRepository>> repositoryGroups,",
        "    Function<String, List<BookRepository>> lookupFactory",
        "  ) {",
        "    String note = \"private Map<Long, Book> storage; AtomicLong nextId\";",
        "    String text = \"\"\"",
        "      private Map<Long, Book> storage;",
        "      private AtomicLong nextId;",
        "      ItemRepository, MemberRepository",
        "      \"\"\";",
        "    // private List<Book> cachedBooks;",
        "  }",
        "}",
      ].join("\n"),
    )

    const result = runPersonaCli(["review", "backend-shape"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    const serviceStorageRow = backendShapeReportRows(readReport(projectDir)).get("Service storage/id sequence ownership")
    expect(serviceStorageRow).toStrictEqual({
      result: "PASS",
      evidence: "no Map/List/AtomicLong/nextId/idCounter in *Service.java",
    })
  })

  it("detects multiline service-owned storage and id sequence fields", () => {
    const projectDir = createTempProject()
    writeCleanishSpringProject(projectDir)
    writeFile(
      projectDir,
      "src/main/java/com/example/library/application/BookService.java",
      [
        "class BookService {",
        "  private final",
        "      java.util.Map<Long, Book>",
        "      storage;",
        "  private",
        "      java.util.concurrent.atomic.AtomicLong",
        "      nextId;",
        "}",
      ].join("\n"),
    )

    const result = runPersonaCli(["review", "backend-shape"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    const serviceStorageRow = backendShapeReportRows(readReport(projectDir)).get("Service storage/id sequence ownership")
    expect(serviceStorageRow?.result).toBe("WARN")
    expect(serviceStorageRow?.evidence).toContain("BookService.java:Map")
    expect(serviceStorageRow?.evidence).toContain("BookService.java:AtomicLong")
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

  it("recognizes Windows gradlew.bat verification evidence in workflow reports", () => {
    const projectDir = createTempProject()
    writeCleanishSpringProject(projectDir)
    writeWindowsVerificationWorkflowScaffold(projectDir)
    mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
    writeFileSync(join(projectDir, ".persona", "evidence", "phase0", "large-read-evidence.json"), "x".repeat(210_000))

    const result = runPersonaCli(["review", "backend-shape"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    const report = readReport(projectDir)
    expect(report).toContain("| Verification report | PASS |")
    expect(report).toContain("gradle test/build/bootRun success evidence observed")
  })

  it("does not claim bootRun evidence when only Gradle test and build succeeded", () => {
    const projectDir = createTempProject()
    writeCleanishSpringProject(projectDir)
    writeWindowsTestBuildVerificationWorkflowScaffold(projectDir)

    const result = runPersonaCli(["review", "backend-shape"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    const verificationRow = backendShapeReportRows(readReport(projectDir)).get("Verification report")
    expect(verificationRow).toStrictEqual({
      result: "PASS",
      evidence: "gradle test/build success evidence observed; bootRun evidence not observed",
    })
  })

  it("reports WARN when Gradle test and build evidence contains dependency resolution failures", () => {
    const projectDir = createTempProject()
    writeCleanishSpringProject(projectDir)
    writeWindowsFailedDependencyVerificationWorkflowScaffold(projectDir)

    const result = runPersonaCli(["review", "backend-shape"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    const verificationRow = backendShapeReportRows(readReport(projectDir)).get("Verification report")
    expect(verificationRow).toStrictEqual({
      result: "WARN",
      evidence: "failed verification evidence observed",
    })
  })

  it("recognizes Gradle verification success evidence files when workflow reports are absent", () => {
    const projectDir = createTempProject()
    writeCleanishSpringProject(projectDir)
    mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
    writeFileSync(
      join(projectDir, ".persona", "evidence", "phase0", "verification.log"),
      [
        "$ npx ph bearshell --shell 'call gradlew.bat test'",
        "BUILD SUCCESSFUL in 2s",
        "$ npx ph bearshell --shell 'call gradlew.bat build'",
        "BUILD SUCCESSFUL in 2s",
        "$ npx ph bearshell --shell 'call gradlew.bat bootRun --args=\"--server.port=8085\"'",
        "Tomcat started on port 8085",
        "Started InventoryLendingApplication",
      ].join("\n"),
    )

    const result = runPersonaCli(["review", "backend-shape"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    const report = readReport(projectDir)
    expect(report).toContain("| Verification report | PASS |")
    expect(report).toContain("success evidence observed")
  })
})
