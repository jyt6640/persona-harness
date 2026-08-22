import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, dirname, isAbsolute, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const PROJECT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const KEEP_DEMO_PROJECT = process.argv.includes("--keep")

function commandResult(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd ?? PROJECT_DIR,
    encoding: "utf8",
    env: options.env,
    input: options.input,
    maxBuffer: 10 * 1024 * 1024,
  })
}

function run(command, args, options = {}) {
  const result = commandResult(command, args, options)
  if (result.status !== 0) {
    throw new Error(
      [
        `Command failed: ${[command, ...args].join(" ")}`,
        `cwd: ${options.cwd ?? PROJECT_DIR}`,
        result.stdout.trim(),
        result.stderr.trim(),
      ]
        .filter(Boolean)
        .join("\n"),
    )
  }
  return result.stdout
}

function resolvePackedTarball(packOutput, packDir) {
  const parsed = JSON.parse(packOutput)
  if (!Array.isArray(parsed) || parsed.length !== 1 || typeof parsed[0]?.filename !== "string") {
    throw new Error("npm pack did not return one tarball filename")
  }
  const filename = parsed[0].filename
  return isAbsolute(filename) ? filename : join(packDir, basename(filename))
}

function assertIncludes(label, source, expected) {
  if (!source.includes(expected)) {
    throw new Error(`${label} did not include expected text: ${expected}`)
  }
}

function createGradleFixture(projectDir, gradleEnvironment) {
  mkdirSync(join(projectDir, "src", "main", "java", "example", "cooperative"), { recursive: true })
  mkdirSync(join(projectDir, "src", "test", "java", "example", "cooperative"), { recursive: true })
  writeFileSync(join(projectDir, "README.md"), "# Cooperative Finish Demo\n\nA disposable Java/Spring verification fixture.\n")
  writeFileSync(join(projectDir, ".gitignore"), "node_modules/\n.gradle/\nbuild/\n")
  writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'persona-harness-cooperative-demo'\n")
  writeFileSync(join(projectDir, "gradle.properties"), "org.gradle.daemon=false\n")
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
  run("gradle", ["--no-daemon", "wrapper", "--gradle-version", "9.4.0", "--distribution-type", "bin"], {
    cwd: projectDir,
    env: gradleEnvironment,
  })
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
  run("./gradlew", ["--no-daemon", "test"], { cwd: projectDir, env: gradleEnvironment })
  rmSync(join(projectDir, ".gradle"), { recursive: true, force: true })
  rmSync(join(projectDir, "build"), { recursive: true, force: true })
  run("git", ["init", "--quiet"], { cwd: projectDir })
  run("git", ["config", "user.email", "persona-harness@example.invalid"], { cwd: projectDir })
  run("git", ["config", "user.name", "Persona Harness Demo"], { cwd: projectDir })
  run("git", ["add", "."], { cwd: projectDir })
  run("git", ["commit", "--quiet", "-m", "Create cooperative finish fixture"], { cwd: projectDir })
}

function prepareWorkflow(binPath, projectDir, environment) {
  run(binPath, ["intake", "--default", "backend"], { cwd: projectDir, env: environment })
  run(binPath, ["plan"], { cwd: projectDir, env: environment })
  run(binPath, ["bootstrap", "backend", "--strict", "--no-developer-mcp"], { cwd: projectDir, env: environment })
  run("git", ["add", "."], { cwd: projectDir })
  run("git", ["commit", "--quiet", "-m", "Prepare cooperative workflow"], { cwd: projectDir })
  run(binPath, ["bootstrap", "backend", "--strict", "--no-developer-mcp"], { cwd: projectDir, env: environment })
  run(binPath, ["plan", "--accept"], { cwd: projectDir, env: environment })
  run(binPath, ["bearshell", "./gradlew", "test"], { cwd: projectDir, env: environment })
  run(binPath, ["bearshell", "./gradlew", "compileJava"], { cwd: projectDir, env: environment })
  run(binPath, ["bearshell", "./gradlew", "clean"], { cwd: projectDir, env: environment })
  run(binPath, ["evidence", "read", "README.md"], { cwd: projectDir, env: environment })
  run(binPath, ["evidence", "read", ".persona/project-profile.jsonc"], { cwd: projectDir, env: environment })
  run(binPath, ["evidence", "read", "src/main/java/example/cooperative/GreetingService.java"], {
    cwd: projectDir,
    env: environment,
  })
  run(binPath, ["plan", "--report-filled", "implementation", "--stdin"], {
    cwd: projectDir,
    env: environment,
    input: [
      "Status: filled",
      "- README ranges read: all",
      "- Project profile ranges read: all",
      "- `npx ph bearshell ./gradlew test`",
      "- `npx ph bearshell ./gradlew compileJava`",
    ].join("\n"),
  })
  run(binPath, ["plan", "--report-filled", "review", "--stdin"], {
    cwd: projectDir,
    env: environment,
    input: [
      "Status: filled",
      "- Manual QA reviewed the Java/Spring Gradle fixture.",
      "- `npx ph bearshell ./gradlew clean`",
    ].join("\n"),
  })
}

const tempRoot = mkdtempSync(join(tmpdir(), "persona-cooperative-finish-demo-"))

try {
  const packDir = join(tempRoot, "pack")
  const demoProjectDir = join(tempRoot, "demo-project")
  const gradleUserHome = join(tempRoot, "gradle-user-home")
  const authorityHome = join(tempRoot, "authority-home")
  mkdirSync(packDir, { recursive: true })
  mkdirSync(demoProjectDir, { recursive: true })
  mkdirSync(gradleUserHome, { recursive: true })
  mkdirSync(authorityHome, { recursive: true })

  const gradleEnvironment = { ...process.env, GRADLE_USER_HOME: gradleUserHome }
  createGradleFixture(demoProjectDir, gradleEnvironment)

  const packOutput = run("npm", ["pack", "--json", "--pack-destination", packDir])
  const tarballPath = resolvePackedTarball(packOutput, packDir)
  run("npm", ["install", "--silent", "--no-audit", "--no-fund", tarballPath], { cwd: demoProjectDir })
  const binPath = join(demoProjectDir, "node_modules", ".bin", "ph")
  const environment = {
    ...gradleEnvironment,
    HOME: authorityHome,
    PH_BEARSHELL_TIMEOUT_MS: "120000",
  }

  const initialFinish = commandResult(binPath, ["workflow", "finish", "implement"], {
    cwd: demoProjectDir,
    env: environment,
  })
  const initialOutput = `${initialFinish.stdout}${initialFinish.stderr}`
  if (initialFinish.status === 0) {
    throw new Error("Initial Finish unexpectedly passed before workflow setup")
  }
  assertIncludes("initial Finish", initialOutput, "Blocker: workflow-state-uninitialized")
  assertIncludes("initial Finish", initialOutput, "Next action:")

  prepareWorkflow(binPath, demoProjectDir, environment)

  const cooperativeFinish = run(binPath, ["workflow", "finish", "implement", "--assurance", "cooperative"], {
    cwd: demoProjectDir,
    env: environment,
  })
  assertIncludes("cooperative Finish", cooperativeFinish, "Finish status: PASS")
  const junitPath = join(
    demoProjectDir,
    "build",
    "test-results",
    "test",
    "TEST-example.cooperative.CooperativeApplicationTest.xml",
  )
  if (!existsSync(junitPath) || !readFileSync(junitPath, "utf8").includes("<testcase")) {
    throw new Error("Cooperative Finish did not produce JUnit XML from the Gradle fixture")
  }

  console.log("Cooperative finish demo: PASS")
  console.log("Initial Finish: BLOCKED (workflow-state-uninitialized)")
  console.log("Final Finish: PASS (cooperative)")
  console.log("Gradle/JUnit: PASS")
  if (KEEP_DEMO_PROJECT) console.log(`Demo project kept: ${demoProjectDir}`)
} finally {
  if (!KEEP_DEMO_PROJECT) rmSync(tempRoot, { recursive: true, force: true })
}
