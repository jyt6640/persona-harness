import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs"
import { join } from "node:path"
import process from "node:process"

import {
  WORKFLOW_LOOP_STATE_SCHEMA_VERSION,
  writeWorkflowLoopState,
} from "./workflow-loop-state.js"
import {
  isRegularBoundedFile,
  parseJsonRecord,
  type CommandResult,
  type CommandRunner,
  type TarballFacts,
} from "./staged-package-verification-runtime.js"
import type { JsonRecord } from "./staged-package-verification-types.js"
import { emptyRalphLoopState, writeRalphLoopState } from "../runtime/ralph-loop-state.js"
import { rulePackContentHash } from "../rules/rule-delivery.js"

const MAX_FACT_BYTES = 64 * 1024
const MAX_TARBALL_BYTES = 64 * 1024 * 1024
const FIXTURE_LIFECYCLE_STARTED_AT = "2026-07-01T00:00:00.000Z"

type InstalledLauncher = {
  readonly argsPrefix: readonly string[]
  readonly command: string
}

export type InstalledConsumer = {
  readonly cliPath: string
  readonly consumerDir: string
  readonly consumerRoot: string
  readonly launcher: InstalledLauncher
  readonly packageName: unknown
  readonly packageRoot: string
  readonly version: unknown
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function installedLauncher(consumerDir: string, cliPath: string): InstalledLauncher | undefined {
  if (process.platform === "win32") {
    return { argsPrefix: [cliPath], command: process.execPath }
  }

  const phPath = join(consumerDir, "node_modules", ".bin", "ph")
  try {
    return realpathSync(phPath) === cliPath
      ? { argsPrefix: [], command: phPath }
      : undefined
  } catch {
    return undefined
  }
}

export function createInstalledConsumer(
  tempRoot: string,
  tarballPath: string,
  commandRunner: CommandRunner,
): InstalledConsumer | undefined {
  const npmCacheDir = join(tempRoot, "npm-cache")
  const consumerDir = join(tempRoot, "consumer")
  mkdirSync(consumerDir, { recursive: true })
  writeFileSync(join(consumerDir, "package.json"), `${JSON.stringify({ private: true, type: "module" })}\n`)
  const install = commandRunner(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--no-save",
      "--package-lock=false",
      "--cache",
      npmCacheDir,
      tarballPath,
    ],
    consumerDir,
  )
  if (install.status !== 0) return undefined

  const packageRoot = join(consumerDir, "node_modules", "persona-harness")
  const packageJsonPath = join(packageRoot, "package.json")
  const cliPath = join(packageRoot, "dist", "cli", "index.js")
  if (!isRegularBoundedFile(packageJsonPath, MAX_FACT_BYTES) || !isRegularBoundedFile(cliPath, MAX_TARBALL_BYTES)) {
    return undefined
  }
  try {
    const packageJson = parseJsonRecord(readFileSync(packageJsonPath, "utf8"))
    const canonicalCliPath = realpathSync(cliPath)
    const launcher = installedLauncher(consumerDir, canonicalCliPath)
    if (packageJson === undefined || launcher === undefined) return undefined
    return {
      cliPath: canonicalCliPath,
      consumerDir,
      consumerRoot: realpathSync(consumerDir),
      launcher,
      packageName: packageJson["name"],
      packageRoot,
      version: packageJson["version"],
    }
  } catch {
    return undefined
  }
}

function runInstalledCli(
  consumer: InstalledConsumer,
  args: readonly string[],
  cwd: string,
  commandRunner: CommandRunner,
): CommandResult {
  return commandRunner(consumer.launcher.command, [...consumer.launcher.argsPrefix, ...args], cwd)
}

function writeCurrentLifecycleStates(projectDir: string): boolean {
  try {
    writeWorkflowLoopState(projectDir, {
      finalDecision: "not-run",
      iterations: [],
      rulePackHash: rulePackContentHash(projectDir),
      schemaVersion: WORKFLOW_LOOP_STATE_SCHEMA_VERSION,
      startedAt: FIXTURE_LIFECYCLE_STARTED_AT,
    })
    return writeRalphLoopState(projectDir, emptyRalphLoopState(FIXTURE_LIFECYCLE_STARTED_AT))
  } catch {
    return false
  }
}

function writeAuthorityNegativeFixture(
  projectDir: string,
  consumer: InstalledConsumer,
  commandRunner: CommandRunner,
): boolean {
  writeFileSync(join(projectDir, "README.md"), "# Staged Package Verification Fixture\n")
  const intake = runInstalledCli(consumer, ["intake", "--default", "backend"], projectDir, commandRunner)
  const plan = runInstalledCli(consumer, ["plan"], projectDir, commandRunner)
  const accept = runInstalledCli(consumer, ["plan", "--accept"], projectDir, commandRunner)
  if (intake.status !== 0 || plan.status !== 0 || accept.status !== 0) return false

  mkdirSync(join(projectDir, ".persona", "workflow"), { recursive: true })
  mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
  writeFileSync(
    join(projectDir, ".persona", "workflow", "implementation-report.md"),
    [
      "Status: filled",
      "- README ranges read: all",
      "- Project profile ranges read: all",
      "- `npx ph bearshell --shell './gradlew test'`",
    ].join("\n"),
  )
  if (!writeCurrentLifecycleStates(projectDir)) return false
  writeFileSync(
    join(projectDir, ".persona", "workflow", "review-report.md"),
    [
      "Status: filled",
      "- Requirements reviewed against the accepted plan.",
      "- Manual QA completed.",
    ].join("\n"),
  )
  writeFileSync(
    join(projectDir, ".persona", "evidence", "phase0", "verification.json"),
    `${JSON.stringify({
      command: "npx ph bearshell --shell './gradlew test'",
      status: 0,
      tool: "bearshell",
      toolOutput: "BUILD SUCCESSFUL",
    })}\n`,
  )
  return true
}

function hasNoFinishPass(output: string): boolean {
  return !output.includes("Finish status: PASS") && !output.includes("\"finish\":\"pass\"")
}

function closureBlocksAuthority(result: CommandResult): boolean {
  if (result.status !== 0 || !hasNoFinishPass(result.output)) return false
  const closure = parseJsonRecord(result.output)
  const state = closure?.["state"]
  if (!isRecord(state)) return false
  const blockers = state["blockers"]
  return state["finish"] === "blocked"
    && Array.isArray(blockers)
    && blockers.some((blocker) => isRecord(blocker) && blocker["id"] === "trusted-authority-required")
}

export function runInstalledStagedPackageMatrix(
  consumer: InstalledConsumer,
  tempRoot: string,
  commandRunner: CommandRunner,
): Readonly<Record<string, boolean>> {
  const fixtureDir = join(tempRoot, "authority-fixture")
  mkdirSync(fixtureDir, { recursive: true })
  const fixtureReady = writeAuthorityNegativeFixture(fixtureDir, consumer, commandRunner)
  const npmTest = commandRunner("npm", ["test"], consumer.packageRoot)
  const help = runInstalledCli(consumer, ["--help"], consumer.consumerDir, commandRunner)
  const version = runInstalledCli(consumer, ["version"], consumer.consumerDir, commandRunner)
  const workflowHelp = runInstalledCli(consumer, ["workflow", "--help"], consumer.consumerDir, commandRunner)
  const finish = fixtureReady
    ? runInstalledCli(consumer, ["workflow", "finish", "implement"], fixtureDir, commandRunner)
    : { output: "", status: 1 }
  const closure = fixtureReady
    ? runInstalledCli(consumer, ["workflow", "closure", "next", "--json"], fixtureDir, commandRunner)
    : { output: "", status: 1 }

  return {
    authorityBlocked:
      finish.status !== 0
      && finish.output.includes("trusted-authority-required")
      && hasNoFinishPass(finish.output),
    cliHelp: help.status === 0 && help.output.includes("Usage: ph"),
    closureAuthorityParity: closureBlocksAuthority(closure),
    npmTest: npmTest.status === 0 && npmTest.output.includes("Persona Harness"),
    sourceCheckoutIndependent:
      !existsSync(join(consumer.packageRoot, "tests"))
      && !existsSync(join(consumer.packageRoot, "scripts", "staged-package-verification.mjs"))
      && consumer.cliPath.startsWith(consumer.consumerRoot),
    version: version.status === 0 && version.output.trim() === consumer.version,
    workflowHelp: workflowHelp.status === 0 && workflowHelp.output.includes("Usage: ph workflow"),
  }
}

export function installedTarballFacts(consumer: InstalledConsumer, facts: TarballFacts): Record<string, unknown> {
  return {
    ...facts,
    packageName: consumer.packageName,
    version: consumer.version,
  }
}
