import { execFileSync, spawnSync } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { writeCurrentWorkflowLifecycleLoopStates } from "./workflow-lifecycle-loop-state.js"

export type RealCooperativeGradleFixture = {
  readonly cleanup: () => void
  readonly projectDir: string
}

export type RealGradleWarmupResult = {
  readonly output: string
  readonly status: number
}

export type RealGradleWarmupRunner = (projectDir: string) => RealGradleWarmupResult
export type RealGradleWarmupPause = () => void

const MAVEN_CENTRAL_RATE_LIMIT_BACKOFF_MS = 1_000

export function createRealCooperativeGradleFixture(): RealCooperativeGradleFixture {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-real-cooperative-gradle-"))
  try {
    writeFixtureFiles(projectDir)
    execFileSync("gradle", ["wrapper", "--gradle-version", "9.4.0", "--distribution-type", "bin"], {
      cwd: projectDir,
      encoding: "utf8",
      stdio: "pipe",
    })
    rmSync(join(projectDir, ".gradle"), { force: true, recursive: true })
    writeBuildFiles(projectDir)
    warmRealCooperativeGradleDependencies(projectDir)
    rmSync(join(projectDir, ".gradle"), { force: true, recursive: true })
    rmSync(join(projectDir, "build"), { force: true, recursive: true })
    writeCurrentWorkflowLifecycleLoopStates(projectDir)
    execFileSync("git", ["init", "-q"], { cwd: projectDir })
    execFileSync("git", ["config", "gc.auto", "0"], { cwd: projectDir })
    execFileSync("git", ["config", "maintenance.auto", "false"], { cwd: projectDir })
    execFileSync("git", ["config", "user.email", "ph@example.invalid"], { cwd: projectDir })
    execFileSync("git", ["config", "user.name", "PH Test"], { cwd: projectDir })
    execFileSync("git", ["config", "core.autocrlf", "false"], { cwd: projectDir })
    execFileSync("git", ["add", "."], { cwd: projectDir })
    execFileSync("git", ["commit", "-qm", "real cooperative Gradle fixture"], { cwd: projectDir })
  } catch (error) {
    rmSync(projectDir, { force: true, recursive: true })
    throw error
  }
  return {
    cleanup: () => rmSync(projectDir, { force: true, recursive: true }),
    projectDir,
  }
}

export function warmRealCooperativeGradleDependencies(
  projectDir: string,
  runner: RealGradleWarmupRunner = runRealGradleWarmup,
  pause: RealGradleWarmupPause = waitForMavenCentralRateLimitBackoff,
): void {
  const initial = runner(projectDir)
  if (initial.status === 0) return
  if (!isRetryableMavenCentralRateLimit(initial)) throwGradleWarmupFailure(initial)

  pause()
  const retry = runner(projectDir)
  if (retry.status === 0) return
  throwGradleWarmupFailure(retry)
}

export function isRetryableMavenCentralRateLimit(result: RealGradleWarmupResult): boolean {
  return result.status !== 0
    && result.output.includes("repo.maven.apache.org")
    && result.output.includes("Received status code 429")
}

function runRealGradleWarmup(projectDir: string): RealGradleWarmupResult {
  const result = spawnSync("./gradlew", ["--no-daemon", "test"], {
    cwd: projectDir,
    encoding: "utf8",
  })
  if (result.error !== undefined) throw result.error
  return {
    output: `${result.stdout}\n${result.stderr}`,
    status: result.status ?? 1,
  }
}

function waitForMavenCentralRateLimitBackoff(): void {
  const state = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT))
  Atomics.wait(state, 0, 0, MAVEN_CENTRAL_RATE_LIMIT_BACKOFF_MS)
}

function throwGradleWarmupFailure(result: RealGradleWarmupResult): never {
  throw new Error(`real-cooperative-gradle-warmup-failed\n${result.output}`)
}

export function realJUnitResultPath(projectDir: string): string {
  return join(projectDir, "build", "test-results", "test", "TEST-example.cooperative.CooperativeApplicationTest.xml")
}

function writeFixtureFiles(projectDir: string): void {
  mkdirSync(join(projectDir, ".persona", "custom-evidence", "phase0"), { recursive: true })
  mkdirSync(join(projectDir, ".persona", "workflow"), { recursive: true })
  mkdirSync(join(projectDir, "src", "main", "java", "example", "cooperative"), { recursive: true })
  mkdirSync(join(projectDir, "src", "test", "java", "example", "cooperative"), { recursive: true })
  writeFileSync(join(projectDir, "README.md"), "# Real cooperative Gradle fixture\n")
  writeFileSync(join(projectDir, ".gitignore"), ".gradle/\nbuild/\n")
  writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'real-cooperative-gradle'\n")
  writeFileSync(
    join(projectDir, ".persona", "harness.jsonc"),
    `${JSON.stringify({
      enforce: { executeVerification: false },
      evidenceDir: ".persona/custom-evidence",
    })}\n`,
  )
  writeFileSync(join(projectDir, ".persona", "project-profile.jsonc"), `${JSON.stringify(profile())}\n`)
  writeFileSync(join(projectDir, ".persona", "workflow", "plan.md"), "Status: accepted\n")
  writeFileSync(
    join(projectDir, ".persona", "workflow", "implementation-report.md"),
    [
      "Status: filled",
      "- README ranges read: all",
      "- Project profile ranges read: all",
      "- `npx ph bearshell --shell './gradlew test'`",
    ].join("\n"),
  )
  writeFileSync(
    join(projectDir, ".persona", "workflow", "review-report.md"),
    [
      "Status: filled",
      "- Manual QA reviewed the Java/Spring Gradle fixture.",
      "- `npx ph bearshell --shell './gradlew build'`",
    ].join("\n"),
  )
  writeFileSync(
    join(projectDir, ".persona", "custom-evidence", "phase0", "verification.json"),
    `${JSON.stringify({
      command: "npx ph bearshell --shell './gradlew test'",
      status: 0,
      tool: "bearshell",
      toolOutput: "BUILD SUCCESSFUL",
    })}\n`,
  )
}

function writeBuildFiles(projectDir: string): void {
  writeFileSync(
    join(projectDir, "build.gradle"),
    [
      "plugins {",
      "  id 'java'",
      "  id 'org.springframework.boot' version '3.5.0'",
      "  id 'io.spring.dependency-management' version '1.1.7'",
      "}",
      "",
      "repositories { mavenCentral() }",
      "",
      "java {",
      "  toolchain { languageVersion = JavaLanguageVersion.of(21) }",
      "}",
      "",
      "dependencies {",
      "  implementation 'org.springframework.boot:spring-boot-starter'",
      "  testImplementation 'org.springframework.boot:spring-boot-starter-test'",
      "}",
      "",
      "tasks.named('test') { useJUnitPlatform() }",
      "",
    ].join("\n"),
  )
  writeFileSync(
    join(projectDir, "src", "main", "java", "example", "cooperative", "CooperativeApplication.java"),
    [
      "package example.cooperative;",
      "",
      "import org.springframework.boot.autoconfigure.SpringBootApplication;",
      "",
      "@SpringBootApplication",
      "public class CooperativeApplication {",
      "  public static void main(String[] args) {",
      "    org.springframework.boot.SpringApplication.run(CooperativeApplication.class, args);",
      "  }",
      "}",
      "",
    ].join("\n"),
  )
  writeFileSync(
    join(projectDir, "src", "main", "java", "example", "cooperative", "GreetingService.java"),
    [
      "package example.cooperative;",
      "",
      "import org.springframework.stereotype.Service;",
      "",
      "@Service",
      "public class GreetingService {",
      "  public String greeting() {",
      "    return \"hello\";",
      "  }",
      "}",
      "",
    ].join("\n"),
  )
  writeFileSync(
    join(projectDir, "src", "test", "java", "example", "cooperative", "CooperativeApplicationTest.java"),
    [
      "package example.cooperative;",
      "",
      "import static org.junit.jupiter.api.Assertions.assertEquals;",
      "",
      "import org.junit.jupiter.api.Test;",
      "",
      "class CooperativeApplicationTest {",
      "  @Test",
      "  void addsTwoNumbers() {",
      "    assertEquals(4, 2 + 2);",
      "  }",
      "}",
      "",
    ].join("\n"),
  )
}

function profile(): Readonly<Record<string, unknown>> {
  return {
    defaults: { buildTool: "gradle", framework: "spring", language: "java" },
    questions: [
      { answer: "ko", id: "user-language" },
      { answer: "team", id: "project-context" },
      { answer: "production-service", id: "project-goal" },
      { answer: "long-lived", id: "project-scale" },
      { answer: "rest-api", id: "application-type" },
      { answer: "memory", id: "storage" },
      { answer: "none", id: "persistence-technology" },
      { answer: "none", id: "migration-style" },
      { answer: "domain-first", id: "package-style" },
      { answer: "clean-architecture-light", id: "architecture-style" },
      { answer: "strict", id: "boundary-strictness" },
    ],
    schema: "persona.project-profile.v1",
    scope: { mvp: "java-spring-clean-code", role: "backend" },
    status: "ready",
  }
}

export function hasRealJUnitResult(projectDir: string): boolean {
  return existsSync(realJUnitResultPath(projectDir))
}
