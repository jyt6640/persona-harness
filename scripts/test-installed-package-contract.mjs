import { spawn, spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const temporaryRoot = mkdtempSync(join(tmpdir(), "persona-installed-package-contract-"))
const consumerNpmCache = join(temporaryRoot, "npm-cache")
const sourceCli = sourceCliArgument(process.argv.slice(2))
const BETA6_ACCEPTANCE_PATH = join("docs", "current", "release", "consumer-authority-beta6-acceptance.json")
const BETA6_COOPERATIVE_COMMANDS = new Map([
  ["ph bootstrap backend --strict --no-developer-mcp", { args: ["bootstrap", "backend", "--strict", "--no-developer-mcp"] }],
  ["ph bearshell ./gradlew test", { args: ["bearshell", "./gradlew", "test"] }],
  ["ph bearshell ./gradlew compileJava", { args: ["bearshell", "./gradlew", "compileJava"] }],
  ["ph bearshell ./gradlew clean", { args: ["bearshell", "./gradlew", "clean"] }],
  ["ph evidence read README.md", { args: ["evidence", "read", "README.md"] }],
  ["ph evidence read .persona/project-profile.jsonc", { args: ["evidence", "read", ".persona/project-profile.jsonc"] }],
  ["ph evidence read src/main/java/example/cooperative/GreetingService.java", {
    args: ["evidence", "read", "src/main/java/example/cooperative/GreetingService.java"],
  }],
  ["ph plan --report-filled implementation --stdin", {
    args: ["plan", "--report-filled", "implementation", "--stdin"],
    stdin: [
      "Status: filled",
      "- README ranges read: all",
      "- Project profile ranges read: all",
      "- `npx ph bearshell ./gradlew test`",
      "- `npx ph bearshell ./gradlew compileJava`",
    ].join("\n"),
  }],
  ["ph plan --report-filled review --stdin", {
    args: ["plan", "--report-filled", "review", "--stdin"],
    stdin: [
      "Status: filled",
      "- Manual QA reviewed the Java/Spring Gradle fixture.",
      "- `npx ph bearshell ./gradlew clean`",
    ].join("\n"),
  }],
])

try {
  if (sourceCli === undefined) {
    const packed = packCurrentRepository()
    const { consumerDirectory, installedPackage } = installFreshTarball(packed.tarballPath)

    assertRepositoryOnlyFilesAreAbsent(installedPackage)
    assertPackagedVerifierFailsClosedWithoutSourceCheckout(installedPackage, consumerDirectory)
    assertPackagedProjectFinishVerifierFailsClosedWithoutSourceCheckout(installedPackage, consumerDirectory)
    assertPackagedConsumerAuthorityBoundary(installedPackage, consumerDirectory)
    assertPackagedStagedArtifactVerifierWorksWithoutSourceCheckout(installedPackage, consumerDirectory)
    assertDoctorRegistryReadback(
      join(consumerDirectory, "doctor-registry-fixture"),
      join(consumerDirectory, "node_modules", ".bin", "ph"),
      installedPackage,
      "installed package",
    )
    assertPackagedProjectFinishProducerIntake(installedPackage, consumerDirectory)
    assertPackedCooperativeFinishWorks(installedPackage, consumerDirectory)
    assertPackagedEvidenceReadWriteBoundary(installedPackage, consumerDirectory)
    await assertPackagedBoundedReportStdin(installedPackage, consumerDirectory)
    assertWorkflowLifecycleAbsenceBlocks(
      join(consumerDirectory, "workflow-lifecycle-absence-fixture"),
      join(consumerDirectory, "node_modules", ".bin", "ph"),
      "installed package",
    )
    assertBootstrapWorkspaceIntake(
      join(consumerDirectory, "workflow-lifecycle-state-intake-fixture"),
      join(consumerDirectory, "node_modules", ".bin", "ph"),
      "installed package",
    )
    assertInstalledPackageTestPasses(installedPackage)
    process.stdout.write(`installed-package-artifact: ${JSON.stringify(packed.facts)}\n`)
    process.stdout.write("installed-package-test-contract: PASS\n")
  } else {
    assertSourceConsumerAuthorityBoundary(sourceCli)
    assertSourceDoctorRegistryReadback(sourceCli)
    assertSourceProjectFinishProducerIntake(sourceCli)
    assertSourceCooperativeFinishWorks(sourceCli)
    assertSourceEvidenceReadWriteBoundary(sourceCli)
    await assertSourceBoundedReportStdin(sourceCli)
    assertSourceWorkflowLifecycleAbsenceBlocks(sourceCli)
    assertSourceBootstrapWorkspaceIntake(sourceCli)
    process.stdout.write("source-cli-cooperative-finish-contract: PASS\n")
  }
} finally {
  rmSync(temporaryRoot, { force: true, recursive: true })
}

function assertPackagedConsumerAuthorityBoundary(installedPackage, consumerDirectory) {
  const scripts = [
    "consumer-authority-artifact-archive.mjs",
    "consumer-authority-artifact-error.mjs",
    "fetch-consumer-authority-artifact.mjs",
    "read-consumer-authority-github.mjs",
  ]
  for (const script of scripts) {
    if (!existsSync(join(installedPackage, "scripts", script))) {
      throw new Error("installed package is missing consumer authority transport")
    }
  }
  assertConsumerAuthorityBoundary(
    consumerDirectory,
    join(consumerDirectory, "node_modules", ".bin", "ph"),
    join(consumerDirectory, "consumer-authority-home"),
    "installed package",
  )
}

function assertSourceConsumerAuthorityBoundary(sourceCliPath) {
  const phPath = resolve(repositoryRoot, sourceCliPath)
  if (!existsSync(phPath)) {
    throw new Error(`source CLI is missing: ${sourceCliPath}`)
  }
  assertConsumerAuthorityBoundary(
    temporaryRoot,
    phPath,
    join(temporaryRoot, "source-consumer-authority-home"),
    "source CLI",
  )
}

function assertConsumerAuthorityBoundary(cwd, phPath, home, label) {
  mkdirSync(home, { recursive: true })
  const unauthenticatedEnvironment = { GH_TOKEN: "", GITHUB_TOKEN: "", HOME: home }
  const help = runNode(cwd, [phPath, "authority", "--help"], unauthenticatedEnvironment)
  requireSuccess(`${label} authority help`, help)
  if (!help.stdout.includes("fetch github")) {
    throw new Error(`${label} authority help omitted the enrolled evidence route`)
  }
  const nonInteractiveEnrollment = runNode(
    cwd,
    [
      phPath,
      "authority",
      "enroll",
      "github",
      "jyt6640/persona-harness-attestation-claim-fixture",
      "--workflow",
      ".github/workflows/persona-harness.yml",
    ],
    { ...unauthenticatedEnvironment, GH_TOKEN: "ghp_packaged_boundary_probe" },
  )
  if (
    nonInteractiveEnrollment.status === 0
    || !nonInteractiveEnrollment.stderr.includes("interactive confirmation")
    || `${nonInteractiveEnrollment.stdout}${nonInteractiveEnrollment.stderr}`.includes(home)
  ) {
    throw new Error(`${label} authority enrollment did not preserve the interactive boundary`)
  }
  assertBoundedAuthorityAbsence(
    [
      runNode(cwd, [phPath, "authority", "status", "--json"], unauthenticatedEnvironment),
      runNode(cwd, [phPath, "authority", "fetch", "github", "--json"], unauthenticatedEnvironment),
      runNode(cwd, [phPath, "authority", "explain", "--json"], unauthenticatedEnvironment),
    ],
    home,
    label,
    {
      githubAuthentication: "unavailable",
      next: "github-authenticate",
      state: "authentication-unavailable",
    },
  )
  const authenticatedEnvironment = {
    ...unauthenticatedEnvironment,
    GH_TOKEN: "ghp_packaged_boundary_probe",
  }
  assertBoundedAuthorityAbsence(
    [
      runNode(cwd, [phPath, "authority", "status", "--json"], authenticatedEnvironment),
      runNode(cwd, [phPath, "authority", "fetch", "github", "--json"], authenticatedEnvironment),
      runNode(cwd, [phPath, "authority", "explain", "--json"], authenticatedEnvironment),
    ],
    home,
    label,
    {
      githubAuthentication: "available",
      next: "authority-enroll-github",
      state: "enrollment-unavailable",
    },
  )
  if (existsSync(join(home, ".persona-harness"))) {
    throw new Error(`${label} authority absence created local evidence`)
  }
}

function assertBoundedAuthorityAbsence(results, home, label, expected) {
  for (const result of results) {
    if (result.status === 0) {
      throw new Error(`${label} authority unexpectedly trusted absent enrollment`)
    }
    const payload = JSON.parse(result.stdout)
    if (
      !isRecord(payload)
      || payload["authorityEligible"] !== false
      || payload["consumptionState"] !== "not-applicable"
      || payload["enrollment"] !== "unavailable"
      || payload["githubAuthentication"] !== expected.githubAuthentication
      || payload["next"] !== expected.next
      || payload["state"] !== expected.state
      || JSON.stringify(payload).includes(home)
    ) {
      throw new Error(`${label} authority absence did not remain bounded`)
    }
  }
}

function packCurrentRepository() {
  const packDirectory = join(temporaryRoot, "pack")
  mkdirSync(packDirectory)
  const result = runNpm(repositoryRoot, ["pack", "--json", "--pack-destination", packDirectory])
  requireSuccess("package pack", result)
  return resolvePackResult(result.stdout, packDirectory)
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
  const errorClassifierPath = join(
    installedPackage,
    "scripts",
    "project-finish-attestation-sigstore-error.mjs",
  )
  const modulePath = pathToFileURL(join(
    installedPackage,
    "dist",
    "cli",
    "project-finish-attestation-verifier.js",
  )).href
  const projectDir = join(consumerDirectory, "project-finish-verifier-local")
  const evidenceDirectory = join(projectDir, ".persona", "evidence", "project-finish-attestation")
  if (!existsSync(workerPath) || !existsSync(errorClassifierPath)) {
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
      'if (result.authorityEligible || result.state !== "malformed-bundle" || existsSync(consumption)) process.exit(1);',
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
  assertCooperativeFinishWorks(
    fixtureRoot,
    phPath,
    "installed package",
    readBeta6CooperativeCommands(installedPackage),
  )
}

function assertPackagedEvidenceReadWriteBoundary(installedPackage, consumerDirectory) {
  assertEvidenceReadWriteBoundary(
    join(consumerDirectory, "evidence-read-write-boundary"),
    join(consumerDirectory, "node_modules", ".bin", "ph"),
    "installed package",
  )
}

async function assertPackagedBoundedReportStdin(installedPackage, consumerDirectory) {
  await assertBoundedReportStdin(
    join(consumerDirectory, "bounded-report-stdin"),
    join(consumerDirectory, "node_modules", ".bin", "ph"),
    "installed package",
  )
}

function assertPackagedProjectFinishProducerIntake(installedPackage, consumerDirectory) {
  assertProjectFinishProducerIntake(
    pathToFileURL(join(installedPackage, "dist", "cli", "project-finish-attestation-producer-runner.js")).href,
    consumerDirectory,
    "installed package",
  )
}

function assertSourceProjectFinishProducerIntake(sourceCliPath) {
  const sourceModule = resolve(repositoryRoot, "dist", "cli", "project-finish-attestation-producer-runner.js")
  if (!existsSync(sourceModule) || !existsSync(resolve(repositoryRoot, sourceCliPath))) {
    throw new Error("source project finish producer runtime is missing")
  }
  assertProjectFinishProducerIntake(
    pathToFileURL(sourceModule).href,
    join(temporaryRoot, "source-cli-project-finish-producer-intake"),
    "source CLI",
  )
}

function assertProjectFinishProducerIntake(modulePath, fixtureRoot, label) {
  const validProject = join(fixtureRoot, "project-finish-producer-valid")
  const hostileProject = join(fixtureRoot, "project-finish-producer-hostile")
  const replacementProject = join(fixtureRoot, "project-finish-producer-replacement")
  const sourceReplacementProject = join(fixtureRoot, "project-finish-producer-source-replacement")
  const symlinkProject = join(fixtureRoot, "project-finish-producer-symlink")
  const producerBin = join(fixtureRoot, ".persona-harness-producer", "node_modules", ".bin")
  createProjectFinishProducerFixture(validProject, "absent")
  createProjectFinishProducerFixture(hostileProject, "symlink-profile")
  createProjectFinishProducerFixture(replacementProject, "replace-profile")
  createProjectFinishProducerFixture(sourceReplacementProject, "absent")
  mkdirSync(producerBin, { recursive: true })
  symlinkSync("../outside", join(producerBin, "node"))
  symlinkSync("project-finish-producer-valid", symlinkProject)

  const probe = runNode(fixtureRoot, [
    "--input-type=module",
    "-e",
    [
      'import { execFileSync } from "node:child_process";',
      `import { runProjectFinishAttestationProducer } from ${JSON.stringify(modulePath)};`,
      'const runAt = (projectDir, runId) => {',
      '  const original = process.cwd();',
      '  process.chdir(projectDir);',
      '  try {',
      '    const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();',
      '    return runProjectFinishAttestationProducer(".", {',
      '    callerWorkflowRef: "example/public-gradle-app/.github/workflows/project-finish.yml@refs/heads/main",',
      '    callerWorkflowSha: head,',
      '    issuedAt: "2026-07-22T01:00:00.000Z",',
      '    repository: { id: 123, slug: "example/public-gradle-app", visibility: "public" },',
      '    reusableWorkflowSha: "b".repeat(40),',
      '    runAttempt: 1,',
      '    runId,',
      '    sourceHead: head,',
      '    }, "0.8.0-beta.6");',
      '  } finally { process.chdir(original); }',
      '};',
      'const valid = runAt("./project-finish-producer-valid", "42");',
      'const hostile = runAt("./project-finish-producer-hostile", "43");',
      'const directHead = execFileSync("git", ["rev-parse", "HEAD"], { cwd: "./project-finish-producer-valid", encoding: "utf8" }).trim();',
      'const symlinked = runProjectFinishAttestationProducer("./project-finish-producer-symlink", { callerWorkflowRef: "example/public-gradle-app/.github/workflows/project-finish.yml@refs/heads/main", callerWorkflowSha: directHead, issuedAt: "2026-07-22T01:00:00.000Z", repository: { id: 123, slug: "example/public-gradle-app", visibility: "public" }, reusableWorkflowSha: "b".repeat(40), runAttempt: 1, runId: "44", sourceHead: directHead }, "0.8.0-beta.6");',
      'if (valid.kind !== "passed" || hostile.kind !== "blocked" || symlinked.kind !== "blocked" || symlinked.code !== "workspace-root-unavailable") process.exit(1);',
      'if (valid.value.receipt.source.root !== "." || hostile.value !== undefined) process.exit(1);',
      'if (JSON.stringify(hostile).includes("sk-live-aaaaaaaaaaaaaaaaaaaaaaaa")) process.exit(1);',
    ].join("\n"),
  ])
  requireSuccess("installed project finish producer no-follow intake probe", probe)
  const replacementProbe = runNode(fixtureRoot, [
    "--input-type=module",
    "-e",
    [
      'import childProcess, { execFileSync } from "node:child_process";',
      'import { renameSync } from "node:fs";',
      'import { syncBuiltinESMExports } from "node:module";',
      'import { join, resolve } from "node:path";',
      `const modulePath = ${JSON.stringify(modulePath)};`,
      'const projectDir = resolve("./project-finish-producer-replacement");',
      'const profilePath = join(projectDir, ".persona", "project-profile.jsonc");',
      'const draftPath = join(projectDir, ".persona", "project-profile.draft.jsonc");',
      'const outsidePath = join(projectDir, "outside-profile.jsonc");',
      'const originalSpawnSync = childProcess.spawnSync;',
      'let swapped = false;',
      'childProcess.spawnSync = (command, args, options) => {',
      '  const result = originalSpawnSync(command, args, options);',
      '  if (!swapped && Array.isArray(args) && args[0] === "tree") {',
      '    swapped = true;',
      '    renameSync(profilePath, draftPath);',
      '    renameSync(outsidePath, profilePath);',
      '  }',
      '  return result;',
      '};',
      'syncBuiltinESMExports();',
      'try {',
      '  const { runProjectFinishAttestationProducer } = await import(modulePath);',
      '  const original = process.cwd(); process.chdir(projectDir);',
      '  let result;',
      '  try { const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(); result = runProjectFinishAttestationProducer(".", { callerWorkflowRef: "example/public-gradle-app/.github/workflows/project-finish.yml@refs/heads/main", callerWorkflowSha: head, issuedAt: "2026-07-22T01:00:00.000Z", repository: { id: 123, slug: "example/public-gradle-app", visibility: "public" }, reusableWorkflowSha: "b".repeat(40), runAttempt: 1, runId: "45", sourceHead: head }, "0.8.0-beta.6"); } finally { process.chdir(original); }',
      '  if (!swapped || result.kind !== "blocked") process.exit(1);',
      '  if ("value" in result || JSON.stringify(result).includes("sk-live-aaaaaaaaaaaaaaaaaaaaaaaa")) process.exit(1);',
      '} finally {',
      '  childProcess.spawnSync = originalSpawnSync;',
      '  syncBuiltinESMExports();',
      '}',
    ].join("\n"),
  ])
  requireSuccess("installed project finish producer replacement probe", replacementProbe)
  const sourceReplacementProbe = runNode(fixtureRoot, [
    "--input-type=module",
    "-e",
    [
      'import childProcess, { execFileSync } from "node:child_process";',
      'import { mkdirSync, renameSync, writeFileSync } from "node:fs";',
      'import { syncBuiltinESMExports } from "node:module";',
      'import { join, resolve } from "node:path";',
      `const modulePath = ${JSON.stringify(modulePath)};`,
      'const projectDir = resolve("./project-finish-producer-source-replacement");',
      'const sourceDirectory = join(projectDir, "src", "main", "java");',
      'const draftDirectory = join(projectDir, "src", "main", "java.draft");',
      'const outsideDirectory = resolve("./project-finish-producer-outside-source");',
      'const outsideSource = join(outsideDirectory, "App.java");',
      'mkdirSync(outsideDirectory);',
      'writeFileSync(outsideSource, "class App { String token = \\\"sk-live-aaaaaaaaaaaaaaaaaaaaaaaa\\\"; }\\n");',
      'const originalSpawnSync = childProcess.spawnSync;',
      'let swapped = false;',
      'childProcess.spawnSync = (command, args, options) => {',
      '  const result = originalSpawnSync(command, args, options);',
      '  if (!swapped && Array.isArray(args) && args[0] === "tree") {',
      '    swapped = true;',
      '    renameSync(sourceDirectory, draftDirectory);',
      '    renameSync(outsideDirectory, sourceDirectory);',
      '  }',
      '  return result;',
      '};',
      'syncBuiltinESMExports();',
      'try {',
      '  const { runProjectFinishAttestationProducer } = await import(modulePath);',
      '  const original = process.cwd(); process.chdir(projectDir);',
      '  let result;',
      '  try { const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(); result = runProjectFinishAttestationProducer(".", { callerWorkflowRef: "example/public-gradle-app/.github/workflows/project-finish.yml@refs/heads/main", callerWorkflowSha: head, issuedAt: "2026-07-22T01:00:00.000Z", repository: { id: 123, slug: "example/public-gradle-app", visibility: "public" }, reusableWorkflowSha: "b".repeat(40), runAttempt: 1, runId: "46", sourceHead: head }, "0.8.0-beta.6"); } finally { process.chdir(original); }',
      '  if (!swapped || result.kind !== "blocked") process.exit(1);',
      '  if ("value" in result || JSON.stringify(result).includes("sk-live-aaaaaaaaaaaaaaaaaaaaaaaa")) process.exit(1);',
      '} finally {',
      '  childProcess.spawnSync = originalSpawnSync;',
      '  syncBuiltinESMExports();',
      '}',
    ].join("\n"),
  ])
  requireSuccess("installed project finish producer source replacement probe", sourceReplacementProbe)
  for (const projectDir of [validProject, hostileProject, replacementProject, sourceReplacementProject, symlinkProject]) {
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
  assertCooperativeFinishWorks(
    join(temporaryRoot, "source-cli-cooperative-gradle-fixture"),
    phPath,
    "source CLI",
    readBeta6CooperativeCommands(repositoryRoot),
  )
}

async function assertSourceBoundedReportStdin(sourceCliPath) {
  const phPath = resolve(repositoryRoot, sourceCliPath)
  if (!existsSync(phPath)) {
    throw new Error(`source CLI is missing: ${sourceCliPath}`)
  }
  await assertBoundedReportStdin(
    join(temporaryRoot, "source-cli-bounded-report-stdin"),
    phPath,
    "source CLI",
  )
}

async function assertBoundedReportStdin(fixtureRoot, phPath, label) {
  const workflowDirectory = join(fixtureRoot, ".persona", "workflow")
  const reportPath = join(workflowDirectory, "implementation-report.md")
  const template = "Status: template\n"
  const report = [
    "Status: filled",
    "- README ranges read: all",
    "- Project profile ranges read: all",
    "- `npx ph bearshell ./gradlew test`",
  ].join("\n")
  const writeTemplate = () => {
    mkdirSync(workflowDirectory, { recursive: true })
    writeFileSync(reportPath, template)
  }
  const assertUnchanged = (scenario) => {
    if (readFileSync(reportPath, "utf8") !== template) {
      throw new Error(`${label} ${scenario} unexpectedly wrote the workflow report`)
    }
  }

  writeTemplate()
  const success = runNode(
    fixtureRoot,
    [phPath, "plan", "--report-filled", "implementation", "--stdin"],
    {},
    report,
  )
  requireSuccess(`${label} bounded report stdin success`, success)
  if (!readFileSync(reportPath, "utf8").includes("Status: filled")) {
    throw new Error(`${label} bounded report stdin did not write the valid report`)
  }
  const repeated = runNode(
    fixtureRoot,
    [phPath, "plan", "--report-filled", "implementation", "--stdin"],
    {},
    report,
  )
  if (repeated.status === 0 || !repeated.stderr.includes("after it has left template status")) {
    throw new Error(`${label} repeated bounded report stdin did not fail closed`)
  }

  writeTemplate()
  const malformed = runNode(
    fixtureRoot,
    [phPath, "plan", "--report-filled", "implementation", "--stdin"],
    {},
    report.replace("Status: filled", "Status: template"),
  )
  if (malformed.status === 0 || !malformed.stderr.includes("must declare exactly one filled Status value")) {
    throw new Error(`${label} malformed bounded report stdin did not fail closed`)
  }
  assertUnchanged("malformed stdin")

  writeTemplate()
  const control = runNode(
    fixtureRoot,
    [phPath, "plan", "--report-filled", "implementation", "--stdin"],
    {},
    `${report}\u0000`,
  )
  if (control.status === 0 || !control.stderr.includes("contains unsupported control characters")) {
    throw new Error(`${label} control-character report stdin did not fail closed`)
  }
  assertUnchanged("control-character stdin")

  writeTemplate()
  const oversized = runNode(
    fixtureRoot,
    [phPath, "plan", "--report-filled", "implementation", "--stdin"],
    {},
    `${report}\n${"x".repeat(64 * 1024)}`,
  )
  if (oversized.status === 0 || !oversized.stderr.includes("exceeds the 65536-byte limit")) {
    throw new Error(`${label} finite oversized report stdin did not fail closed`)
  }
  assertUnchanged("finite oversized stdin")

  writeTemplate()
  const continuous = await runContinuousReportPipe(fixtureRoot, phPath)
  if (
    continuous.status === 0
    || continuous.timedOut
    || !continuous.stderr.includes("exceeds the 65536-byte limit")
    || continuous.stdout.includes("stdin-boundary-marker")
    || continuous.stderr.includes("stdin-boundary-marker")
  ) {
    throw new Error(`${label} continuous oversized report stdin did not fail closed promptly`)
  }
  assertUnchanged("continuous oversized stdin")
}

function runContinuousReportPipe(cwd, phPath) {
  const marker = "stdin-boundary-marker"
  const producerScript = [
    `const chunk = Buffer.from(${JSON.stringify(`${marker}\n`.repeat(512))});`,
    "function write() {",
    "  if (process.stdout.write(chunk)) { setImmediate(write); return; }",
    "  process.stdout.once('drain', write);",
    "}",
    "write();",
  ].join("\n")
  const startedAt = Date.now()
  const cli = spawn(process.execPath, [phPath, "plan", "--report-filled", "implementation", "--stdin"], {
    cwd,
    env: process.env,
    stdio: ["pipe", "pipe", "pipe"],
  })
  const producer = spawn(process.execPath, ["-e", producerScript], {
    cwd,
    stdio: ["ignore", "pipe", "ignore"],
  })
  cli.stdin.on("error", () => {})
  producer.stdout.on("error", () => {})

  let stdout = ""
  let stderr = ""
  cli.stdout.on("data", (chunk) => {
    if (stdout.length < 4096) {
      stdout += chunk.toString("utf8").slice(0, 4096 - stdout.length)
    }
  })
  cli.stderr.on("data", (chunk) => {
    if (stderr.length < 4096) {
      stderr += chunk.toString("utf8").slice(0, 4096 - stderr.length)
    }
  })

  return new Promise((resolve) => {
    let settled = false
    const settle = (result) => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timeout)
      producer.kill("SIGKILL")
      if (!cli.killed) {
        cli.kill("SIGKILL")
      }
      resolve({ ...result, stderr, stdout })
    }
    const timeout = setTimeout(() => {
      settle({ elapsedMs: Date.now() - startedAt, status: null, timedOut: true })
    }, 3000)
    cli.once("close", (status) => {
      settle({ elapsedMs: Date.now() - startedAt, status, timedOut: false })
    })
    producer.stdout.once("data", (chunk) => {
      if (!cli.stdin.destroyed) {
        cli.stdin.write(chunk)
        producer.stdout.pipe(cli.stdin)
      }
    })
  })
}

function assertSourceDoctorRegistryReadback(sourceCliPath) {
  const phPath = resolve(repositoryRoot, sourceCliPath)
  if (!existsSync(phPath)) {
    throw new Error(`source CLI is missing: ${sourceCliPath}`)
  }
  assertDoctorRegistryReadback(
    join(temporaryRoot, "source-cli-doctor-registry-fixture"),
    phPath,
    repositoryRoot,
    "source CLI",
  )
}

function assertDoctorRegistryReadback(fixtureRoot, phPath, packageRoot, label) {
  const installedVersion = readPackageVersion(packageRoot)
  mkdirSync(join(fixtureRoot, ".opencode"), { recursive: true })
  mkdirSync(join(fixtureRoot, ".persona"), { recursive: true })
  writeFileSync(
    join(fixtureRoot, "AGENTS.md"),
    [
      "<!-- persona-harness:agents:start schema=persona-harness.agents.v1 -->",
      "# Persona Harness Agent Instructions",
      "",
      "- Run `npx ph workflow implement` before implementation.",
      "- Run `npx ph workflow finish implement` before claiming completion.",
      "<!-- persona-harness:agents:end -->",
      "",
    ].join("\n"),
  )
  writeFileSync(
    join(fixtureRoot, ".opencode", "opencode.json"),
    `${JSON.stringify({ plugin: ["persona-harness"] }, null, 2)}\n`,
  )
  writeFileSync(
    join(fixtureRoot, ".persona", "harness.jsonc"),
    `${JSON.stringify({ enforce: { executeVerification: false } }, null, 2)}\n`,
  )

  const result = runNode(
    fixtureRoot,
    [phPath, "doctor", "--json"],
    {
      PH_DOCTOR_OPENCODE_VERSION: "1.0.0-installed-test",
      PH_DOCTOR_REGISTRY_DEPRECATED: JSON.stringify("deprecated test-only marker"),
      PH_DOCTOR_REGISTRY_DIST_TAGS: JSON.stringify({
        latest: installedVersion,
        next: "0.7.0-rc.3",
        staging: "0.7.0-rc.8",
      }),
    },
  )
  requireSuccess(`${label} doctor registry readback`, result)
  const payload = JSON.parse(result.stdout)
  if (
    !isRecord(payload)
    || !isRecord(payload.registry)
    || !isRecord(payload.authority)
    || !isRecord(payload.sigstore)
  ) {
    throw new Error(`${label} doctor registry readback did not return a bounded JSON object`)
  }
  const channels = payload.registry.channels
  if (
    !isRecord(channels)
    || channels["installed"] !== installedVersion
    || channels["latest"] !== installedVersion
    || channels["next"] !== "0.7.0-rc.3"
    || channels["staging"] !== "0.7.0-rc.8"
    || channels["legacy"] !== "retired"
    || payload.registry.deprecation !== "present"
    || payload.authority.finish !== "blocked"
    || !["blocked", "ready", "unverified"].includes(payload.sigstore.networkReadiness)
    || !["blocked", "ready"].includes(payload.sigstore.trustRootReadiness)
    || typeof payload.sigstore.state !== "string"
  ) {
    throw new Error(`${label} doctor registry readback violated the non-authoritative channel contract`)
  }
  if (
    result.stdout.includes("deprecated test-only marker")
    || result.stdout.includes(repositoryRoot)
    || result.stdout.includes(fixtureRoot)
  ) {
    throw new Error(`${label} doctor registry readback reflected an unsafe local fact`)
  }
}

function readPackageVersion(packageRoot) {
  const parsed = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"))
  if (!isRecord(parsed) || typeof parsed.version !== "string" || parsed.version.length === 0) {
    throw new Error("doctor registry package version is unavailable")
  }
  return parsed.version
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

function assertSourceBootstrapWorkspaceIntake(sourceCliPath) {
  const phPath = resolve(repositoryRoot, sourceCliPath)
  if (!existsSync(phPath)) {
    throw new Error(`source CLI is missing: ${sourceCliPath}`)
  }
  assertBootstrapWorkspaceIntake(
    join(temporaryRoot, "source-cli-workflow-lifecycle-state-intake-fixture"),
    phPath,
    "source CLI",
  )
}

function assertSourceEvidenceReadWriteBoundary(sourceCliPath) {
  const phPath = resolve(repositoryRoot, sourceCliPath)
  if (!existsSync(phPath)) {
    throw new Error(`source CLI is missing: ${sourceCliPath}`)
  }
  assertEvidenceReadWriteBoundary(
    join(temporaryRoot, "source-cli-evidence-read-write-boundary"),
    phPath,
    "source CLI",
  )
}

function assertBootstrapWorkspaceIntake(fixtureRoot, phPath, label) {
  assertProjectRootRaceBlocks(join(fixtureRoot, "project-root-race"), phPath, label)
  assertCapturedProjectAgentStageRaceBlocks(join(fixtureRoot, "agent-stage-race"), phPath, label)
  assertProjectRootAliasesBlock(join(fixtureRoot, "project-root-alias"), phPath, label)
  assertFreshPersonaParentRaceBlocks(join(fixtureRoot, "fresh-persona-race"), phPath, label)
  assertLifecycleStateParentAliasBlocks(join(fixtureRoot, "parent-alias"), phPath, label)
  assertLifecycleStateLeafAliasesBlock(join(fixtureRoot, "leaf-alias"), phPath, label)
  assertLifecycleStateParentRaceBlocks(join(fixtureRoot, "parent-race"), phPath, label)
  assertLifecycleStateLeafRacesBlock(join(fixtureRoot, "leaf-race"), phPath, label)
}

function assertEvidenceReadWriteBoundary(fixtureRoot, phPath, label) {
  assertEvidenceReadParentAliasBlocks(join(fixtureRoot, "parent-alias"), phPath, label)
  assertEvidenceReadParentRaceBlocks(join(fixtureRoot, "parent-race"), phPath, label)
  assertEvidenceReadSourceParentAliasBlocks(join(fixtureRoot, "source-parent-alias"), phPath, label)
  assertEvidenceReadSourceParentRaceBlocks(join(fixtureRoot, "source-parent-race"), phPath, label)
  assertEvidenceReadSourceLeafAliasBlocks(join(fixtureRoot, "source-leaf-alias"), phPath, label)
  assertEvidenceReadSourceLeafRaceBlocks(join(fixtureRoot, "source-leaf-race"), phPath, label)
  assertEvidenceReadProjectRootRaceBlocks(join(fixtureRoot, "source-root-race"), phPath, label)
}

function assertEvidenceReadSourceParentAliasBlocks(projectDir, phPath, label) {
  createLifecycleStateIntakeFixture(projectDir)
  requireSuccess(`${label} evidence read source parent alias bootstrap`, runNode(projectDir, [phPath, "bootstrap", "backend", "--strict", "--no-developer-mcp"]))
  const sourceParent = join(projectDir, "src", "main", "java")
  const outside = join(projectDir, "outside-source")
  rmSync(sourceParent, { force: true, recursive: true })
  mkdirSync(outside)
  writeFileSync(join(outside, "App.java"), "class ExternalApp {}\n")
  symlinkSync(outside, sourceParent)

  const result = runNode(projectDir, [phPath, "evidence", "read", "src/main/java/App.java"])

  requireEvidenceReadBlock(`${label} evidence read source parent alias`, result, outside)
  if (!lstatSync(sourceParent).isSymbolicLink()) {
    throw new Error(`${label} evidence read source parent alias lost its containment probe`)
  }
}

function assertEvidenceReadSourceParentRaceBlocks(projectDir, phPath, label) {
  createLifecycleStateIntakeFixture(projectDir)
  requireSuccess(`${label} evidence read source race bootstrap`, runNode(projectDir, [phPath, "bootstrap", "backend", "--strict", "--no-developer-mcp"]))
  const sourceParent = join(projectDir, "src", "main", "java")
  const preserved = join(projectDir, "src", "main", "java-preserved")
  const outside = join(projectDir, "outside-source")
  const hookPath = join(projectDir, "evidence-read-source-race-hook.cjs")
  mkdirSync(outside)
  writeFileSync(join(outside, "App.java"), "class ExternalApp {}\n")
  writeFileSync(hookPath, [
    'const childProcess = require("node:child_process")',
    'const { syncBuiltinESMExports } = require("node:module")',
    'const originalSpawnSync = childProcess.spawnSync',
    'let swapped = false',
    'childProcess.spawnSync = (command, args, options) => {',
    '  const result = originalSpawnSync(command, args, options)',
    '  if (!swapped && Array.isArray(args) && args[0] === "tree") {',
    '    swapped = true',
    '    require("node:fs").renameSync(process.env.PH_SOURCE_PARENT, process.env.PH_SOURCE_PRESERVED)',
    '    require("node:fs").renameSync(process.env.PH_SOURCE_OUTSIDE, process.env.PH_SOURCE_PARENT)',
    '  }',
    '  return result',
    '}',
    'syncBuiltinESMExports()',
    '',
  ].join("\n"))
  const result = runNode(projectDir, ["--require", hookPath, phPath, "evidence", "read", "src/main/java/App.java"], {
    PH_SOURCE_OUTSIDE: outside,
    PH_SOURCE_PARENT: sourceParent,
    PH_SOURCE_PRESERVED: preserved,
  })
  requireEvidenceReadBlock(`${label} evidence read source parent race`, result, outside)
  if (!existsSync(preserved) || !lstatSync(sourceParent).isDirectory() || !readFileSync(join(sourceParent, "App.java"), "utf8").includes("ExternalApp")) {
    throw new Error(`${label} evidence read source parent race opened external bytes`)
  }
}

function assertEvidenceReadSourceLeafAliasBlocks(projectDir, phPath, label) {
  createLifecycleStateIntakeFixture(projectDir)
  requireSuccess(`${label} evidence read source leaf alias bootstrap`, runNode(projectDir, [phPath, "bootstrap", "backend", "--strict", "--no-developer-mcp"]))
  const source = join(projectDir, "src", "main", "java", "App.java")
  const outside = join(projectDir, "outside-source.java")
  writeFileSync(outside, "class ExternalApp {}\n")
  rmSync(source)
  symlinkSync(outside, source)

  const result = runNode(projectDir, [phPath, "evidence", "read", "src/main/java/App.java"])

  requireEvidenceReadBlock(`${label} evidence read source leaf alias`, result, outside)
  if (!lstatSync(source).isSymbolicLink()) {
    throw new Error(`${label} evidence read source leaf alias lost its containment probe`)
  }
}

function assertEvidenceReadSourceLeafRaceBlocks(projectDir, phPath, label) {
  createLifecycleStateIntakeFixture(projectDir)
  requireSuccess(`${label} evidence read source leaf race bootstrap`, runNode(projectDir, [phPath, "bootstrap", "backend", "--strict", "--no-developer-mcp"]))
  const source = join(projectDir, "src", "main", "java", "App.java")
  const preserved = join(projectDir, "src", "main", "java", "App.draft.java")
  const outside = join(projectDir, "outside-source.java")
  const hookPath = join(projectDir, "evidence-read-source-leaf-race-hook.cjs")
  writeFileSync(outside, "class ExternalApp {}\n")
  writeFileSync(hookPath, [
    'const childProcess = require("node:child_process")',
    'const { syncBuiltinESMExports } = require("node:module")',
    'const originalSpawnSync = childProcess.spawnSync',
    'let swapped = false',
    'childProcess.spawnSync = (command, args, options) => {',
    '  const result = originalSpawnSync(command, args, options)',
    '  if (!swapped && Array.isArray(args) && args[0] === "tree") {',
    '    swapped = true',
    '    require("node:fs").renameSync(process.env.PH_SOURCE_FILE, process.env.PH_SOURCE_PRESERVED)',
    '    require("node:fs").renameSync(process.env.PH_SOURCE_OUTSIDE, process.env.PH_SOURCE_FILE)',
    '  }',
    '  return result',
    '}',
    'syncBuiltinESMExports()',
    '',
  ].join("\n"))
  const result = runNode(projectDir, ["--require", hookPath, phPath, "evidence", "read", "src/main/java/App.java"], {
    PH_SOURCE_FILE: source,
    PH_SOURCE_OUTSIDE: outside,
    PH_SOURCE_PRESERVED: preserved,
  })
  requireEvidenceReadBlock(`${label} evidence read source leaf race`, result, outside)
  if (!existsSync(preserved) || !lstatSync(source).isFile() || !readFileSync(source, "utf8").includes("ExternalApp")) {
    throw new Error(`${label} evidence read source leaf race opened external bytes`)
  }
}

function assertEvidenceReadProjectRootRaceBlocks(projectDir, phPath, label) {
  createLifecycleStateIntakeFixture(projectDir)
  requireSuccess(`${label} evidence read root race bootstrap`, runNode(projectDir, [phPath, "bootstrap", "backend", "--strict", "--no-developer-mcp"]))
  const preserved = `${projectDir}-preserved`
  const outside = `${projectDir}-outside`
  const hookPath = join(projectDir, "evidence-read-project-root-race-hook.cjs")
  mkdirSync(outside)
  mkdirSync(join(outside, "src", "main", "java"), { recursive: true })
  writeFileSync(join(outside, "src", "main", "java", "App.java"), "class ExternalApp {}\n")
  writeFileSync(hookPath, [
    'const childProcess = require("node:child_process")',
    'const { syncBuiltinESMExports } = require("node:module")',
    'const originalSpawnSync = childProcess.spawnSync',
    'let swapped = false',
    'childProcess.spawnSync = (command, args, options) => {',
    '  const result = originalSpawnSync(command, args, options)',
    '  if (!swapped && Array.isArray(args) && args[0] === "tree") {',
    '    swapped = true',
    '    require("node:fs").renameSync(process.env.PH_SOURCE_PROJECT, process.env.PH_SOURCE_PRESERVED)',
    '    require("node:fs").renameSync(process.env.PH_SOURCE_OUTSIDE, process.env.PH_SOURCE_PROJECT)',
    '  }',
    '  return result',
    '}',
    'syncBuiltinESMExports()',
    '',
  ].join("\n"))
  const result = runNode(projectDir, ["--require", hookPath, phPath, "evidence", "read", "src/main/java/App.java"], {
    PH_SOURCE_OUTSIDE: outside,
    PH_SOURCE_PRESERVED: preserved,
    PH_SOURCE_PROJECT: projectDir,
  })
  requireEvidenceReadBlock(`${label} evidence read root race`, result, outside)
  if (!existsSync(preserved) || !lstatSync(projectDir).isDirectory() || !readFileSync(join(projectDir, "src", "main", "java", "App.java"), "utf8").includes("ExternalApp")) {
    throw new Error(`${label} evidence read root race opened external bytes`)
  }
}

function assertEvidenceReadParentAliasBlocks(projectDir, phPath, label) {
  createLifecycleStateIntakeFixture(projectDir)
  requireSuccess(`${label} evidence read alias bootstrap`, runNode(projectDir, [phPath, "bootstrap", "backend", "--strict", "--no-developer-mcp"]))
  const evidenceRoot = join(projectDir, ".persona", "evidence")
  const outside = join(projectDir, "outside-evidence")
  rmSync(evidenceRoot, { force: true, recursive: true })
  mkdirSync(join(outside, "phase0"), { recursive: true })
  symlinkSync(outside, evidenceRoot)

  const result = runNode(projectDir, [phPath, "evidence", "read", "README.md"])

  requireEvidenceReadBlock(`${label} evidence read parent alias`, result, outside)
  if (!lstatSync(evidenceRoot).isSymbolicLink() || readdirSync(join(outside, "phase0")).length !== 0) {
    throw new Error(`${label} evidence read parent alias wrote outside its canonical root`)
  }
}

function assertEvidenceReadParentRaceBlocks(projectDir, phPath, label) {
  createLifecycleStateIntakeFixture(projectDir)
  requireSuccess(`${label} evidence read race bootstrap`, runNode(projectDir, [phPath, "bootstrap", "backend", "--strict", "--no-developer-mcp"]))
  const evidenceRoot = join(projectDir, ".persona", "evidence")
  const preserved = join(projectDir, ".persona", "evidence-preserved")
  const outside = join(projectDir, "outside-evidence")
  const hookPath = join(projectDir, "evidence-read-race-hook.cjs")
  mkdirSync(join(evidenceRoot, "phase0"), { recursive: true })
  mkdirSync(join(outside, "phase0"), { recursive: true })
  writeFileSync(
    hookPath,
    [
      'const fs = require("node:fs")',
      'const { basename } = require("node:path")',
      'const { syncBuiltinESMExports } = require("node:module")',
      'const originalOpen = fs.openSync',
      'const originalWrite = fs.writeFileSync',
      'let swapped = false',
      'const swap = () => {',
      '  if (swapped) return',
      '  swapped = true',
      '  fs.renameSync(process.env.PH_EVIDENCE_ROOT, process.env.PH_EVIDENCE_PRESERVED)',
      '  fs.symlinkSync(process.env.PH_EVIDENCE_OUTSIDE, process.env.PH_EVIDENCE_ROOT)',
      '}',
      'fs.openSync = (...args) => {',
      '  if (typeof args[0] === "string" && basename(args[0]).startsWith(".workflow-read-")) swap()',
      '  return originalOpen(...args)',
      '}',
      'fs.writeFileSync = (...args) => {',
      '  if (typeof args[0] === "string" && basename(args[0]).startsWith(".workflow-read-")) swap()',
      '  return originalWrite(...args)',
      '}',
      'syncBuiltinESMExports()',
      '',
    ].join("\n"),
  )

  const result = runNode(
    projectDir,
    ["--require", hookPath, phPath, "evidence", "read", "README.md"],
    {
      PH_EVIDENCE_OUTSIDE: outside,
      PH_EVIDENCE_PRESERVED: preserved,
      PH_EVIDENCE_ROOT: evidenceRoot,
    },
  )

  requireEvidenceReadBlock(`${label} evidence read parent race`, result, outside)
  if (!lstatSync(evidenceRoot).isSymbolicLink() || readdirSync(join(outside, "phase0")).length !== 0) {
    throw new Error(`${label} evidence read parent race wrote outside its canonical root`)
  }
}

function assertCapturedProjectAgentStageRaceBlocks(projectDir, phPath, label) {
  createLifecycleStateIntakeFixture(projectDir)
  const canonicalProjectDir = realpathSync(projectDir)
  const preserved = join(dirname(projectDir), `${basename(projectDir)}-preserved`)
  const outside = join(dirname(projectDir), `${basename(projectDir)}-outside`)
  const hookPath = join(projectDir, "agent-stage-race-hook.cjs")
  mkdirSync(outside)
  writeFileSync(
    hookPath,
    [
      'const fs = require("node:fs")',
      'const { basename } = require("node:path")',
      'const { syncBuiltinESMExports } = require("node:module")',
      'const originalOpen = fs.openSync',
      'const originalWrite = fs.writeFileSync',
      'let swapped = false',
      'const swap = () => {',
      '  if (swapped) return',
      '  swapped = true',
      '  fs.renameSync(process.env.PH_BOOTSTRAP_AGENT_PROJECT, process.env.PH_BOOTSTRAP_AGENT_PRESERVED)',
      '  fs.symlinkSync(process.env.PH_BOOTSTRAP_AGENT_OUTSIDE, process.env.PH_BOOTSTRAP_AGENT_PROJECT)',
      '}',
      'fs.openSync = (...args) => {',
      '  if (typeof args[0] === "string" && basename(args[0]).startsWith(".AGENTS.md.")) swap()',
      '  return originalOpen(...args)',
      '}',
      'fs.writeFileSync = (...args) => {',
      '  if (typeof args[0] === "string" && basename(args[0]).startsWith(".AGENTS.md.")) swap()',
      '  return originalWrite(...args)',
      '}',
      'syncBuiltinESMExports()',
      '',
    ].join("\n"),
  )
  const rerun = runNode(
    projectDir,
    ["--require", hookPath, phPath, "bootstrap", "backend", "--strict", "--no-developer-mcp"],
    {
      PH_BOOTSTRAP_AGENT_OUTSIDE: outside,
      PH_BOOTSTRAP_AGENT_PRESERVED: preserved,
      PH_BOOTSTRAP_AGENT_PROJECT: canonicalProjectDir,
    },
  )

  requireLifecycleStateBlock(`${label} AGENTS staging race`, rerun, outside)
  if (!lstatSync(projectDir).isSymbolicLink() || readdirSync(outside).length !== 0) {
    throw new Error(`${label} AGENTS staging race wrote outside its canonical root`)
  }
}

function assertProjectRootAliasesBlock(projectDir, phPath, label) {
  for (const relativePath of [".gitignore", ".opencode/opencode.json"]) {
    const caseRoot = join(projectDir, relativePath.replaceAll("/", "-"))
    createLifecycleStateIntakeFixture(caseRoot)
    const target = join(caseRoot, relativePath)
    const outside = join(caseRoot, `outside-${relativePath.replaceAll("/", "-")}`)
    mkdirSync(dirname(target), { recursive: true })
    symlinkSync(outside, target)

    const rerun = runNode(caseRoot, [phPath, "bootstrap", "backend", "--strict", "--no-developer-mcp"])

    requireLifecycleStateBlock(`${label} root ${relativePath} alias`, rerun, outside)
    if (existsSync(outside) || !lstatSync(target).isSymbolicLink()) {
      throw new Error(`${label} root ${relativePath} alias was replaced or wrote outside`)
    }
  }

  const parentRoot = join(projectDir, "opencode-parent")
  createLifecycleStateIntakeFixture(parentRoot)
  const parent = join(parentRoot, ".opencode")
  const outside = join(parentRoot, "outside-opencode-parent")
  mkdirSync(outside)
  symlinkSync(outside, parent)

  const rerun = runNode(parentRoot, [phPath, "bootstrap", "backend", "--strict", "--no-developer-mcp"])

  requireLifecycleStateBlock(`${label} root .opencode parent alias`, rerun, outside)
  if (readdirSync(outside).length !== 0 || !lstatSync(parent).isSymbolicLink()) {
    throw new Error(`${label} root .opencode parent alias wrote outside`)
  }
}

function assertProjectRootRaceBlocks(projectDir, phPath, label) {
  createLifecycleStateIntakeFixture(projectDir)
  const canonicalProjectDir = realpathSync(projectDir)
  const preserved = join(dirname(projectDir), `${basename(projectDir)}-preserved`)
  const outside = join(dirname(projectDir), `${basename(projectDir)}-outside`)
  const hookPath = join(projectDir, "project-root-race-hook.cjs")
  mkdirSync(outside)
  writeFileSync(
    hookPath,
    [
      'const fs = require("node:fs")',
      'const { syncBuiltinESMExports } = require("node:module")',
      'const originalOpen = fs.openSync',
      'let swapped = false',
      'fs.openSync = (...args) => {',
      '  if (!swapped && args[0] === ".gitignore") {',
      '    swapped = true',
      '    fs.renameSync(process.env.PH_BOOTSTRAP_ROOT_PROJECT, process.env.PH_BOOTSTRAP_ROOT_PRESERVED)',
      '    fs.symlinkSync(process.env.PH_BOOTSTRAP_ROOT_OUTSIDE, process.env.PH_BOOTSTRAP_ROOT_PROJECT)',
      '  }',
      '  return originalOpen(...args)',
      '}',
      'syncBuiltinESMExports()',
      '',
    ].join("\n"),
  )
  const rerun = runNode(
    projectDir,
    ["--require", hookPath, phPath, "bootstrap", "backend", "--strict", "--no-developer-mcp"],
    {
      PH_BOOTSTRAP_ROOT_OUTSIDE: outside,
      PH_BOOTSTRAP_ROOT_PRESERVED: preserved,
      PH_BOOTSTRAP_ROOT_PROJECT: canonicalProjectDir,
    },
  )

  requireLifecycleStateBlock(`${label} project root race`, rerun, outside)
  if (!lstatSync(projectDir).isSymbolicLink() || readdirSync(outside).length !== 0) {
    throw new Error(`${label} project root race wrote outside its canonical root`)
  }
}

function assertFreshPersonaParentRaceBlocks(projectDir, phPath, label) {
  createLifecycleStateIntakeFixture(projectDir)
  const personaDir = join(projectDir, ".persona")
  const preserved = join(projectDir, ".persona-preserved")
  const outside = join(projectDir, "outside-fresh-persona")
  const hookPath = join(projectDir, "fresh-persona-race-hook.cjs")
  mkdirSync(outside)
  writeFileSync(
    hookPath,
    [
      'const fs = require("node:fs")',
      'const { syncBuiltinESMExports } = require("node:module")',
      'const originalRename = fs.renameSync',
      'let swapped = false',
      'fs.renameSync = (...args) => {',
      '  const result = originalRename(...args)',
      '  if (!swapped && args[1] === ".persona") {',
      '    swapped = true',
      '    originalRename(process.env.PH_BOOTSTRAP_FRESH_PERSONA_TEXT, process.env.PH_BOOTSTRAP_FRESH_PRESERVED)',
      '    fs.symlinkSync(process.env.PH_BOOTSTRAP_FRESH_OUTSIDE, process.env.PH_BOOTSTRAP_FRESH_PERSONA_TEXT)',
      '  }',
      '  return result',
      '}',
      'syncBuiltinESMExports()',
      '',
    ].join("\n"),
  )
  const rerun = runNode(
    projectDir,
    ["--require", hookPath, phPath, "bootstrap", "backend", "--strict", "--no-developer-mcp"],
    {
      PH_BOOTSTRAP_FRESH_OUTSIDE: outside,
      PH_BOOTSTRAP_FRESH_PERSONA_TEXT: personaDir,
      PH_BOOTSTRAP_FRESH_PRESERVED: preserved,
    },
  )

  requireLifecycleStateBlock(`${label} fresh persona parent race`, rerun, outside)
  if (!lstatSync(personaDir).isSymbolicLink() || readdirSync(outside).length !== 0) {
    throw new Error(`${label} fresh Persona parent race wrote outside its canonical root`)
  }
}

function assertLifecycleStateParentAliasBlocks(projectDir, phPath, label) {
  createLifecycleStateIntakeFixture(projectDir)
  requireSuccess(`${label} lifecycle state parent bootstrap`, runNode(projectDir, [phPath, "bootstrap", "backend", "--strict", "--no-developer-mcp"]))
  const workflowDir = join(projectDir, ".persona", "workflow")
  const preserved = join(projectDir, ".persona", "workflow-preserved")
  const outside = join(projectDir, "outside-workflow")
  mkdirSync(outside)
  renameSync(workflowDir, preserved)
  symlinkSync(outside, workflowDir)

  const rerun = runNode(projectDir, [phPath, "bootstrap", "backend", "--strict", "--no-developer-mcp"])

  requireLifecycleStateBlock(`${label} lifecycle state parent alias`, rerun, outside)
  if (workflowBootstrapFiles(outside).length !== 0 || !existsSync(join(preserved, "workflow-loop-state.json")) || !existsSync(join(preserved, "ralph-loop-state.json"))) {
    throw new Error(`${label} bootstrap workspace parent alias wrote outside its canonical root`)
  }
}

function assertLifecycleStateLeafAliasesBlock(projectDir, phPath, label) {
  for (const stateName of lifecycleStateFileNames()) {
    const caseRoot = join(projectDir, stateName)
    createLifecycleStateIntakeFixture(caseRoot)
    requireSuccess(`${label} lifecycle state ${stateName} bootstrap`, runNode(caseRoot, [phPath, "bootstrap", "backend", "--strict"]))
    const statePath = join(caseRoot, ".persona", "workflow", stateName)
    const outside = join(caseRoot, `outside-${stateName}`)
    unlinkSync(statePath)
    symlinkSync(outside, statePath)

    const rerun = runNode(caseRoot, [phPath, "bootstrap", "backend", "--strict"])

    requireLifecycleStateBlock(`${label} lifecycle state ${stateName} alias`, rerun, outside)
    if (existsSync(outside) || !lstatSync(statePath).isSymbolicLink()) {
      throw new Error(`${label} lifecycle state ${stateName} alias was replaced or wrote outside`)
    }
  }
}

function assertLifecycleStateParentRaceBlocks(projectDir, phPath, label) {
  createLifecycleStateIntakeFixture(projectDir)
  requireSuccess(`${label} lifecycle state race bootstrap`, runNode(projectDir, [phPath, "bootstrap", "backend", "--strict", "--no-developer-mcp"]))
  const workflowDir = join(projectDir, ".persona", "workflow")
  const preserved = join(projectDir, ".persona", "workflow-preserved")
  const outside = join(projectDir, "outside-workflow")
  const hookPath = join(projectDir, "workflow-state-race-hook.cjs")
  const canonicalWorkflowDir = realpathSync(workflowDir)
  mkdirSync(outside)
  writeFileSync(
    hookPath,
    [
      'const fs = require("node:fs")',
      'const { syncBuiltinESMExports } = require("node:module")',
      'const originalOpen = fs.openSync',
      'let swapped = false',
      'fs.openSync = (...args) => {',
      '  if (!swapped && args[0] === process.env.PH_LIFECYCLE_RACE_WORKFLOW) {',
      '    swapped = true',
      '    fs.renameSync(process.env.PH_LIFECYCLE_RACE_WORKFLOW_TEXT, process.env.PH_LIFECYCLE_RACE_PRESERVED)',
      '    fs.symlinkSync(process.env.PH_LIFECYCLE_RACE_OUTSIDE, process.env.PH_LIFECYCLE_RACE_WORKFLOW_TEXT)',
      '  }',
      '  return originalOpen(...args)',
      '}',
      'syncBuiltinESMExports()',
      '',
    ].join("\n"),
  )
  const rerun = runNode(
    projectDir,
    ["--require", hookPath, phPath, "bootstrap", "backend", "--strict", "--no-developer-mcp"],
    {
      PH_LIFECYCLE_RACE_OUTSIDE: outside,
      PH_LIFECYCLE_RACE_PRESERVED: preserved,
      PH_LIFECYCLE_RACE_WORKFLOW: canonicalWorkflowDir,
      PH_LIFECYCLE_RACE_WORKFLOW_TEXT: workflowDir,
    },
  )

  requireLifecycleStateBlock(`${label} lifecycle state parent race`, rerun, outside)
  if (!lstatSync(workflowDir).isSymbolicLink() || workflowBootstrapFiles(outside).length !== 0) {
    throw new Error(`${label} bootstrap workspace parent race did not preserve canonical containment`)
  }
}

function assertLifecycleStateLeafRacesBlock(projectDir, phPath, label) {
  for (const stateName of lifecycleStateFileNames()) {
    const caseRoot = join(projectDir, stateName)
    createLifecycleStateIntakeFixture(caseRoot)
    requireSuccess(`${label} lifecycle state ${stateName} race bootstrap`, runNode(caseRoot, [phPath, "bootstrap", "backend", "--strict"]))
    const workflowDir = join(caseRoot, ".persona", "workflow")
    const statePath = join(realpathSync(workflowDir), stateName)
    const outside = join(caseRoot, `outside-race-${stateName}`)
    const hookPath = join(caseRoot, `workflow-state-${stateName}-race-hook.cjs`)
    writeFileSync(
      hookPath,
      [
        'const fs = require("node:fs")',
        'const { syncBuiltinESMExports } = require("node:module")',
        'const originalOpen = fs.openSync',
        'let swapped = false',
        'fs.openSync = (...args) => {',
        '  if (!swapped && args[0] === process.env.PH_LIFECYCLE_RACE_STATE) {',
        '    swapped = true',
        '    fs.unlinkSync(process.env.PH_LIFECYCLE_RACE_STATE)',
        '    fs.symlinkSync(process.env.PH_LIFECYCLE_RACE_OUTSIDE, process.env.PH_LIFECYCLE_RACE_STATE)',
        '  }',
        '  return originalOpen(...args)',
        '}',
        'syncBuiltinESMExports()',
        '',
      ].join("\n"),
    )
    const rerun = runNode(
      caseRoot,
      ["--require", hookPath, phPath, "bootstrap", "backend", "--strict"],
      {
        PH_LIFECYCLE_RACE_OUTSIDE: outside,
        PH_LIFECYCLE_RACE_STATE: statePath,
      },
    )

    requireLifecycleStateBlock(`${label} lifecycle state ${stateName} race`, rerun, outside)
    if (existsSync(outside) || !lstatSync(statePath).isSymbolicLink()) {
      throw new Error(`${label} lifecycle state ${stateName} race did not preserve canonical containment`)
    }
  }
}

function createLifecycleStateIntakeFixture(projectDir) {
  mkdirSync(join(projectDir, "src", "main", "java"), { recursive: true })
  writeFileSync(join(projectDir, "README.md"), "# Lifecycle state intake fixture\n")
  writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'lifecycle-state-intake'\n")
  writeFileSync(join(projectDir, "build.gradle"), "plugins { id 'java' }\n")
  writeFileSync(join(projectDir, "src", "main", "java", "App.java"), "class App {}\n")
  writeFileSync(join(projectDir, "gradlew"), "#!/bin/sh\nprintf '%s\\n' 'BUILD SUCCESSFUL'\n")
  chmodSync(join(projectDir, "gradlew"), 0o755)
  requireSuccess("lifecycle fixture Git init", runCommand(projectDir, "git", ["init", "-q"]))
  requireSuccess("lifecycle fixture Git email", runCommand(projectDir, "git", ["config", "user.email", "fixture@example.invalid"]))
  requireSuccess("lifecycle fixture Git name", runCommand(projectDir, "git", ["config", "user.name", "Fixture"]))
  requireSuccess("lifecycle fixture Git add", runCommand(projectDir, "git", ["add", "."]))
  requireSuccess("lifecycle fixture Git commit", runCommand(projectDir, "git", ["commit", "-qm", "lifecycle fixture"]))
}

function lifecycleStateFileNames() {
  return ["workflow-loop-state.json", "ralph-loop-state.json"]
}

function lifecycleStateFiles(directory) {
  return lifecycleStateFileNames().filter((name) => existsSync(join(directory, name)))
}

function workflowBootstrapFiles(directory) {
  return [
    "plan.md",
    "roles.md",
    "implementation-report.md",
    "review-report.md",
    ...lifecycleStateFileNames(),
  ].filter((name) => existsSync(join(directory, name)))
}

function requireLifecycleStateBlock(label, result, outside) {
  if (result.status === 0 || `${result.stdout}${result.stderr}`.includes(outside)) {
    throw new Error(`${label} did not block with bounded output`)
  }
  for (const authorityDirectory of ["finish-attestation", "project-finish-attestation", "verification-receipts"]) {
    if (existsSync(join(dirname(outside), ".persona", "evidence", authorityDirectory))) {
      throw new Error(`${label} created authority evidence while blocked`)
    }
  }
}

function requireEvidenceReadBlock(label, result, outside) {
  if (result.status === 0 || `${result.stdout}${result.stderr}`.includes(outside)) {
    throw new Error(`${label} did not block with bounded output`)
  }
  for (const authorityDirectory of ["finish-attestation", "project-finish-attestation", "verification-receipts"]) {
    if (existsSync(join(dirname(outside), ".persona", "evidence", authorityDirectory))) {
      throw new Error(`${label} created authority evidence while blocked`)
    }
  }
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

function assertCooperativeFinishWorks(fixtureRoot, phPath, label, commands) {
  createCooperativeGradleFixture(fixtureRoot)
  requireSuccess(
    `${label} bootstrap checkpoint`,
    runNode(fixtureRoot, [phPath, "bootstrap", "backend", "--strict", "--no-developer-mcp"]),
  )
  commitBootstrapCheckpoint(fixtureRoot, label)
  const consumerRoot = `${fixtureRoot}-consumer`
  requireSuccess(`${label} clean consumer worktree`, runCommand(fixtureRoot, "git", ["worktree", "add", "--detach", consumerRoot, "HEAD"]))

  try {
    runCooperativeLifecycle(consumerRoot, phPath, label, commands)
  } finally {
    if (existsSync(consumerRoot)) {
      requireSuccess(`${label} clean consumer removal`, runCommand(fixtureRoot, "git", ["worktree", "remove", "--force", consumerRoot]))
    }
  }
}

function runCooperativeLifecycle(fixtureRoot, phPath, label, commands) {
  for (const command of commands) {
    const step = BETA6_COOPERATIVE_COMMANDS.get(command)
    if (step === undefined) {
      throw new Error(`${label} beta.6 acceptance command is unsupported`)
    }
    requireSuccess(
      `${label} lifecycle ${command}`,
      runNode(fixtureRoot, [phPath, ...step.args], {}, step.stdin),
    )
  }
  assertCooperativeLifecycleState(fixtureRoot, label)

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
    if (existsSync(join(fixtureRoot, ".persona", "evidence", directory))) {
      throw new Error(`${label} cooperative Finish wrote forgeable authority directory ${directory}`)
    }
  }
}

function createCooperativeGradleFixture(projectDir) {
  mkdirSync(join(projectDir, "src", "main", "java", "example", "cooperative"), { recursive: true })
  mkdirSync(join(projectDir, "src", "test", "java", "example", "cooperative"), { recursive: true })
  writeFileSync(join(projectDir, "README.md"), "# Installed cooperative Gradle fixture\n")
  writeFileSync(join(projectDir, ".gitignore"), ".gradle/\nbuild/\n")
  writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'installed-cooperative-gradle'\n")
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
  requireSuccess(
    "installed fixture Gradle wrapper",
    runCommand(projectDir, "gradle", ["wrapper", "--gradle-version", "9.4.0", "--distribution-type", "bin"]),
  )
  rmSync(join(projectDir, ".gradle"), { force: true, recursive: true })
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
  requireSuccess("installed fixture Git init", runCommand(projectDir, "git", ["init", "-q"]))
  requireSuccess("installed fixture Git config email", runCommand(projectDir, "git", ["config", "user.email", "ph@example.invalid"]))
  requireSuccess("installed fixture Git config name", runCommand(projectDir, "git", ["config", "user.name", "PH Test"]))
  requireSuccess("installed fixture Git config autocrlf", runCommand(projectDir, "git", ["config", "core.autocrlf", "false"]))
  requireSuccess("installed fixture Git add", runCommand(projectDir, "git", ["add", "."]))
  requireSuccess("installed fixture Git commit", runCommand(projectDir, "git", ["commit", "-qm", "installed fixture"]))
}

function commitBootstrapCheckpoint(projectDir, label) {
  requireSuccess(`${label} checkpoint add`, runCommand(projectDir, "git", ["add", "--all"]))
  requireSuccess(`${label} checkpoint reset dynamic records`, runCommand(projectDir, "git", ["reset", "--", ".persona/evidence", ".persona/workflow"]))
  const staticPersonaPaths = [
    ".persona/.ph-init-manifest.json",
    ".persona/conventions",
    ".persona/harness.jsonc",
    ".persona/policies",
    ".persona/project-profile.jsonc",
    ".persona/rules",
  ].filter((relativePath) => existsSync(join(projectDir, relativePath)))
  if (staticPersonaPaths.length > 0) {
    requireSuccess(`${label} checkpoint add static Persona records`, runCommand(projectDir, "git", ["add", "-f", "--", ...staticPersonaPaths]))
  }
  requireSuccess(`${label} checkpoint commit`, runCommand(projectDir, "git", ["commit", "-qm", "public bootstrap checkpoint"]))
}

function assertCooperativeLifecycleState(projectDir, label) {
  for (const relativePath of [
    ".persona/workflow/workflow-loop-state.json",
    ".persona/workflow/ralph-loop-state.json",
  ]) {
    if (!existsSync(join(projectDir, relativePath))) {
      throw new Error(`${label} lifecycle bootstrap did not create canonical loop state`)
    }
  }
}

function readBeta6CooperativeCommands(packageRoot) {
  const manifestPath = join(packageRoot, BETA6_ACCEPTANCE_PATH)
  let value
  try {
    value = JSON.parse(readFileSync(manifestPath, "utf8"))
  } catch {
    throw new Error("beta.6 acceptance manifest is unavailable")
  }
  const commands = value?.cooperative?.commands
  const packageVersion = value?.package?.version
  const expectedCommands = [...BETA6_COOPERATIVE_COMMANDS.keys()]
  if (
    packageVersion !== readPackageVersion(packageRoot)
    || !Array.isArray(commands)
    || commands.length !== expectedCommands.length
    || commands.some((command, index) => command !== expectedCommands[index])
  ) {
    throw new Error("beta.6 acceptance manifest is invalid")
  }
  return commands
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

function runNode(cwd, args, environment = {}, input) {
  const result = spawnSync(process.execPath, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...environment },
    input,
    maxBuffer: 4 * 1024 * 1024,
  })
  if (result.error) {
    throw new Error("node process could not start")
  }
  return {
    status: result.status,
    stderr: result.stderr ?? "",
    stdout: result.stdout ?? "",
  }
}

function requireSuccess(label, result) {
  if (result.status !== 0) {
    throw new Error(`${label} failed`)
  }
}

function resolvePackResult(output, packDirectory) {
  const parsed = JSON.parse(output)
  if (!Array.isArray(parsed) || parsed.length !== 1 || !isRecord(parsed[0]) || typeof parsed[0].filename !== "string") {
    throw new TypeError("npm pack did not return exactly one tarball")
  }

  const record = parsed[0]
  const filename = record.filename
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
  if (!Array.isArray(record.files)) {
    throw new TypeError("npm pack omitted the package path set")
  }
  const paths = record.files.map((file) => {
    if (!isRecord(file) || typeof file.path !== "string" || file.path.length === 0) {
      throw new TypeError("npm pack returned an invalid package path")
    }
    return file.path
  }).sort()
  const bytes = readFileSync(candidate)
  return {
    facts: {
      filename: basename(candidate),
      fileCount: paths.length,
      integrity: typeof record.integrity === "string" ? record.integrity : "unavailable",
      packagePathSetSha256: sha256(Buffer.from(`${paths.join("\n")}\n`, "utf8")),
      shasum: typeof record.shasum === "string" ? record.shasum : "unavailable",
      size: bytes.byteLength,
      tarballSha256: sha256(bytes),
      version: readPackageVersion(repositoryRoot),
    },
    tarballPath: candidate,
  }
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex")
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function sourceCliArgument(args) {
  if (args.length === 0) return undefined
  if (args.length === 2 && args[0] === "--source-cli" && args[1].trim() !== "") return args[1]
  throw new TypeError("usage: node scripts/test-installed-package-contract.mjs [--source-cli dist/cli/index.js]")
}
