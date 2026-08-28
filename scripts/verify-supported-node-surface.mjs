#!/usr/bin/env node
import { createHash } from "node:crypto"
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { spawnSync } from "node:child_process"
import { tmpdir } from "node:os"
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path"
import process from "node:process"
import { fileURLToPath, pathToFileURL } from "node:url"

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const temporaryRoot = mkdtempSync(join(tmpdir(), "persona-supported-node-surface-"))
const FIXTURE_LIFECYCLE_STARTED_AT = "2026-07-01T00:00:00.000Z"

class SupportSurfaceError extends Error {}

try {
  const input = parseInput(process.argv.slice(2))
  const runtime = assertRuntimeIdentity(input)
  const verification = input.surface === "installed"
    ? await verifyInstalledSurface(input)
    : await verifySourceSurface(input)

  console.log(JSON.stringify({
    ...verification,
    nodeVersion: runtime.nodeVersion,
    platform: input.platform,
    surface: input.surface,
  }))
} catch (error) {
  console.error(error instanceof SupportSurfaceError ? error.message : "Support surface verification failed")
  process.exitCode = 1
} finally {
  rmSync(temporaryRoot, { force: true, recursive: true })
}

function parseInput(args) {
  const values = new Map()
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index]
    const value = args[index + 1]
    if (
      (flag !== "--surface" && flag !== "--expected-platform" && flag !== "--expected-node" && flag !== "--expected-node-mode")
      || value === undefined
      || values.has(flag)
    ) {
      throw new SupportSurfaceError("Invalid support surface arguments")
    }
    values.set(flag, value)
  }
  const surface = values.get("--surface")
  const platform = values.get("--expected-platform")
  const expectedNode = values.get("--expected-node")
  const nodeMode = values.get("--expected-node-mode")
  if (
    (surface !== "source" && surface !== "installed")
    || (platform !== "linux" && platform !== "macos")
    || typeof expectedNode !== "string"
    || (nodeMode !== "exact" && nodeMode !== "major")
    || !isSupportedRuntimeExpectation(expectedNode, nodeMode)
    || (platform === "macos" && (expectedNode !== "22" || nodeMode !== "major"))
  ) {
    throw new SupportSurfaceError("Invalid support surface arguments")
  }
  return { expectedNode, nodeMode, platform, surface }
}

function assertRuntimeIdentity(input) {
  const platform = process.platform === "darwin" ? "macos" : process.platform
  const nodeVersion = process.versions.node
  const nodeMajor = nodeVersion.split(".", 1)[0]
  const matchesNode = input.nodeMode === "exact"
    ? nodeVersion === input.expectedNode
    : nodeMajor === input.expectedNode
  if (platform !== input.platform || !matchesNode) {
    throw new SupportSurfaceError("Support surface runtime identity does not match the matrix entry")
  }
  return { nodeVersion }
}

function isSupportedRuntimeExpectation(expectedNode, nodeMode) {
  if (nodeMode === "major") return expectedNode === "20" || expectedNode === "22" || expectedNode === "24"
  return expectedNode === "20.17.0" || expectedNode === "20.19.0" || expectedNode === "22.9.0"
}

async function verifySourceSurface(input) {
  const cliPath = join(repositoryRoot, "dist", "cli", "index.js")
  if (!existsSync(cliPath)) {
    throw new SupportSurfaceError("Source-built CLI is unavailable")
  }
  assertPackageTest(repositoryRoot, "source-built package")
  await assertVerifierImports(repositoryRoot, "source-built")
  assertNativeProjectReadInputs(repositoryRoot, "source-built")
  await assertCliSurface(
    (cwd, args) => runCommand(process.execPath, [cliPath, ...args], cwd),
    input.surface,
    repositoryRoot,
  )
  return {
    candidateTarballSha256: null,
    nativeProjectRead: { source: "PASS" },
    verifierImports: { source: "PASS" },
  }
}

async function verifyInstalledSurface(input) {
  const tarballPath = packLocalTarball()
  await assertPackedVerifierImports(tarballPath)
  const installed = installLocalTarball(tarballPath)
  assertPackageTest(installed.packageRoot, "installed package")
  await assertVerifierImports(installed.packageRoot, "installed")
  assertNativeProjectReadInputs(installed.packageRoot, "installed")
  await assertCliSurface(
    (cwd, args) => runCommand(installed.binPath, args, cwd),
    input.surface,
    installed.packageRoot,
  )
  return {
    candidateTarballSha256: sha256File(tarballPath),
    nativeProjectRead: { installed: "PASS", packed: "PASS" },
    verifierImports: { installed: "PASS", packed: "PASS" },
  }
}

function assertNativeProjectReadInputs(packageRoot, label) {
  const result = runCommand(
    process.execPath,
    [join(repositoryRoot, "scripts", "verify-supported-node-native-inputs.mjs")],
    repositoryRoot,
    { ...process.env, PH_SUPPORT_PACKAGE_ROOT: packageRoot },
  )
  requireSuccess(result, `${label} native project read producer inputs`)
}

async function assertPackedVerifierImports(tarballPath) {
  const extractionRoot = join(temporaryRoot, "packed-import")
  mkdirSync(extractionRoot)
  const extraction = runCommand("tar", ["-xzf", tarballPath, "-C", extractionRoot], repositoryRoot)
  requireSuccess(extraction, "Packed verifier extraction")
  const packageRoot = join(extractionRoot, "package")
  if (!existsSync(packageRoot)) throw new SupportSurfaceError("Packed verifier package root is unavailable")
  await assertVerifierImports(packageRoot, "packed")
}

async function assertVerifierImports(packageRoot, label) {
  const finishVerifierPath = join(packageRoot, "dist", "cli", "workflow-finish-attestation.js")
  const projectVerifierPath = join(packageRoot, "dist", "cli", "project-finish-attestation-verifier.js")
  if (!existsSync(finishVerifierPath) || !existsSync(projectVerifierPath)) {
    throw new SupportSurfaceError(`${label} verifier import surface is unavailable`)
  }
  try {
    const [finishVerifier, projectVerifier] = await Promise.all([
      import(pathToFileURL(finishVerifierPath).href),
      import(pathToFileURL(projectVerifierPath).href),
    ])
    if (
      typeof finishVerifier.verifyExternalFinishAttestation !== "function"
      || typeof projectVerifier.inspectProjectFinishAttestation !== "function"
    ) {
      throw new SupportSurfaceError(`${label} verifier import surface is invalid`)
    }
  } catch (error) {
    if (error instanceof SupportSurfaceError) throw error
    throw new SupportSurfaceError(`${label} verifier import surface failed`)
  }
}

function packLocalTarball() {
  const packDirectory = join(temporaryRoot, "pack")
  mkdirSync(packDirectory)
  const result = runCommand("npm", ["pack", "--json", "--pack-destination", packDirectory], repositoryRoot)
  requireSuccess(result, "Local tarball pack")

  let parsed
  try {
    parsed = JSON.parse(result.stdout)
  } catch {
    throw new SupportSurfaceError("Local tarball pack did not return JSON")
  }
  if (!Array.isArray(parsed) || parsed.length !== 1 || !isRecord(parsed[0]) || typeof parsed[0].filename !== "string") {
    throw new SupportSurfaceError("Local tarball pack did not return one candidate")
  }
  const candidate = isAbsolute(parsed[0].filename)
    ? parsed[0].filename
    : join(packDirectory, basename(parsed[0].filename))
  if (!existsSync(candidate) || !isContained(packDirectory, realpathSync(candidate))) {
    throw new SupportSurfaceError("Local tarball candidate is unavailable")
  }
  return candidate
}

function installLocalTarball(tarballPath) {
  const consumerRoot = join(temporaryRoot, "consumer")
  const cacheRoot = join(temporaryRoot, "npm-cache")
  mkdirSync(consumerRoot)
  mkdirSync(cacheRoot)
  writeFileSync(join(consumerRoot, "package.json"), `${JSON.stringify({ private: true })}\n`)

  const install = runCommand(
    "npm",
    ["install", "--cache", cacheRoot, "--ignore-scripts", "--no-audit", "--no-fund", tarballPath],
    consumerRoot,
  )
  requireSuccess(install, "Local tarball installation")

  const packageRoot = join(consumerRoot, "node_modules", "persona-harness")
  const binPath = join(consumerRoot, "node_modules", ".bin", "ph")
  if (!existsSync(packageRoot) || !existsSync(binPath)) {
    throw new SupportSurfaceError("Installed local tarball CLI is unavailable")
  }
  return { binPath, packageRoot }
}

function assertPackageTest(packageRoot, label) {
  const result = runCommand("npm", ["test"], packageRoot)
  requireSuccess(result, `${label} npm test`)
  if (!result.stdout.includes("Persona Harness")) {
    throw new SupportSurfaceError(`${label} npm test did not reach package test contract`)
  }
}

async function assertCliSurface(runCli, surface, packageRoot) {
  requireSuccess(runCli(repositoryRoot, ["--help"]), `${surface} ph --help`)
  requireSuccess(runCli(repositoryRoot, ["version"]), `${surface} ph version`)
  requireSuccess(runCli(repositoryRoot, ["workflow", "--help"]), `${surface} ph workflow --help`)

  const fixtureRoot = join(temporaryRoot, `${surface}-authority-negative`)
  if (!await writeAuthorityNegativeFixture(fixtureRoot, packageRoot)) {
    throw new SupportSurfaceError(`${surface} authority-negative fixture setup failed`)
  }
  const finish = runCli(fixtureRoot, ["workflow", "finish", "implement"])
  const output = `${finish.stdout}\n${finish.stderr}`
  if (finish.status === 0 || !output.includes("trusted-authority-required") || output.includes("Finish status: PASS")) {
    throw new SupportSurfaceError(`${surface} authority-negative finish boundary failed`)
  }

  const reverifyRoot = join(temporaryRoot, `${surface}-reverify-authority-negative`)
  if (!await writeReverificationAuthorityNegativeFixture(reverifyRoot, packageRoot)) {
    throw new SupportSurfaceError(`${surface} reverification authority-negative fixture setup failed`)
  }
  const reverified = runCli(reverifyRoot, ["workflow", "finish", "implement", "--reverify", "--ci"])
  const reverifiedFailure = classifyReverificationAuthorityNegativeResult(reverified)
  if (reverifiedFailure !== undefined) {
    throw new SupportSurfaceError(`${surface} reverification authority-negative finish boundary failed: ${reverifiedFailure}`)
  }
}

function classifyReverificationAuthorityNegativeResult(result) {
  const output = `${result.stdout}\n${result.stderr}`
  if (result.status === 0) return "unexpected-success"
  if (output.includes("Finish status: PASS")) return "unexpected-finish-pass"
  if (output.includes("artifact-unavailable")) return "artifact-unavailable"
  if (output.includes("fresh-receipt-unavailable")) return "fresh-receipt-unavailable"
  if (output.includes("source-identity-symlink")) return "source-identity-symlink"
  if (output.includes("source-read-runtime-unavailable")) return "source-read-runtime-unavailable"
  if (!output.includes("trusted-authority-required")) return "trusted-authority-required-missing"
  return undefined
}

async function writeAuthorityNegativeFixture(projectRoot, packageRoot) {
  mkdirSync(join(projectRoot, ".persona", "evidence", "phase0"), { recursive: true })
  mkdirSync(join(projectRoot, ".persona", "workflow"), { recursive: true })
  writeFileSync(join(projectRoot, ".persona", "workflow", "plan.md"), "Status: accepted\n")
  writeFileSync(
    join(projectRoot, ".persona", "workflow", "implementation-report.md"),
    "Status: filled\n- README ranges read: all\n- Project profile ranges read: all\n- `npx ph bearshell ./gradlew test`\n",
  )
  writeFileSync(
    join(projectRoot, ".persona", "workflow", "review-report.md"),
    "Status: filled\n- `npx ph bearshell ./gradlew bootRun`\n",
  )
  writeFileSync(
    join(projectRoot, ".persona", "harness.jsonc"),
    `${JSON.stringify({ enforce: { executeVerification: false, tdd: false } })}\n`,
  )
  writeFileSync(
    join(projectRoot, ".persona", "evidence", "phase0", "local-verification.json"),
    `${JSON.stringify({
      command: "node -e BUILD SUCCESSFUL",
      generatedBy: "persona-harness",
      status: 0,
      tool: "bearshell",
      toolOutput: "BUILD SUCCESSFUL",
    })}\n`,
  )
  return writeCurrentLifecycleStates(projectRoot, packageRoot)
}

async function writeReverificationAuthorityNegativeFixture(projectRoot, packageRoot) {
  if (!await writeAuthorityNegativeFixture(projectRoot, packageRoot)) return false
  const roleFiles = [
    ["src/main/java/example/SupportSurfaceApplication.java", "package example;\nimport org.springframework.boot.autoconfigure.SpringBootApplication;\n@SpringBootApplication\nclass SupportSurfaceApplication {}\n"],
    ["src/main/java/example/presentation/SupportSurfaceController.java", "package example.presentation;\nimport org.springframework.web.bind.annotation.RestController;\n@RestController\nclass SupportSurfaceController {}\n"],
    ["src/main/java/example/application/SupportSurfaceService.java", "package example.application;\nclass SupportSurfaceService {}\n"],
    ["src/main/java/example/domain/SupportSurfaceRecord.java", "package example.domain;\nclass SupportSurfaceRecord {}\n"],
    ["src/main/java/example/domain/SupportSurfaceRepository.java", "package example.domain;\ninterface SupportSurfaceRepository {}\n"],
    ["src/main/java/example/infrastructure/JpaSupportSurfaceRepository.java", "package example.infrastructure;\nclass JpaSupportSurfaceRepository implements example.domain.SupportSurfaceRepository {}\n"],
    ["src/main/java/example/presentation/dto/request/CreateSupportSurfaceRequest.java", "package example.presentation.dto.request;\nrecord CreateSupportSurfaceRequest(String value) {}\n"],
    ["src/main/java/example/presentation/dto/response/SupportSurfaceResponse.java", "package example.presentation.dto.response;\nrecord SupportSurfaceResponse(String value) {}\n"],
  ]
  for (const [relativePath, source] of roleFiles) {
    mkdirSync(dirname(join(projectRoot, relativePath)), { recursive: true })
    writeFileSync(join(projectRoot, relativePath), source)
  }
  writeFileSync(join(projectRoot, "README.md"), "# Support surface fixture\n")
  writeFileSync(join(projectRoot, "settings.gradle"), "rootProject.name = 'support-surface'\n")
  writeFileSync(
    join(projectRoot, "build.gradle"),
    [
      "plugins { id 'org.springframework.boot' version '3.5.0' }",
      "dependencies {",
      "  implementation 'org.springframework.boot:spring-boot-starter-web'",
      "  implementation 'org.springframework.boot:spring-boot-starter-data-jpa'",
      "  runtimeOnly 'com.h2database:h2'",
      "}",
    ].join("\n") + "\n",
  )
  mkdirSync(join(projectRoot, "src", "main", "resources"), { recursive: true })
  writeFileSync(join(projectRoot, "src", "main", "resources", "schema.sql"), "create table support_surface(id bigint primary key);\n")
  const wrapper = join(projectRoot, "gradlew")
  writeFileSync(
    wrapper,
    [
      "#!/bin/sh",
      "mkdir -p build/test-results/test",
      "printf '%s\\n' '<testsuite tests=\"1\" failures=\"0\" errors=\"0\" skipped=\"0\"><testcase classname=\"SupportSurfaceTest\" name=\"works\"/></testsuite>' > build/test-results/test/TEST-support-surface.xml",
      "for argument in \"$@\"; do",
      "  if [ \"$argument\" = build ]; then printf '%s\\n' '> Task :build'; exit 0; fi",
      "done",
      "printf '%s\\n' '> Task :cleanTest' '> Task :test' 'BUILD SUCCESSFUL'",
    ].join("\n") + "\n",
  )
  chmodSync(wrapper, 0o755)
  writeFileSync(
    join(projectRoot, ".persona", "harness.jsonc"),
    `${JSON.stringify({ enforce: { executeVerification: true, tdd: false } })}\n`,
  )
  writeFileSync(
    join(projectRoot, ".persona", "project-profile.jsonc"),
    `${JSON.stringify({
      defaults: { buildTool: "gradle", framework: "spring", language: "java" },
      questions: [
        { answer: "ko", id: "user-language" },
        { answer: "team", id: "project-context" },
        { answer: "production-service", id: "project-goal" },
        { answer: "long-lived", id: "project-scale" },
        { answer: "rest-api", id: "application-type" },
        { answer: "clean-architecture-light", id: "architecture-style" },
        { answer: "database", id: "storage" },
        { answer: "jpa", id: "persistence-technology" },
        { answer: "schema.sql", id: "migration-style" },
        { answer: "domain-first", id: "package-style" },
        { answer: "strict", id: "boundary-strictness" },
      ],
      schema: "persona.project-profile.v1",
      scope: { mvp: "java-spring-clean-code", role: "backend" },
      status: "ready",
    })}\n`,
  )
  writeFileSync(
    join(projectRoot, ".persona", "workflow", "implementation-report.md"),
    [
      "Status: filled",
      "- README ranges read: all",
      "- Project profile ranges read: all",
      "- Java role discovery method: workflow evidence",
      "- Java role files read: controller, service, domain, repository, request DTO, response DTO",
      "- `npx ph bearshell --shell './gradlew test'`",
      "- Direct verification observed BUILD SUCCESSFUL.",
    ].join("\n") + "\n",
  )
  writeFileSync(
    join(projectRoot, ".persona", "workflow", "review-report.md"),
    [
      "Status: filled",
      "- [x] README/plan read method and ranges are recorded in the implementation report.",
      "- [x] Project profile read method and ranges are recorded in the implementation report.",
      "- [x] Generated Java role files have read evidence before finish.",
      "- `npx ph bearshell --shell './gradlew test'`",
    ].join("\n") + "\n",
  )
  writeFileSync(
    join(projectRoot, ".persona", "evidence", "phase0", "read-coverage.json"),
    `${JSON.stringify({
      injectedInto: "model-input",
      targetFile: ".persona/project-profile.jsonc",
      toolOutput: ["README.md", ".persona/project-profile.jsonc", ...roleFiles.map(([relativePath]) => relativePath), "BUILD SUCCESSFUL"].join("\n"),
    })}\n`,
  )
  writeFileSync(
    join(projectRoot, ".persona", "evidence", "phase0", "local-verification.json"),
    `${JSON.stringify({
      command: "npx ph bearshell --shell './gradlew test'",
      status: 0,
      tool: "bearshell",
      toolOutput: "BUILD SUCCESSFUL",
    })}\n`,
  )
  for (const args of [
    ["init", "-q"],
    ["config", "user.email", "ph@example.invalid"],
    ["config", "user.name", "PH Support Surface"],
    ["add", "."],
    ["commit", "-qm", "support surface fixture"],
  ]) {
    if (runCommand("git", args, projectRoot).status !== 0) return false
  }
  return writeCurrentLifecycleStates(projectRoot, packageRoot)
}

async function writeCurrentLifecycleStates(projectRoot, packageRoot) {
  try {
    const [workflowLoopState, ralphLoopState, ruleDelivery] = await Promise.all([
      import(pathToFileURL(join(packageRoot, "dist", "cli", "workflow-loop-state.js")).href),
      import(pathToFileURL(join(packageRoot, "dist", "runtime", "ralph-loop-state.js")).href),
      import(pathToFileURL(join(packageRoot, "dist", "rules", "rule-delivery.js")).href),
    ])
    workflowLoopState.writeWorkflowLoopState(projectRoot, {
      finalDecision: "not-run",
      iterations: [],
      rulePackHash: ruleDelivery.rulePackContentHash(projectRoot),
      schemaVersion: workflowLoopState.WORKFLOW_LOOP_STATE_SCHEMA_VERSION,
      startedAt: FIXTURE_LIFECYCLE_STARTED_AT,
    })
    return ralphLoopState.writeRalphLoopState(
      projectRoot,
      ralphLoopState.emptyRalphLoopState(FIXTURE_LIFECYCLE_STARTED_AT),
    )
  } catch {
    return false
  }
}

function runCommand(command, args, cwd, environment = process.env) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: environment,
    maxBuffer: 4 * 1024 * 1024,
  })
  return {
    status: result.status ?? 1,
    stderr: result.stderr ?? "",
    stdout: result.stdout ?? "",
  }
}

function requireSuccess(result, label) {
  if (result.status !== 0) {
    throw new SupportSurfaceError(`${label} failed`)
  }
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

function isContained(root, candidate) {
  const relativePath = relative(realpathSync(root), candidate)
  return relativePath !== "" && !relativePath.startsWith(`..${sep}`) && !isAbsolute(relativePath)
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
