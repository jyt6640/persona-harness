import { spawnSync } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { join } from "node:path"
import process from "node:process"

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 128 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  })
  return {
    output: `${result.stdout ?? ""}\n${result.stderr ?? ""}`,
    status: typeof result.status === "number" ? result.status : 1,
  }
}

export function createStablePromotionConsumer(tempRoot, tarballPath) {
  const consumerDir = join(tempRoot, "consumer")
  mkdirSync(consumerDir, { recursive: true })
  writeFileSync(join(consumerDir, "package.json"), `${JSON.stringify({ private: true, type: "module" })}\n`)
  const install = run(
    "npm",
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarballPath],
    consumerDir,
  )
  if (install.status !== 0) {
    return undefined
  }
  const packageRoot = join(consumerDir, "node_modules", "persona-harness")
  const packageJson = join(packageRoot, "package.json")
  const cliPath = join(packageRoot, "dist", "cli", "index.js")
  if (!existsSync(packageJson) || !existsSync(cliPath)) {
    return undefined
  }
  try {
    const parsed = JSON.parse(readFileSync(packageJson, "utf8"))
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return undefined
    }
    return {
      cliPath: realpathSync(cliPath),
      consumerDir,
      consumerRoot: realpathSync(consumerDir),
      packageName: parsed.name,
      packageRoot,
      version: parsed.version,
    }
  } catch {
    return undefined
  }
}

export function writeStablePromotionWorkflowFixture(projectDir, cliPath, commandRunner = run) {
  writeFileSync(join(projectDir, "README.md"), "# Promotion Gate Fixture\n")
  const intake = commandRunner(process.execPath, [cliPath, "intake", "--default", "backend"], projectDir)
  const plan = commandRunner(process.execPath, [cliPath, "plan"], projectDir)
  const accept = commandRunner(process.execPath, [cliPath, "plan", "--accept"], projectDir)
  if (intake.status !== 0 || plan.status !== 0 || accept.status !== 0) {
    return false
  }
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

function hasNoFinishPass(output) {
  return !output.includes("Finish status: PASS") && !output.includes('"finish":"pass"')
}

function closureIsBlocked(result) {
  if (result.status !== 0 || !hasNoFinishPass(result.output)) {
    return false
  }
  try {
    const parsed = JSON.parse(result.output)
    return parsed?.state?.finish === "blocked"
  } catch {
    return false
  }
}

function closureBlocksAuthority(result) {
  if (!closureIsBlocked(result)) {
    return false
  }
  try {
    const parsed = JSON.parse(result.output)
    return Array.isArray(parsed?.state?.blockers)
      && parsed.state.blockers.some((blocker) => blocker?.id === "trusted-authority-required")
  } catch {
    return false
  }
}

export function runInstalledCompletionIntegrityMatrix(consumer, tempRoot) {
  const output = []
  const invoke = (cwd, args) => {
    const result = run(process.execPath, [consumer.cliPath, ...args], cwd)
    output.push(result.output)
    return result
  }
  const fixtureDir = join(consumer.consumerDir, "completion-fixture")
  mkdirSync(fixtureDir, { recursive: true })
  const fixtureReady = writeStablePromotionWorkflowFixture(fixtureDir, consumer.cliPath)

  const help = invoke(consumer.consumerDir, ["--help"])
  const version = invoke(consumer.consumerDir, ["version"])
  const workflowHelp = invoke(consumer.consumerDir, ["workflow", "--help"])
  const check = fixtureReady ? invoke(fixtureDir, ["workflow", "check"]) : { output: "", status: 1 }
  const finish = fixtureReady ? invoke(fixtureDir, ["workflow", "finish", "implement"]) : { output: "", status: 1 }
  const closure = fixtureReady ? invoke(fixtureDir, ["workflow", "closure", "next", "--json"]) : { output: "", status: 1 }

  mkdirSync(join(fixtureDir, ".persona", "evidence", "verification-receipts"), { recursive: true })
  const marker = "stable-promotion-secret-marker"
  writeFileSync(
    join(fixtureDir, ".persona", "evidence", "verification-receipts", "forged.json"),
    JSON.stringify({
      authorityEligible: true,
      generatedBy: `local-${marker}`,
      status: "trusted",
    }),
  )
  const forgedFinish = fixtureReady ? invoke(fixtureDir, ["workflow", "finish", "implement"]) : { output: "", status: 1 }

  writeFileSync(join(fixtureDir, ".persona", "harness.jsonc"), `{"evidenceDir":"../${marker}"}`)
  const malformedClosure = invoke(fixtureDir, ["workflow", "closure", "next", "--json"])

  const symlinkFixture = join(consumer.consumerDir, "symlink-fixture")
  mkdirSync(symlinkFixture, { recursive: true })
  const symlinkOutside = join(tempRoot, "outside")
  mkdirSync(symlinkOutside, { recursive: true })
  let symlinkBlocked = false
  try {
    writeFileSync(join(symlinkFixture, "README.md"), "# Symlink fixture\n")
    mkdirSync(join(symlinkFixture, ".persona"), { recursive: true })
    symlinkSync(symlinkOutside, join(symlinkFixture, ".persona", "evidence"))
    const symlinkFinish = invoke(symlinkFixture, ["workflow", "finish", "implement"])
    symlinkBlocked = symlinkFinish.status !== 0 && hasNoFinishPass(symlinkFinish.output)
  } catch {
    symlinkBlocked = false
  }

  const allOutput = output.join("\n")
  return {
    closureBlocked: closureBlocksAuthority(closure),
    forgedEvidenceBlocked:
      forgedFinish.status === 1
      && forgedFinish.output.includes("trusted-authority-required")
      && hasNoFinishPass(forgedFinish.output),
    malformedConfigBlocked: closureIsBlocked(malformedClosure),
    noSensitiveOutput: !allOutput.includes(marker) && !allOutput.includes(fixtureDir) && !allOutput.includes(tempRoot),
    sourceCheckoutIndependent:
      !existsSync(join(consumer.packageRoot, "tests"))
      && !existsSync(join(consumer.packageRoot, "scripts", "smoke-product-mvp.mjs"))
      && !existsSync(join(consumer.packageRoot, "scripts", "stable-promotion-completion-integrity.mjs"))
      && consumer.cliPath.startsWith(consumer.consumerRoot),
    symlinkEvidenceBlocked: symlinkBlocked,
    workflowFinishBlocked:
      help.status === 0
      && workflowHelp.status === 0
      && version.status === 0
      && version.output.trim() === consumer.version
      && check.status === 0
      && finish.status === 1
      && finish.output.includes("trusted-authority-required")
      && hasNoFinishPass(finish.output),
  }
}
