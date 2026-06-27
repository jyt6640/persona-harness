import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { cp, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, dirname, join, resolve } from "node:path"
import { spawnSync } from "node:child_process"

export const FIXTURE_PATHS = {
  "backend-api-no-stack": "docs/current/evaluation-fixtures/backend-api-no-stack.md",
  "multi-step-backend": "docs/current/evaluation-fixtures/multi-step-backend.md",
  "ambiguous-idea-first": "docs/current/evaluation-fixtures/ambiguous-idea-first.md",
}

export const CONDITIONS = {
  plain: { id: "plain", label: "plain prompt", harnessState: "OFF" },
  claude: { id: "claude", label: "CLAUDE.md baseline", harnessState: "OFF" },
  agents: { id: "agents", label: "AGENTS.md baseline", harnessState: "OFF" },
  "ph-on": { id: "ph-on", label: "Persona Harness ON", harnessState: "ON" },
}

const PASS_TEXT = /\b(BUILD SUCCESSFUL|BUILD SUCCESS|SUCCESSFUL|Tests? passed|PASS)\b/i
const FAIL_TEXT = /\b(BUILD FAILED|FAILURE:|FAILED|Exception|Error:|FAIL)\b/i

export function sha256Text(text) {
  return createHash("sha256").update(text).digest("hex")
}

export function sha256File(path) {
  return sha256Text(readFileSync(path, "utf8"))
}

export function parseArgs(argv) {
  const options = {
    runs: 5,
    fixture: "all",
    condition: "all",
    outputRoot: "experiments/eval-runs",
    timeoutMs: 600000,
    preflightOnly: false,
    dryRun: false,
    json: false,
    help: false,
    model: process.env.OPENCODE_MODEL ?? "",
    modelVersion: process.env.OPENCODE_MODEL_VERSION ?? "unknown",
    temperature: process.env.OPENCODE_TEMPERATURE ?? "unknown",
    opencodeCommand: "opencode run --model {model} --prompt-file {promptFile}",
    phInstallCommand: process.env.PERSONA_HARNESS_INSTALL_COMMAND ?? "",
    phInitCommand: process.env.PERSONA_HARNESS_INIT_COMMAND ?? "npx ph init --default backend",
    workflowFinishCommand: process.env.PERSONA_HARNESS_FINISH_COMMAND ?? "npx ph workflow finish implement",
    backendShapeCommand: process.env.PERSONA_HARNESS_BACKEND_SHAPE_COMMAND ?? "",
    runtimeSmokeCommand: process.env.EVAL_RUNTIME_SMOKE_COMMAND ?? "",
    installSource: process.env.PERSONA_HARNESS_INSTALL_COMMAND ?? "unknown",
    projectDir: process.cwd(),
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = () => {
      index += 1
      if (index >= argv.length) {
        throw new Error(`${arg} requires a value`)
      }
      return argv[index]
    }

    if (arg === "--help" || arg === "-h") options.help = true
    else if (arg === "--runs") options.runs = Number.parseInt(next(), 10)
    else if (arg === "--fixture") options.fixture = next()
    else if (arg === "--condition") options.condition = normalizeConditionId(next())
    else if (arg === "--output-root") options.outputRoot = next()
    else if (arg === "--timeout-ms") options.timeoutMs = Number.parseInt(next(), 10)
    else if (arg === "--model") options.model = next()
    else if (arg === "--model-version") options.modelVersion = next()
    else if (arg === "--temperature") options.temperature = next()
    else if (arg === "--opencode-command") options.opencodeCommand = next()
    else if (arg === "--ph-install-command") {
      options.phInstallCommand = next()
      options.installSource = options.phInstallCommand
    } else if (arg === "--ph-init-command") options.phInitCommand = next()
    else if (arg === "--workflow-finish-command") options.workflowFinishCommand = next()
    else if (arg === "--backend-shape-command") options.backendShapeCommand = next()
    else if (arg === "--runtime-smoke-command") options.runtimeSmokeCommand = next()
    else if (arg === "--project-dir") options.projectDir = next()
    else if (arg === "--preflight") options.preflightOnly = true
    else if (arg === "--dry-run") options.dryRun = true
    else if (arg === "--json") options.json = true
    else throw new Error(`Unknown option: ${arg}`)
  }

  if (!Number.isInteger(options.runs) || options.runs < 1) {
    throw new Error("--runs requires a positive integer")
  }
  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1000) {
    throw new Error("--timeout-ms requires an integer >= 1000")
  }

  return options
}

export function normalizeConditionId(id) {
  if (id === "ph" || id === "persona" || id === "persona-harness") return "ph-on"
  if (id === "claude-md" || id === "cursorrules" || id === "claude-or-cursorrules") return "claude"
  if (id === "agents-md") return "agents"
  return id
}

export function selectFixtures(fixtureOption) {
  if (fixtureOption === "all") return Object.keys(FIXTURE_PATHS)
  if (!Object.hasOwn(FIXTURE_PATHS, fixtureOption)) {
    throw new Error(`Unknown fixture: ${fixtureOption}`)
  }
  return [fixtureOption]
}

export function selectConditions(conditionOption) {
  if (conditionOption === "all") return Object.keys(CONDITIONS)
  if (!Object.hasOwn(CONDITIONS, conditionOption)) {
    throw new Error(`Unknown condition: ${conditionOption}`)
  }
  return [conditionOption]
}

export function buildPlan(options) {
  const fixtureIds = selectFixtures(options.fixture)
  const conditionIds = selectConditions(options.condition)
  const runs = []

  for (const fixtureId of fixtureIds) {
    for (const conditionId of conditionIds) {
      for (let repetition = 1; repetition <= options.runs; repetition += 1) {
        runs.push({ fixtureId, conditionId, repetition })
      }
    }
  }

  return { fixtureIds, conditionIds, runs }
}

export function commandExists(command) {
  const executable = command.trim().split(/\s+/)[0]
  if (!executable) return false
  const lookup = process.platform === "win32" ? `where ${quoteShell(executable)}` : `command -v ${quoteShell(executable)}`
  const result = spawnSync(lookup, { encoding: "utf8", shell: true })
  return result.status === 0
}

export function preflight(options, plan = buildPlan(options)) {
  const errors = []
  if (!options.model) {
    errors.push("model id is required via --model or OPENCODE_MODEL")
  }
  if (!commandExists(options.opencodeCommand)) {
    errors.push(`OpenCode command not found: ${options.opencodeCommand.trim().split(/\s+/)[0]}`)
  }
  for (const requiredCommand of ["java", "gradle", "node", "npm", "git"]) {
    if (!commandExists(requiredCommand)) errors.push(`required command not found: ${requiredCommand}`)
  }
  if (plan.conditionIds.includes("ph-on") && !options.phInstallCommand) {
    errors.push("PH ON requires --ph-install-command or PERSONA_HARNESS_INSTALL_COMMAND")
  }
  for (const fixtureId of plan.fixtureIds) {
    const fixturePath = resolve(options.projectDir, FIXTURE_PATHS[fixtureId])
    if (!existsSync(fixturePath)) errors.push(`fixture file not found: ${fixturePath}`)
  }
  return { ok: errors.length === 0, errors }
}

export function formatCommand(template, values) {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => {
    if (!Object.hasOwn(values, key)) return ""
    return quoteShell(String(values[key]))
  })
}

export function quoteShell(value) {
  if (process.platform === "win32") {
    return `"${String(value).replaceAll('"', '\\"')}"`
  }
  return `'${String(value).replaceAll("'", "'\\''")}'`
}

export function runShell(command, cwd, timeoutMs) {
  const result = spawnSync(command, {
    cwd,
    encoding: "utf8",
    shell: true,
    timeout: timeoutMs,
    maxBuffer: 20 * 1024 * 1024,
  })
  return {
    command,
    cwd,
    status: result.status,
    signal: result.signal,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    timedOut: result.error?.name === "Error" && /timed out/i.test(result.error.message),
    error: result.error ? result.error.message : "",
  }
}

export function parseCommandOutcome(execution) {
  const combined = `${execution.stdout}\n${execution.stderr}`
  if (execution.timedOut) return "FAIL"
  if (execution.status === 0 && !FAIL_TEXT.test(combined)) return "PASS"
  if (execution.status === 0 && PASS_TEXT.test(combined) && !FAIL_TEXT.test(combined)) return "PASS"
  return "FAIL"
}

export function parseBackendShapeWarnCount(text) {
  const explicit = text.match(/WARN(?: count)?:\s*(\d+)/i)
  if (explicit) return Number.parseInt(explicit[1], 10)
  const warnMatches = text.match(/\bWARN\b/g)
  return warnMatches ? warnMatches.length : 0
}

export function detectStackAlignment(workspaceDir) {
  const files = listFiles(workspaceDir).map((path) => path.replaceAll("\\", "/"))
  const hasGradle = files.some((file) => /(^|\/)(build\.gradle|build\.gradle\.kts|settings\.gradle|settings\.gradle\.kts|gradlew|gradlew\.bat)$/.test(file))
  const hasJava = files.some((file) => file.endsWith(".java"))
  const hasSpring = files.some((file) => {
    if (!file.endsWith(".java") && !file.endsWith(".gradle") && !file.endsWith(".kts")) return false
    const absolutePath = join(workspaceDir, file)
    if (!existsSync(absolutePath)) return false
    const content = readFileSync(absolutePath, "utf8")
    return /springframework|org\.springframework|spring-boot/i.test(content)
  })
  const hasBackendShape = files.some((file) => /src\/main\/(java|kotlin)|controller|service|repository|domain|dto/i.test(file))

  if (hasGradle && hasJava && hasSpring) {
    return { score: 2, rationale: "Gradle + Java + Spring markers detected" }
  }
  if ((hasGradle && hasJava) || hasBackendShape) {
    return { score: 1, rationale: "partial backend or Gradle/Java markers detected" }
  }
  return { score: 0, rationale: "expected backend stack markers not detected" }
}

export function listFiles(rootDir) {
  if (!existsSync(rootDir)) return []
  const result = []
  const stack = [rootDir]
  while (stack.length > 0) {
    const current = stack.pop()
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".gradle") continue
      const fullPath = join(current, entry.name)
      if (entry.isDirectory()) stack.push(fullPath)
      else result.push(fullPath.slice(rootDir.length + 1))
    }
  }
  return result
}

export function gradleCommand(workspaceDir, task) {
  const isWindows = process.platform === "win32"
  const bat = join(workspaceDir, "gradlew.bat")
  const sh = join(workspaceDir, "gradlew")
  if (isWindows && existsSync(bat)) return `gradlew.bat ${task}`
  if (existsSync(sh)) return `chmod +x ./gradlew && ./gradlew ${task}`
  return `gradle ${task}`
}

export function countFailureModes(outcomes) {
  const labels = []
  if (outcomes.stackAlignmentScore === 0) labels.push("wrong stack")
  if (outcomes.compileBuildOutcome === "FAIL") labels.push("compile failure")
  if (outcomes.gradleTestOutcome === "FAIL") labels.push("test failure")
  if (outcomes.runtimeSmokeOutcome === "FAIL") labels.push("runtime smoke failure")
  if (outcomes.runtimeSmokeOutcome === "NOT RUN") labels.push("runtime smoke failure")
  if (outcomes.providerFailed) labels.push("provider limit")
  if (outcomes.workflowFinishOutcome === "FAIL") labels.push("workflow dead-end")
  return { count: labels.length, labels }
}

export function aggregateRuns(runs) {
  const byCondition = {}
  for (const run of runs) {
    const key = `${run.fixtureId}:${run.conditionId}`
    const bucket = byCondition[key] ?? {
      fixtureId: run.fixtureId,
      conditionId: run.conditionId,
      runs: 0,
      compileBuildPasses: 0,
      gradleTestPasses: 0,
      runtimeSmokePasses: 0,
      runtimeSmokeKnown: 0,
      stackAlignmentAverage: 0,
      externalFailureModeTotal: 0,
      backendShapeWarnTotal: 0,
      workflowFinishPasses: 0,
    }
    bucket.runs += 1
    if (run.metrics.compileBuildPass === true) bucket.compileBuildPasses += 1
    if (run.metrics.gradleTestPass === true) bucket.gradleTestPasses += 1
    if (run.metrics.runtimeSmokePass === true) bucket.runtimeSmokePasses += 1
    if (run.metrics.runtimeSmokePass !== null) bucket.runtimeSmokeKnown += 1
    bucket.stackAlignmentAverage += run.metrics.stackAlignmentScore
    bucket.externalFailureModeTotal += run.metrics.externalFailureModeCount
    bucket.backendShapeWarnTotal += run.metrics.backendShapeWarnCount ?? 0
    if (run.metrics.workflowFinishOutcome === "PASS") bucket.workflowFinishPasses += 1
    byCondition[key] = bucket
  }

  for (const bucket of Object.values(byCondition)) {
    bucket.compileBuildRate = rate(bucket.compileBuildPasses, bucket.runs)
    bucket.gradleTestRate = rate(bucket.gradleTestPasses, bucket.runs)
    bucket.runtimeSmokeRate = bucket.runtimeSmokeKnown === 0 ? null : rate(bucket.runtimeSmokePasses, bucket.runtimeSmokeKnown)
    bucket.stackAlignmentAverage = bucket.runs === 0 ? 0 : bucket.stackAlignmentAverage / bucket.runs
    bucket.workflowFinishPassRate = rate(bucket.workflowFinishPasses, bucket.runs)
  }

  return { byCondition: Object.values(byCondition) }
}

function rate(numerator, denominator) {
  return denominator === 0 ? 0 : numerator / denominator
}

export function decideResults(results) {
  const reasons = []
  const runs = Array.isArray(results.runs) ? results.runs : []
  if (runs.length === 0) {
    return { verdict: "INCONCLUSIVE", reasons: ["results contains no runs"] }
  }

  const fixtureIds = [...new Set(runs.map((run) => run.fixtureId))]
  let anyFailure = false
  let anyInconclusive = false

  for (const fixtureId of fixtureIds) {
    const fixtureRuns = runs.filter((run) => run.fixtureId === fixtureId)
    const phRuns = fixtureRuns.filter((run) => run.conditionId === "ph-on")
    const offRuns = fixtureRuns.filter((run) => run.conditionId !== "ph-on")
    if (phRuns.length === 0 || offRuns.length === 0) {
      anyInconclusive = true
      reasons.push(`${fixtureId}: requires PH ON and at least one OFF baseline`)
      continue
    }

    const ph = summarizeComparable(phRuns)
    const offs = groupBy(offRuns, (run) => run.conditionId).map((group) => summarizeComparable(group))
    const strongestOff = offs.reduce((best, current) =>
      current.externalFailureModeTotal < best.externalFailureModeTotal ? current : best,
    )

    for (const metric of ["compileBuildRate", "gradleTestRate", "runtimeSmokeRate"]) {
      if (ph[metric] === null || offs.some((off) => off[metric] === null)) {
        anyInconclusive = true
        reasons.push(`${fixtureId}: ${metric} missing for comparable decision`)
        continue
      }
      const worseThan = offs.find((off) => ph[metric] < off[metric])
      if (worseThan) {
        anyFailure = true
        reasons.push(`${fixtureId}: PH ON ${metric} regressed below ${worseThan.conditionId}`)
      }
    }

    if (strongestOff.externalFailureModeTotal === 0) {
      if (ph.externalFailureModeTotal === 0) {
        anyInconclusive = true
        reasons.push(`${fixtureId}: strongest OFF has zero failure modes, so 20% reduction cannot be demonstrated`)
      } else {
        anyFailure = true
        reasons.push(`${fixtureId}: PH ON has failures while strongest OFF has zero`)
      }
    } else {
      const reduction = (strongestOff.externalFailureModeTotal - ph.externalFailureModeTotal) / strongestOff.externalFailureModeTotal
      if (reduction < 0.2) {
        anyFailure = true
        reasons.push(`${fixtureId}: PH ON failure-mode reduction ${formatPercent(reduction)} is below 20%`)
      }
    }

    const plain = offs.find((off) => off.conditionId === "plain")
    if (!plain) {
      anyInconclusive = true
      reasons.push(`${fixtureId}: plain prompt baseline is required for stack alignment threshold`)
    } else if (ph.stackAlignmentRate - plain.stackAlignmentRate < 0.2) {
      anyFailure = true
      reasons.push(`${fixtureId}: PH ON stack alignment improvement over plain is below 20 percentage points`)
    }

    for (const staticBaseline of offs.filter((off) => off.conditionId !== "plain")) {
      if (ph.stackAlignmentRate < staticBaseline.stackAlignmentRate) {
        anyFailure = true
        reasons.push(`${fixtureId}: PH ON stack alignment is worse than ${staticBaseline.conditionId}`)
      }
    }
  }

  if (anyFailure) return { verdict: "FAIL", reasons }
  if (anyInconclusive) return { verdict: "INCONCLUSIVE", reasons }
  return { verdict: "PASS", reasons: ["PH ON met coded v0.4 threshold checks for supplied results"] }
}

export function summarizeComparable(runs) {
  const total = runs.length
  const conditionId = runs[0]?.conditionId ?? "unknown"
  const compileBuildRate = passRate(runs, "compileBuildPass")
  const gradleTestRate = passRate(runs, "gradleTestPass")
  const runtimeSmokeValues = runs.map((run) => run.metrics.runtimeSmokePass).filter((value) => value !== null)
  const runtimeSmokeRate =
    runtimeSmokeValues.length === 0 ? null : runtimeSmokeValues.filter((value) => value === true).length / runtimeSmokeValues.length
  const aligned = runs.filter((run) => run.metrics.stackAlignmentScore === 2).length
  return {
    conditionId,
    total,
    compileBuildRate,
    gradleTestRate,
    runtimeSmokeRate,
    stackAlignmentRate: total === 0 ? 0 : aligned / total,
    externalFailureModeTotal: runs.reduce((sum, run) => sum + run.metrics.externalFailureModeCount, 0),
  }
}

function passRate(runs, key) {
  if (runs.length === 0) return null
  return runs.filter((run) => run.metrics[key] === true).length / runs.length
}

function groupBy(items, keyFn) {
  const map = new Map()
  for (const item of items) {
    const key = keyFn(item)
    const group = map.get(key) ?? []
    group.push(item)
    map.set(key, group)
  }
  return [...map.values()]
}

function formatPercent(value) {
  return `${Math.round(value * 1000) / 10}%`
}

export async function runEval(options) {
  const plan = buildPlan(options)
  const preflightResult = preflight(options, plan)
  if (!preflightResult.ok) {
    return { ok: false, preflight: preflightResult, resultsPath: null, results: null }
  }
  if (options.dryRun || options.preflightOnly) {
    return { ok: true, preflight: preflightResult, resultsPath: null, results: null, plan }
  }

  const timestamp = new Date().toISOString().replaceAll(":", "").replaceAll(".", "")
  const outputDir = resolve(options.projectDir, options.outputRoot, timestamp)
  mkdirSync(outputDir, { recursive: true })

  const environment = collectEnvironment(options)
  const gitCommit = getGitCommit(options.projectDir)
  const runs = []

  for (const runPlan of plan.runs) {
    runs.push(await executeRun(options, outputDir, runPlan, environment, gitCommit))
  }

  const results = {
    schemaVersion: "persona-onoff-eval.1",
    createdAt: new Date().toISOString(),
    gitCommit,
    installSource: options.installSource,
    model: {
      id: options.model,
      version: options.modelVersion,
      temperature: options.temperature === "unknown" ? null : options.temperature,
    },
    timeoutMs: options.timeoutMs,
    environment,
    options: {
      fixture: options.fixture,
      condition: options.condition,
      runs: options.runs,
    },
    runs,
    aggregate: aggregateRuns(runs),
  }
  const resultsPath = join(outputDir, "results.json")
  writeFileSync(resultsPath, `${JSON.stringify(results, null, 2)}\n`)
  return { ok: true, preflight: preflightResult, resultsPath, results, plan }
}

async function executeRun(options, outputDir, runPlan, environment, gitCommit) {
  const fixturePath = resolve(options.projectDir, FIXTURE_PATHS[runPlan.fixtureId])
  const fixtureText = readFileSync(fixturePath, "utf8")
  const runId = `${environment.platform}-${runPlan.fixtureId}-${runPlan.conditionId}-r${runPlan.repetition}`.toLowerCase()
  const workspaceDir = join(outputDir, "workspaces", runId)
  mkdirSync(workspaceDir, { recursive: true })
  await writeFile(join(workspaceDir, "README.md"), fixtureText)

  const baselineFile = await prepareConditionFiles(workspaceDir, runPlan.conditionId)
  const prompt = buildPrompt(fixtureText, runPlan.conditionId)
  const promptFile = join(workspaceDir, "prompt.txt")
  await writeFile(promptFile, prompt)

  const logsDir = join(outputDir, "logs", runId)
  mkdirSync(logsDir, { recursive: true })

  const commands = []
  if (runPlan.conditionId === "ph-on") {
    commands.push(["ph-install", options.phInstallCommand])
    commands.push(["ph-init", options.phInitCommand])
  }
  commands.push([
    "opencode",
    formatCommand(options.opencodeCommand, { model: options.model, promptFile, workspaceDir }),
  ])

  const commandResults = {}
  let providerFailed = false
  for (const [name, command] of commands) {
    const execution = runShell(command, workspaceDir, options.timeoutMs)
    commandResults[name] = execution
    writeCommandLog(join(logsDir, `${name}.log`), execution)
    if (name === "opencode" && execution.status !== 0) providerFailed = true
  }

  const testExecution = runShell(gradleCommand(workspaceDir, "test"), workspaceDir, options.timeoutMs)
  writeCommandLog(join(logsDir, "gradle-test.log"), testExecution)
  const buildExecution = runShell(gradleCommand(workspaceDir, "build"), workspaceDir, options.timeoutMs)
  writeCommandLog(join(logsDir, "gradle-build.log"), buildExecution)

  const runtimeExecution = options.runtimeSmokeCommand
    ? runShell(options.runtimeSmokeCommand, workspaceDir, options.timeoutMs)
    : null
  if (runtimeExecution) writeCommandLog(join(logsDir, "runtime-smoke.log"), runtimeExecution)

  const workflowFinishExecution =
    runPlan.conditionId === "ph-on" ? runShell(options.workflowFinishCommand, workspaceDir, options.timeoutMs) : null
  if (workflowFinishExecution) writeCommandLog(join(logsDir, "workflow-finish.log"), workflowFinishExecution)

  const backendShapeExecution = options.backendShapeCommand
    ? runShell(options.backendShapeCommand, workspaceDir, options.timeoutMs)
    : null
  if (backendShapeExecution) writeCommandLog(join(logsDir, "backend-shape.log"), backendShapeExecution)

  const stackAlignment = detectStackAlignment(workspaceDir)
  const compileBuildOutcome = parseCommandOutcome(buildExecution)
  const gradleTestOutcome = parseCommandOutcome(testExecution)
  const runtimeSmokeOutcome = runtimeExecution ? parseCommandOutcome(runtimeExecution) : "NOT RUN"
  const workflowFinishOutcome = workflowFinishExecution
    ? workflowFinishExecution.status === 0
      ? "PASS"
      : "FAIL"
    : "NOT APPLICABLE"
  const backendShapeWarnCount = backendShapeExecution
    ? parseBackendShapeWarnCount(`${backendShapeExecution.stdout}\n${backendShapeExecution.stderr}`)
    : null
  const failures = countFailureModes({
    compileBuildOutcome,
    gradleTestOutcome,
    runtimeSmokeOutcome,
    stackAlignmentScore: stackAlignment.score,
    workflowFinishOutcome,
    providerFailed,
  })

  return {
    runId,
    fixtureId: runPlan.fixtureId,
    conditionId: runPlan.conditionId,
    repetition: runPlan.repetition,
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    workspaceDir,
    logsDir,
    fixtureHash: sha256Text(fixtureText),
    baselineFile,
    gitCommit,
    metadata: {
      model: options.model,
      modelVersion: options.modelVersion,
      temperature: options.temperature === "unknown" ? null : options.temperature,
      timeoutMs: options.timeoutMs,
      environment,
    },
    outcomes: {
      compileBuildOutcome,
      gradleTestOutcome,
      runtimeSmokeOutcome,
      workflowFinishOutcome,
    },
    metrics: {
      compileBuildPass: compileBuildOutcome === "PASS",
      gradleTestPass: gradleTestOutcome === "PASS",
      runtimeSmokePass: runtimeSmokeOutcome === "NOT RUN" ? null : runtimeSmokeOutcome === "PASS",
      stackAlignmentScore: stackAlignment.score,
      stackAlignmentRationale: stackAlignment.rationale,
      externalFailureModeCount: failures.count,
      externalFailureModeLabels: failures.labels,
      workflowFinishOutcome,
      backendShapeWarnCount,
    },
  }
}

async function prepareConditionFiles(workspaceDir, conditionId) {
  if (conditionId === "plain") return null
  const content = [
    "# Static Backend Baseline",
    "",
    "- Build a backend-only service.",
    "- Prefer clear build, test, and run commands.",
    "- Prefer layered backend boundaries and automated tests.",
    "- Do not build a frontend unless the fixture explicitly asks for one.",
    "- Do not use Persona Harness-specific command knowledge in this baseline.",
    "",
  ].join("\n")
  if (conditionId === "claude") {
    const file = join(workspaceDir, "CLAUDE.md")
    await writeFile(file, content)
    return basename(file)
  }
  if (conditionId === "agents") {
    const file = join(workspaceDir, "AGENTS.md")
    await writeFile(file, content)
    return basename(file)
  }
  return null
}

function buildPrompt(fixtureText, conditionId) {
  const lines = [
    "Implement the following backend fixture in the current working directory.",
    "Return only after you have produced the project files and documented build/test/run commands.",
    "",
    fixtureText,
  ]
  if (conditionId === "ph-on") {
    lines.unshift("Use Persona Harness workflow guidance already installed in this project. Do not claim completion until workflow reports are filled.")
  }
  return `${lines.join("\n")}\n`
}

function writeCommandLog(path, execution) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(
    path,
    [
      `$ ${execution.command}`,
      `cwd: ${execution.cwd}`,
      `status: ${execution.status}`,
      `signal: ${execution.signal ?? ""}`,
      execution.error ? `error: ${execution.error}` : "",
      "",
      "## stdout",
      execution.stdout,
      "",
      "## stderr",
      execution.stderr,
      "",
    ].join("\n"),
  )
}

function collectEnvironment(options) {
  return {
    platform: process.platform,
    os: process.version,
    node: process.version,
    npm: commandOutput("npm --version"),
    java: commandOutput("java -version"),
    gradle: commandOutput("gradle -version"),
    opencode: commandOutput(`${options.opencodeCommand.trim().split(/\s+/)[0]} --version`),
  }
}

function commandOutput(command) {
  const result = runShell(command, process.cwd(), 15000)
  const text = `${result.stdout}\n${result.stderr}`.trim()
  return text.split("\n").slice(0, 3).join("\n") || "unknown"
}

function getGitCommit(projectDir) {
  const result = runShell("git rev-parse HEAD", projectDir, 15000)
  return result.status === 0 ? result.stdout.trim() : "unknown"
}

export async function copyFixtureResults(sourcePath) {
  const target = await mkdtemp(join(tmpdir(), "persona-eval-results-"))
  await cp(sourcePath, join(target, basename(sourcePath)), { recursive: true })
  return target
}
