#!/usr/bin/env node
import { createHash } from "node:crypto"
import {
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
  assertRuntimeIdentity(input)
  const candidateTarballSha256 = input.surface === "installed"
    ? await verifyInstalledSurface(input)
    : await verifySourceSurface(input)

  console.log(JSON.stringify({
    candidateTarballSha256,
    nodeMajor: input.nodeMajor,
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
      (flag !== "--surface" && flag !== "--expected-platform" && flag !== "--expected-node-major")
      || value === undefined
      || values.has(flag)
    ) {
      throw new SupportSurfaceError("Invalid support surface arguments")
    }
    values.set(flag, value)
  }
  const surface = values.get("--surface")
  const platform = values.get("--expected-platform")
  const nodeMajor = Number(values.get("--expected-node-major"))
  if (
    (surface !== "source" && surface !== "installed")
    || (platform !== "linux" && platform !== "macos")
    || !Number.isSafeInteger(nodeMajor)
    || ![20, 22, 24].includes(nodeMajor)
    || (platform === "macos" && nodeMajor !== 22)
  ) {
    throw new SupportSurfaceError("Invalid support surface arguments")
  }
  return { nodeMajor, platform, surface }
}

function assertRuntimeIdentity(input) {
  const platform = process.platform === "darwin" ? "macos" : process.platform
  const nodeMajor = Number(process.versions.node.split(".", 1)[0])
  if (platform !== input.platform || nodeMajor !== input.nodeMajor) {
    throw new SupportSurfaceError("Support surface runtime identity does not match the matrix entry")
  }
}

async function verifySourceSurface(input) {
  const cliPath = join(repositoryRoot, "dist", "cli", "index.js")
  if (!existsSync(cliPath)) {
    throw new SupportSurfaceError("Source-built CLI is unavailable")
  }
  assertPackageTest(repositoryRoot, "source-built package")
  await assertCliSurface(
    (cwd, args) => runCommand(process.execPath, [cliPath, ...args], cwd),
    input.surface,
  )
  return null
}

async function verifyInstalledSurface(input) {
  const tarballPath = packLocalTarball()
  const installed = installLocalTarball(tarballPath)
  assertPackageTest(installed.packageRoot, "installed package")
  await assertCliSurface(
    (cwd, args) => runCommand(installed.binPath, args, cwd),
    input.surface,
  )
  return sha256File(tarballPath)
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
    throw new SupportSurfaceError(`${label} npm test did not reach package help`)
  }
}

async function assertCliSurface(runCli, surface) {
  requireSuccess(runCli(repositoryRoot, ["--help"]), `${surface} ph --help`)
  requireSuccess(runCli(repositoryRoot, ["version"]), `${surface} ph version`)
  requireSuccess(runCli(repositoryRoot, ["workflow", "--help"]), `${surface} ph workflow --help`)

  const fixtureRoot = join(temporaryRoot, `${surface}-authority-negative`)
  if (!await writeAuthorityNegativeFixture(fixtureRoot)) {
    throw new SupportSurfaceError(`${surface} authority-negative fixture setup failed`)
  }
  const finish = runCli(fixtureRoot, ["workflow", "finish", "implement"])
  const output = `${finish.stdout}\n${finish.stderr}`
  if (finish.status === 0 || !output.includes("trusted-authority-required") || output.includes("Finish status: PASS")) {
    throw new SupportSurfaceError(`${surface} authority-negative finish boundary failed`)
  }
}

async function writeAuthorityNegativeFixture(projectRoot) {
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
  return writeCurrentLifecycleStates(projectRoot)
}

async function writeCurrentLifecycleStates(projectRoot) {
  try {
    const [workflowLoopState, ralphLoopState, ruleDelivery] = await Promise.all([
      import(pathToFileURL(join(repositoryRoot, "dist", "cli", "workflow-loop-state.js")).href),
      import(pathToFileURL(join(repositoryRoot, "dist", "runtime", "ralph-loop-state.js")).href),
      import(pathToFileURL(join(repositoryRoot, "dist", "rules", "rule-delivery.js")).href),
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

function runCommand(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: process.env,
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
