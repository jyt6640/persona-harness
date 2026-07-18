import { spawnSync } from "node:child_process"
import { copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const temporaryRoot = mkdtempSync(join(tmpdir(), "persona-installed-package-contract-"))
const consumerNpmCache = join(temporaryRoot, "npm-cache")
const sourceCli = sourceCliArgument(process.argv.slice(2))

try {
  if (sourceCli === undefined) {
    const tarballPath = packCurrentRepository()
    const { consumerDirectory, installedPackage } = installFreshTarball(tarballPath)

    assertRepositoryOnlyFilesAreAbsent(installedPackage)
    assertPackagedVerifierFailsClosedWithoutSourceCheckout(installedPackage, consumerDirectory)
    assertPackagedStagedArtifactVerifierWorksWithoutSourceCheckout(installedPackage, consumerDirectory)
    assertPackedCooperativeFinishWorks(installedPackage, consumerDirectory)
    assertInstalledPackageTestPasses(installedPackage)
    process.stdout.write("installed-package-test-contract: PASS\n")
  } else {
    assertSourceCooperativeFinishWorks(sourceCli)
    process.stdout.write("source-cli-cooperative-finish-contract: PASS\n")
  }
} finally {
  rmSync(temporaryRoot, { force: true, recursive: true })
}

function packCurrentRepository() {
  const packDirectory = join(temporaryRoot, "pack")
  mkdirSync(packDirectory)
  const result = runNpm(repositoryRoot, ["pack", "--json", "--pack-destination", packDirectory])
  requireSuccess("package pack", result)
  return resolvePackTarball(result.stdout, packDirectory)
}

function installFreshTarball(tarballPath) {
  const consumerDirectory = join(temporaryRoot, "consumer")
  mkdirSync(consumerDirectory)
  mkdirSync(consumerNpmCache)
  writeFileSync(
    join(consumerDirectory, "package.json"),
    `${JSON.stringify({ private: true }, null, 2)}\n`,
  )

  const result = runNpm(consumerDirectory, [
    "install",
    "--cache",
    consumerNpmCache,
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    tarballPath,
  ])
  requireSuccess("fresh package installation", result)
  return {
    consumerDirectory,
    installedPackage: join(consumerDirectory, "node_modules", "persona-harness"),
  }
}

function assertRepositoryOnlyFilesAreAbsent(installedPackage) {
  if (existsSync(join(installedPackage, "tests"))) {
    throw new Error("installed package unexpectedly contains repository tests")
  }
  if (existsSync(join(installedPackage, "src"))) {
    throw new Error("installed package unexpectedly contains repository source")
  }
  if (existsSync(join(installedPackage, ".git"))) {
    throw new Error("installed package unexpectedly contains repository Git metadata")
  }
  if (existsSync(join(installedPackage, "scripts", "check-mvp-scope.mjs"))) {
    throw new Error("installed package unexpectedly contains repository scope checks")
  }
}

function assertInstalledPackageTestPasses(installedPackage) {
  const result = runNpm(installedPackage, ["test"])
  requireSuccess("installed package test", result)
  if (!result.stdout.includes("Persona Harness")) {
    throw new Error("installed package test did not reach the packaged CLI help surface")
  }
}

function assertPackagedVerifierFailsClosedWithoutSourceCheckout(installedPackage, consumerDirectory) {
  const workerPath = join(installedPackage, "scripts", "verify-finish-attestation.mjs")
  if (!existsSync(workerPath)) {
    throw new Error("installed package is missing the product-owned verifier worker")
  }
  const bundlePath = join(consumerDirectory, ".persona", "evidence", "finish-attestation", "bundle.json")
  mkdirSync(dirname(bundlePath), { recursive: true })
  copyFileSync(
    join(repositoryRoot, "tests", "fixtures", "finish-attestation", "protected-main-29511625395.bundle.json"),
    bundlePath,
  )
  const modulePath = join(installedPackage, "dist", "cli", "workflow-finish-attestation.js")
  const probe = runNode(consumerDirectory, [
    "--input-type=module",
    "-e",
    `import { verifyExternalFinishAttestation } from ${JSON.stringify(modulePath)}; const result = verifyExternalFinishAttestation(process.cwd(), new Date("2026-07-16T16:00:00.000Z"), { consume: false }); if (result.authorityEligible || result.state !== "source-drift") process.exit(1);`,
  ])
  requireSuccess("installed packaged verifier fail-closed probe", probe)
}

function assertPackagedStagedArtifactVerifierWorksWithoutSourceCheckout(installedPackage, consumerDirectory) {
  const fixtureRoot = join(consumerDirectory, "staged-artifact-fixture")
  const packageFixtureRoot = join(repositoryRoot, "tests", "fixtures", "staged-package-artifact", "rc6")
  const corePath = join(installedPackage, "scripts", "staged-package-artifact-provenance-core.mjs")
  const workerPath = join(installedPackage, "scripts", "verify-staged-package-artifact-attestation.mjs")
  const phPath = join(consumerDirectory, "node_modules", ".bin", "ph")
  mkdirSync(fixtureRoot)
  for (const fileName of ["action-run.json", "bundle.json", "package.tgz"]) {
    copyFileSync(join(packageFixtureRoot, fileName), join(fixtureRoot, fileName))
  }
  if (!existsSync(corePath) || !existsSync(workerPath)) {
    throw new Error("installed package is missing staged artifact provenance code")
  }
  const help = runNode(consumerDirectory, [phPath, "dev", "staged-package-provenance", "--help"])
  requireSuccess("installed staged artifact verifier help", help)
  const probe = runNode(consumerDirectory, [
    "--input-type=module",
    "-e",
    [
      `import { verifyStagedPackageArtifactEvidence } from ${JSON.stringify(pathToFileURL(corePath).href)};`,
      'import { readFileSync } from "node:fs";',
      'import { join } from "node:path";',
      'const fixture = join(process.cwd(), "staged-artifact-fixture");',
      'const read = (name) => JSON.parse(readFileSync(join(fixture, name), "utf8"));',
      'const tarball = readFileSync(join(fixture, "package.tgz"));',
      'const attestation = { bundle: read("bundle.json"), repository_id: 1272008570 };',
      'const result = await verifyStagedPackageArtifactEvidence({',
      '  actionRun: read("action-run.json"),',
      '  attestation,',
      '  attestations: [attestation],',
      '  channel: "staging",',
      '  now: new Date("2026-07-17T12:00:00.000Z"),',
      '  registryIndex: { "dist-tags": { staging: "0.7.0-rc.6" } },',
      '  registryVersion: {',
      '    dist: { integrity: "sha512-Gf3g0U4YZ3fmD327ruboyPCEctMITx+0X9l7iUN9IKD82jWygwxVZS+tiYvYRSAn1udYW5Lq8QwldZ+4n7mY7Q==", shasum: "3fa7e7579e885ee9446f2e4b55bdaa13b1abf80e", tarball: "https://registry.npmjs.org/persona-harness/-/persona-harness-0.7.0-rc.6.tgz" },',
      '    gitHead: "1c8976c58102908329f63dc78286b2646bfc52dd",',
      '    name: "persona-harness",',
      '    version: "0.7.0-rc.6",',
      '  },',
      '  tarballBytes: tarball,',
      '  version: "0.7.0-rc.6",',
      '});',
      'if (result.channel !== "staging" || result.version !== "0.7.0-rc.6" || result.subjectDigest !== "sha256:37f679a0125c354d5f5c5c8ad933fe7a6e7d9e6df6ab892afdf06ed2310b7794") process.exit(1);',
    ].join("\n"),
  ])
  requireSuccess("installed staged artifact verifier exact-byte probe", probe)
}

function assertPackedCooperativeFinishWorks(installedPackage, consumerDirectory) {
  const fixtureRoot = join(consumerDirectory, "cooperative-gradle-fixture")
  const phPath = join(consumerDirectory, "node_modules", ".bin", "ph")
  assertCooperativeFinishWorks(fixtureRoot, phPath, "installed package")
}

function assertSourceCooperativeFinishWorks(sourceCliPath) {
  const phPath = resolve(repositoryRoot, sourceCliPath)
  if (!existsSync(phPath)) {
    throw new Error(`source CLI is missing: ${sourceCliPath}`)
  }
  assertCooperativeFinishWorks(join(temporaryRoot, "source-cli-cooperative-gradle-fixture"), phPath, "source CLI")
}

function assertCooperativeFinishWorks(fixtureRoot, phPath, label) {
  createCooperativeGradleFixture(fixtureRoot)

  const defaultFinish = runNode(fixtureRoot, [phPath, "workflow", "finish", "implement"])
  if (defaultFinish.status === 0) {
    throw new Error(`${label} default Finish unexpectedly accepted local cooperative evidence`)
  }
  const cooperativeFinish = runNode(fixtureRoot, [
    phPath,
    "workflow",
    "finish",
    "implement",
    "--assurance",
    "cooperative",
  ])
  requireSuccess(`${label} cooperative Finish`, cooperativeFinish)
  if (!cooperativeFinish.stdout.includes("Finish status: PASS")) {
    throw new Error(`${label} cooperative Finish did not report PASS`)
  }
  const closure = runNode(fixtureRoot, [phPath, "workflow", "closure", "next", "--json"])
  requireSuccess(`${label} external-only closure`, closure)
  if (!closure.stdout.includes("trusted-authority-required")) {
    throw new Error(`${label} closure did not remain external-only after cooperative Finish`)
  }
  const junitPath = join(
    fixtureRoot,
    "build",
    "test-results",
    "test",
    "TEST-example.cooperative.CooperativeApplicationTest.xml",
  )
  if (!existsSync(junitPath) || !readFileSync(junitPath, "utf8").includes("<testcase")) {
    throw new Error(`${label} cooperative Finish did not produce real JUnit XML`)
  }
  for (const directory of ["verification-attempts", "verification-receipts", "finish-attestation"]) {
    if (existsSync(join(fixtureRoot, ".persona", "custom-evidence", directory))) {
      throw new Error(`${label} cooperative Finish wrote forgeable authority directory ${directory}`)
    }
  }
}

function createCooperativeGradleFixture(projectDir) {
  mkdirSync(join(projectDir, ".persona", "custom-evidence", "phase0"), { recursive: true })
  mkdirSync(join(projectDir, ".persona", "workflow"), { recursive: true })
  mkdirSync(join(projectDir, "src", "main", "java", "example", "cooperative"), { recursive: true })
  mkdirSync(join(projectDir, "src", "test", "java", "example", "cooperative"), { recursive: true })
  writeFileSync(join(projectDir, "README.md"), "# Installed cooperative Gradle fixture\n")
  writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'installed-cooperative-gradle'\n")
  writeFileSync(
    join(projectDir, ".persona", "harness.jsonc"),
    `${JSON.stringify({
      enforce: { executeVerification: false },
      evidenceDir: ".persona/custom-evidence",
    })}\n`,
  )
  writeFileSync(join(projectDir, ".persona", "project-profile.jsonc"), `${JSON.stringify(cooperativeProfile())}\n`)
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
  requireSuccess(
    "installed fixture Gradle wrapper",
    runCommand(projectDir, "gradle", ["wrapper", "--gradle-version", "9.4.0", "--distribution-type", "bin"]),
  )
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
  requireSuccess("installed fixture Git init", runCommand(projectDir, "git", ["init", "-q"]))
  requireSuccess("installed fixture Git config email", runCommand(projectDir, "git", ["config", "user.email", "ph@example.invalid"]))
  requireSuccess("installed fixture Git config name", runCommand(projectDir, "git", ["config", "user.name", "PH Test"]))
  requireSuccess("installed fixture Git add", runCommand(projectDir, "git", ["add", "."]))
  requireSuccess("installed fixture Git commit", runCommand(projectDir, "git", ["commit", "-qm", "installed fixture"]))
}

function cooperativeProfile() {
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

function runNpm(cwd, args) {
  const result = spawnSync("npm", args, {
    cwd,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 4 * 1024 * 1024,
  })
  if (result.error) {
    throw new Error("npm process could not start")
  }
  return {
    status: result.status,
    stdout: result.stdout ?? "",
  }
}

function runCommand(cwd, command, args) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 16 * 1024 * 1024,
  })
  if (result.error) {
    throw new Error(`${command} process could not start`)
  }
  return {
    status: result.status,
    stdout: result.stdout ?? "",
  }
}

function runNode(cwd, args) {
  const result = spawnSync(process.execPath, args, {
    cwd,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 4 * 1024 * 1024,
  })
  if (result.error) {
    throw new Error("node process could not start")
  }
  return {
    status: result.status,
    stdout: result.stdout ?? "",
  }
}

function requireSuccess(label, result) {
  if (result.status !== 0) {
    throw new Error(`${label} failed`)
  }
}

function resolvePackTarball(output, packDirectory) {
  const parsed = JSON.parse(output)
  if (!Array.isArray(parsed) || parsed.length !== 1 || !isRecord(parsed[0]) || typeof parsed[0].filename !== "string") {
    throw new TypeError("npm pack did not return exactly one tarball")
  }

  const filename = parsed[0].filename
  const candidate = isAbsolute(filename)
    ? filename
    : join(packDirectory, basename(filename))
  const relativeCandidate = relative(packDirectory, candidate)
  if (relativeCandidate === "" || relativeCandidate.startsWith(`..${sep}`) || isAbsolute(relativeCandidate)) {
    throw new TypeError("npm pack returned a tarball outside the pack directory")
  }
  if (!existsSync(candidate)) {
    throw new TypeError("npm pack tarball is missing")
  }
  return candidate
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function sourceCliArgument(args) {
  if (args.length === 0) return undefined
  if (args.length === 2 && args[0] === "--source-cli" && args[1].trim() !== "") return args[1]
  throw new TypeError("usage: node scripts/test-installed-package-contract.mjs [--source-cli dist/cli/index.js]")
}
