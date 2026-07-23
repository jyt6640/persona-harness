import { spawnSync } from "node:child_process"
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
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
    assertPackagedProjectFinishVerifierFailsClosedWithoutSourceCheckout(installedPackage, consumerDirectory)
    assertPackagedStagedArtifactVerifierWorksWithoutSourceCheckout(installedPackage, consumerDirectory)
    assertPackagedProjectFinishProducerIntake(installedPackage, consumerDirectory)
    assertPackedCooperativeFinishWorks(installedPackage, consumerDirectory)
    assertWorkflowLifecycleAbsenceBlocks(
      join(consumerDirectory, "workflow-lifecycle-absence-fixture"),
      join(consumerDirectory, "node_modules", ".bin", "ph"),
      "installed package",
    )
    assertInstalledPackageTestPasses(installedPackage)
    process.stdout.write("installed-package-test-contract: PASS\n")
  } else {
    assertSourceCooperativeFinishWorks(sourceCli)
    assertSourceWorkflowLifecycleAbsenceBlocks(sourceCli)
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

function assertPackagedProjectFinishVerifierFailsClosedWithoutSourceCheckout(installedPackage, consumerDirectory) {
  const workerPath = join(installedPackage, "scripts", "verify-project-finish-attestation.mjs")
  const modulePath = pathToFileURL(join(
    installedPackage,
    "dist",
    "cli",
    "project-finish-attestation-verifier.js",
  )).href
  const projectDir = join(consumerDirectory, "project-finish-verifier-local")
  const evidenceDirectory = join(projectDir, ".persona", "evidence", "project-finish-attestation")
  if (!existsSync(workerPath)) {
    throw new Error("installed package is missing the project finish verifier worker")
  }
  mkdirSync(evidenceDirectory, { recursive: true })
  writeFileSync(join(evidenceDirectory, "bundle.json"), '{"local":"unsigned"}\n')
  writeFileSync(join(evidenceDirectory, "predicate.json"), '{}\n')
  writeFileSync(join(evidenceDirectory, "receipt.json"), '{}\n')

  const probe = runNode(consumerDirectory, [
    "--input-type=module",
    "-e",
    [
      "import { inspectProjectFinishAttestation } from " + JSON.stringify(modulePath) + ";",
      'import { existsSync } from "node:fs";',
      'import { join } from "node:path";',
      'const projectDir = join(process.cwd(), "project-finish-verifier-local");',
      'const enrollment = { callerWorkflowPath: "project.yml", repositoryId: 123, repositorySlug: "example/public-project", reusableWorkflowSha: "b".repeat(40) };',
      'const result = inspectProjectFinishAttestation(projectDir, enrollment, new Date("2026-07-23T02:45:00.000Z"));',
      'const consumption = join(projectDir, ".persona", "evidence", "finish-attestation", "consumption.json");',
      'if (result.authorityEligible || result.state !== "malformed" || existsSync(consumption)) process.exit(1);',
    ].join("\n"),
  ])
  requireSuccess("installed project finish verifier no-source-fallback probe", probe)
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

function assertPackagedProjectFinishProducerIntake(installedPackage, consumerDirectory) {
  const modulePath = pathToFileURL(join(
    installedPackage,
    "dist",
    "cli",
    "project-finish-attestation-producer-runner.js",
  )).href
  const validProject = join(consumerDirectory, "project-finish-producer-valid")
  const hostileProject = join(consumerDirectory, "project-finish-producer-hostile")
  const replacementProject = join(consumerDirectory, "project-finish-producer-replacement")
  const symlinkProject = join(consumerDirectory, "project-finish-producer-symlink")
  const producerBin = join(consumerDirectory, ".persona-harness-producer", "node_modules", ".bin")
  createProjectFinishProducerFixture(validProject, "absent")
  createProjectFinishProducerFixture(hostileProject, "symlink-profile")
  createProjectFinishProducerFixture(replacementProject, "replace-profile")
  mkdirSync(producerBin, { recursive: true })
  symlinkSync("../outside", join(producerBin, "node"))
  symlinkSync("project-finish-producer-valid", symlinkProject)

  const probe = runNode(consumerDirectory, [
    "--input-type=module",
    "-e",
    [
      'import { execFileSync } from "node:child_process";',
      `import { runProjectFinishAttestationProducer } from ${JSON.stringify(modulePath)};`,
      'const context = (projectDir) => {',
      '  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: projectDir, encoding: "utf8" }).trim();',
      '  return {',
      '    callerWorkflowRef: "example/public-gradle-app/.github/workflows/project-finish.yml@refs/heads/main",',
      '    callerWorkflowSha: head,',
      '    issuedAt: "2026-07-22T01:00:00.000Z",',
      '    repository: { id: 123, slug: "example/public-gradle-app", visibility: "public" },',
      '    reusableWorkflowSha: "b".repeat(40),',
      '    runAttempt: 1,',
      '    runId: "42",',
      '    sourceHead: head,',
      '  };',
      '};',
      'const valid = runProjectFinishAttestationProducer("./project-finish-producer-valid", context("./project-finish-producer-valid"), "0.7.0");',
      'const hostile = runProjectFinishAttestationProducer("./project-finish-producer-hostile", context("./project-finish-producer-hostile"), "0.7.0");',
      'const symlinked = runProjectFinishAttestationProducer("./project-finish-producer-symlink", context("./project-finish-producer-symlink"), "0.7.0");',
      'if (valid.kind !== "passed" || hostile.kind !== "blocked" || hostile.code !== "project-finish-producer-profile" || symlinked.kind !== "blocked" || symlinked.code !== "workspace-root-unavailable") process.exit(1);',
      'if (valid.value.receipt.source.root !== "." || hostile.value !== undefined) process.exit(1);',
      'if (JSON.stringify(hostile).includes("sk-live-aaaaaaaaaaaaaaaaaaaaaaaa")) process.exit(1);',
    ].join("\n"),
  ])
  requireSuccess("installed project finish producer no-follow intake probe", probe)
  const replacementProbe = runNode(consumerDirectory, [
    "--input-type=module",
    "-e",
    [
      'import { execFileSync } from "node:child_process";',
      'import fs, { realpathSync, renameSync, symlinkSync, unlinkSync } from "node:fs";',
      'import { syncBuiltinESMExports } from "node:module";',
      'import { join } from "node:path";',
      `const modulePath = ${JSON.stringify(modulePath)};`,
      'const projectDir = "./project-finish-producer-replacement";',
      'const profilePath = realpathSync(join(projectDir, ".persona", "project-profile.jsonc"));',
      'const draftPath = join(projectDir, ".persona", "project-profile.draft.jsonc");',
      'const outsidePath = join(projectDir, "outside-profile.jsonc");',
      'const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: projectDir, encoding: "utf8" }).trim();',
      'const context = {',
      '  callerWorkflowRef: "example/public-gradle-app/.github/workflows/project-finish.yml@refs/heads/main",',
      '  callerWorkflowSha: head,',
      '  issuedAt: "2026-07-22T01:00:00.000Z",',
      '  repository: { id: 123, slug: "example/public-gradle-app", visibility: "public" },',
      '  reusableWorkflowSha: "b".repeat(40),',
      '  runAttempt: 1,',
      '  runId: "43",',
      '  sourceHead: head,',
      '};',
      'const originalOpen = fs.openSync;',
      'let swapped = false;',
      'fs.openSync = (...args) => {',
      '  if (!swapped && args[0] === profilePath) {',
      '    swapped = true;',
      '    renameSync(profilePath, draftPath);',
      '    symlinkSync(outsidePath, profilePath);',
      '  }',
      '  return originalOpen(...args);',
      '};',
      'syncBuiltinESMExports();',
      'try {',
      '  const { runProjectFinishAttestationProducer } = await import(modulePath);',
      '  const result = runProjectFinishAttestationProducer(projectDir, context, "0.7.0");',
      '  if (!swapped || result.kind !== "blocked" || result.code !== "project-finish-producer-profile") process.exit(1);',
      '  if ("value" in result || JSON.stringify(result).includes("sk-live-aaaaaaaaaaaaaaaaaaaaaaaa")) process.exit(1);',
      '} finally {',
      '  fs.openSync = originalOpen;',
      '  syncBuiltinESMExports();',
      '  if (swapped) {',
      '    unlinkSync(profilePath);',
      '    renameSync(draftPath, profilePath);',
      '  }',
      '}',
    ].join("\n"),
  ])
  requireSuccess("installed project finish producer replacement probe", replacementProbe)
  for (const projectDir of [validProject, hostileProject, replacementProject, symlinkProject]) {
    if (existsSync(join(projectDir, ".ci", "project-finish-attestation"))) {
      throw new Error("installed project finish producer created an artifact for a local intake probe")
    }
  }
}

function assertSourceCooperativeFinishWorks(sourceCliPath) {
  const phPath = resolve(repositoryRoot, sourceCliPath)
  if (!existsSync(phPath)) {
    throw new Error(`source CLI is missing: ${sourceCliPath}`)
  }
  assertCooperativeFinishWorks(join(temporaryRoot, "source-cli-cooperative-gradle-fixture"), phPath, "source CLI")
}

function assertSourceWorkflowLifecycleAbsenceBlocks(sourceCliPath) {
  const phPath = resolve(repositoryRoot, sourceCliPath)
  if (!existsSync(phPath)) {
    throw new Error(`source CLI is missing: ${sourceCliPath}`)
  }
  assertWorkflowLifecycleAbsenceBlocks(
    join(temporaryRoot, "source-cli-workflow-lifecycle-absence-fixture"),
    phPath,
    "source CLI",
  )
}

function assertWorkflowLifecycleAbsenceBlocks(fixtureRoot, phPath, label) {
  mkdirSync(fixtureRoot, { recursive: true })
  requireSuccess(`${label} lifecycle fixture intake`, runNode(fixtureRoot, [phPath, "intake", "--default", "backend"]))
  requireSuccess(`${label} lifecycle fixture plan`, runNode(fixtureRoot, [phPath, "plan"]))
  requireSuccess(`${label} lifecycle fixture plan acceptance`, runNode(fixtureRoot, [phPath, "plan", "--accept"]))
  mkdirSync(join(fixtureRoot, ".persona", "evidence", "phase0"), { recursive: true })
  writeFileSync(
    join(fixtureRoot, ".persona", "workflow", "implementation-report.md"),
    [
      "Status: filled",
      "- README ranges read: all",
      "- Project profile ranges read: all",
      "- `npx ph bearshell --shell './gradlew test'`",
    ].join("\n"),
  )
  writeFileSync(
    join(fixtureRoot, ".persona", "workflow", "review-report.md"),
    [
      "Status: filled",
      "- `npx ph bearshell --shell './gradlew build'`",
    ].join("\n"),
  )
  writeFileSync(
    join(fixtureRoot, ".persona", "evidence", "phase0", "verification.json"),
    `${JSON.stringify({
      command: "npx ph bearshell --shell './gradlew test'",
      status: 0,
      tool: "bearshell",
      toolOutput: "BUILD SUCCESSFUL",
    }, null, 2)}\n`,
  )

  const closure = runNode(fixtureRoot, [phPath, "workflow", "closure", "next", "--json"])
  requireSuccess(`${label} lifecycle absence closure`, closure)
  const payload = JSON.parse(closure.stdout)
  const lifecycle = isRecord(payload) && isRecord(payload.state) && isRecord(payload.state.lifecycle)
    ? payload.state.lifecycle
    : undefined
  const blockers = lifecycle !== undefined && Array.isArray(lifecycle.blockers)
    ? lifecycle.blockers.map((blocker) => isRecord(blocker) ? blocker.id : undefined)
    : []
  if (
    lifecycle === undefined
    || lifecycle.readiness !== "blocked"
    || !blockers.includes("workflow-loop-state-absent")
    || !blockers.includes("ralph-loop-state-absent")
  ) {
    throw new Error(`${label} lifecycle absence did not fail closed`)
  }
  if (closure.stdout.includes("sk-live-") || existsSync(join(fixtureRoot, ".persona", "evidence", "finish-attestation"))) {
    throw new Error(`${label} lifecycle absence probe reflected unsafe content or created authority evidence`)
  }
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

function createProjectFinishProducerFixture(projectDir, profileMode) {
  mkdirSync(join(projectDir, "src", "main", "java"), { recursive: true })
  writeFileSync(join(projectDir, "build.gradle"), "plugins { id 'java' }\n")
  writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'project-finish-producer'\n")
  writeFileSync(join(projectDir, "src", "main", "java", "App.java"), "class App {}\n")
  writeFileSync(
    join(projectDir, "gradlew"),
    [
      "#!/bin/sh",
      "case \"$*\" in",
      "  *cleanTest*)",
      "    mkdir -p build/test-results/test",
      "    printf '%s\\n' '<testsuite tests=\"1\" failures=\"0\" errors=\"0\" skipped=\"0\"><testcase name=\"works\"/></testsuite>' > build/test-results/test/TEST-producer.xml",
      "    printf '%s\\n' '> Task :cleanTest' '> Task :test' 'BUILD SUCCESSFUL'",
      "    ;;",
      "  *)",
      "    printf '%s\\n' '> Task :build' 'BUILD SUCCESSFUL'",
      "    ;;",
      "esac",
      "",
    ].join("\n"),
  )
  chmodSync(join(projectDir, "gradlew"), 0o755)
  if (profileMode === "symlink-profile") {
    const profileDirectory = join(projectDir, ".persona")
    const outside = join(projectDir, "outside-profile.jsonc")
    mkdirSync(profileDirectory)
    writeFileSync(outside, '{"marker":"sk-live-aaaaaaaaaaaaaaaaaaaaaaaa"}\n')
    symlinkSync(outside, join(profileDirectory, "project-profile.jsonc"))
  }
  if (profileMode === "replace-profile") {
    const profileDirectory = join(projectDir, ".persona")
    mkdirSync(profileDirectory)
    writeFileSync(
      join(profileDirectory, "project-profile.jsonc"),
      `${JSON.stringify({ ...cooperativeProfile(), status: "draft" })}\n`,
    )
    writeFileSync(
      join(projectDir, "outside-profile.jsonc"),
      `${JSON.stringify({ marker: "sk-live-aaaaaaaaaaaaaaaaaaaaaaaa", ...cooperativeProfile() })}\n`,
    )
  }
  requireSuccess("installed producer fixture Git init", runCommand(projectDir, "git", ["init", "-q"]))
  requireSuccess("installed producer fixture Git config email", runCommand(projectDir, "git", ["config", "user.email", "ph@example.invalid"]))
  requireSuccess("installed producer fixture Git config name", runCommand(projectDir, "git", ["config", "user.name", "PH Test"]))
  requireSuccess("installed producer fixture Git add", runCommand(projectDir, "git", ["add", "."]))
  requireSuccess("installed producer fixture Git commit", runCommand(projectDir, "git", ["commit", "-qm", "producer fixture"]))
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
