import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { cp, mkdtemp, writeFile } from "node:fs/promises"
import { arch, platform, release, tmpdir, type } from "node:os"
import { basename, dirname, join, resolve } from "node:path"
import { spawn, spawnSync } from "node:child_process"

export const FIXTURE_PATHS = {
  "backend-api-no-stack": "docs/current/evaluation-fixtures/backend-api-no-stack.md",
  "multi-step-backend": "docs/current/evaluation-fixtures/multi-step-backend.md",
  "multi-step-backend-small": "docs/current/evaluation-fixtures/multi-step-backend-small.md",
  "ambiguous-idea-first": "docs/current/evaluation-fixtures/ambiguous-idea-first.md",
}

export const FIXTURE_METADATA = {
  "backend-api-no-stack": {
    scopeClass: "single-turn",
    singleTurnEligible: true,
  },
  "multi-step-backend": {
    scopeClass: "stress-continuation",
    singleTurnEligible: false,
  },
  "multi-step-backend-small": {
    scopeClass: "reduced-single-turn",
    singleTurnEligible: true,
    pairedWith: "multi-step-backend",
  },
  "ambiguous-idea-first": {
    scopeClass: "single-turn",
    singleTurnEligible: true,
  },
}

export const CONDITIONS = {
  plain: { id: "plain", label: "plain prompt", harnessState: "OFF" },
  claude: { id: "claude", label: "CLAUDE.md baseline", harnessState: "OFF" },
  agents: { id: "agents", label: "AGENTS.md baseline", harnessState: "OFF" },
  "ph-on": { id: "ph-on", label: "Persona Harness ON", harnessState: "ON" },
}

const JUNIT_RESULT_DIR = join("build", "test-results", "test")
const RAW_ROOT = "raw"
const STACK_CRITERIA = [
  "controllerServiceDependency",
  "noControllerRepositoryDependency",
  "noServiceStorageOwnership",
  "dtoBoundary",
]
export const DEFAULT_OUTPUT_ROOT = join(tmpdir(), "persona-harness-eval-runs")
const AMBIENT_INFLUENCE_PATHS = ["AGENTS.md", "CLAUDE.md", ".persona", ".opencode"]
export const DECISION_POLICIES = {
  legacyStackHard: "legacy-v0.4-stack-hard",
  externalPrimary: "external-primary-v0.4.1",
}

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
    outputRoot: DEFAULT_OUTPUT_ROOT,
    timeoutMs: 600000,
    concurrency: 1,
    preflightOnly: false,
    dryRun: false,
    json: false,
    help: false,
    model: process.env.OPENCODE_MODEL ?? "",
    modelVersion: process.env.OPENCODE_MODEL_VERSION ?? "unknown",
    modelVersionReason: process.env.OPENCODE_MODEL_VERSION ? null : "OPENCODE_MODEL_VERSION is not set",
    temperature: process.env.OPENCODE_TEMPERATURE ?? "unknown",
    topP: process.env.OPENCODE_TOP_P ?? "unknown",
    seed: process.env.OPENCODE_SEED ?? "unknown",
    topPReason: process.env.OPENCODE_TOP_P ? null : "OPENCODE_TOP_P is not set or unsupported by the selected CLI surface",
    seedReason: process.env.OPENCODE_SEED ? null : "OPENCODE_SEED is not set or unsupported by the selected CLI surface",
    opencodeCommand: "opencode run --model {model} {prompt}",
    phInstallCommand: process.env.PERSONA_HARNESS_INSTALL_COMMAND ?? "",
    phInitCommand: process.env.PERSONA_HARNESS_INIT_COMMAND ?? "npx ph init --default backend",
    workflowFinishCommand: process.env.PERSONA_HARNESS_FINISH_COMMAND ?? "npx ph workflow finish implement",
    backendShapeCommand: process.env.PERSONA_HARNESS_BACKEND_SHAPE_COMMAND ?? "",
    runtimeSmokeCommand: process.env.EVAL_RUNTIME_SMOKE_COMMAND ?? "",
    installSource: process.env.PERSONA_HARNESS_INSTALL_COMMAND ?? "unknown",
    projectDir: process.cwd(),
    capture: false,
    replayDir: "",
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
    else if (arg === "--concurrency") options.concurrency = Number.parseInt(next(), 10)
    else if (arg === "--model") options.model = next()
    else if (arg === "--model-version") options.modelVersion = next()
    else if (arg === "--temperature") options.temperature = next()
    else if (arg === "--top-p") options.topP = next()
    else if (arg === "--seed") options.seed = next()
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
    else if (arg === "--capture") options.capture = true
    else if (arg === "--replay") options.replayDir = next()
    else if (arg === "--json") options.json = true
    else throw new Error(`Unknown option: ${arg}`)
  }

  if (!Number.isInteger(options.runs) || options.runs < 1) {
    throw new Error("--runs requires a positive integer")
  }
  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1000) {
    throw new Error("--timeout-ms requires an integer >= 1000")
  }
  if (!Number.isInteger(options.concurrency) || options.concurrency < 1) {
    throw new Error("--concurrency requires a positive integer")
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
  const fixtureMetadata = fixtureMetadataForIds(fixtureIds)
  const runs = []

  for (const fixtureId of fixtureIds) {
    for (const conditionId of conditionIds) {
      for (let repetition = 1; repetition <= options.runs; repetition += 1) {
        runs.push({ fixtureId, conditionId, repetition })
      }
    }
  }

  return { fixtureIds, conditionIds, fixtureMetadata, runs }
}

function fixtureMetadataForIds(fixtureIds) {
  return Object.fromEntries(fixtureIds.map((fixtureId) => [fixtureId, fixtureMetadataFor(fixtureId)]))
}

function fixtureMetadataFor(fixtureId) {
  return FIXTURE_METADATA[fixtureId] ?? { scopeClass: "single-turn", singleTurnEligible: true }
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
  const ambientInfluencePaths = findAmbientInfluencePaths(options.projectDir, options.outputRoot)
  if (ambientInfluencePaths.length > 0) {
    errors.push(`output root is not isolated from ambient eval files: ${ambientInfluencePaths.join(", ")}`)
  }
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

export function findAmbientInfluencePaths(projectDir, outputRoot) {
  const outputBase = resolve(projectDir, outputRoot)
  const found = []
  let current = outputBase
  for (;;) {
    for (const entry of AMBIENT_INFLUENCE_PATHS) {
      const candidate = join(current, entry)
      if (existsSync(candidate)) found.push(candidate)
    }
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }
  return found
}

export function scanWorkspacePurity(workspaceDir, conditionId) {
  if (conditionId === "ph-on") {
    return { status: "NOT_APPLICABLE", violations: [] }
  }
  const disallowed = baselineDisallowedPaths(conditionId)
  const violations = disallowed.map((entry) => join(workspaceDir, entry)).filter((candidate) => existsSync(candidate))
  return {
    status: violations.length === 0 ? "PASS" : "FAIL",
    violations,
  }
}

function baselineDisallowedPaths(conditionId) {
  if (conditionId === "claude") return ["AGENTS.md", ".persona", ".opencode"]
  if (conditionId === "agents") return ["CLAUDE.md", ".persona", ".opencode"]
  return ["AGENTS.md", "CLAUDE.md", ".persona", ".opencode"]
}

export function formatCommand(template, values) {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => {
    if (key === "temperatureFlag") return values.temperature === "unknown" ? "" : `--temperature ${quoteShell(String(values.temperature))}`
    if (key === "topPFlag") return values.topP === "unknown" ? "" : `--top-p ${quoteShell(String(values.topP))}`
    if (key === "seedFlag") return values.seed === "unknown" ? "" : `--seed ${quoteShell(String(values.seed))}`
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

export function runShellAsync(command, cwd, timeoutMs, options = {}) {
  const cleanupProcessGroup = options.cleanupProcessGroup === true && process.platform !== "win32"
  return new Promise((resolvePromise) => {
    const child = spawn(command, {
      cwd,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
      detached: cleanupProcessGroup,
    })
    let stdout = ""
    let stderr = ""
    let errorMessage = ""
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      terminateChildProcess(child, cleanupProcessGroup, "SIGTERM")
    }, timeoutMs)
    child.stdout.setEncoding("utf8")
    child.stderr.setEncoding("utf8")
    child.stdout.on("data", (chunk) => {
      stdout += chunk
    })
    child.stderr.on("data", (chunk) => {
      stderr += chunk
    })
    child.on("error", (error) => {
      errorMessage = error instanceof Error ? error.message : String(error)
    })
    child.on("close", (status, signal) => {
      clearTimeout(timer)
      if (cleanupProcessGroup) {
        terminateChildProcess(child, cleanupProcessGroup, "SIGTERM")
      }
      resolvePromise({
        command,
        cwd,
        status,
        signal,
        stdout,
        stderr,
        timedOut,
        error: timedOut ? `timed out after ${timeoutMs}ms` : errorMessage,
      })
    })
  })
}

function terminateChildProcess(child, cleanupProcessGroup, signal) {
  try {
    if (cleanupProcessGroup) {
      process.kill(-child.pid, signal)
      return
    }
    child.kill(signal)
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : null
    if (code === "ESRCH" || code === "EPERM") return
    throw error
  }
}

export function parseCommandOutcome(execution) {
  if (execution.timedOut) return "FAIL"
  return execution.status === 0 ? "PASS" : "FAIL"
}

export function parseCapturedCommandOutcome(logPath) {
  if (!existsSync(logPath)) return "NOT RUN"
  const text = readFileSync(logPath, "utf8")
  const statusMatch = text.match(/^status:\s*(.+)$/m)
  if (!statusMatch) return "NOT RUN"
  return statusMatch[1].trim() === "0" ? "PASS" : "FAIL"
}

export function parseJUnitXmlText(xmlText) {
  const suites = []
  for (const match of xmlText.matchAll(/<testsuite\b([^>]*)>/g)) {
    suites.push(parseJUnitAttributes(match[1] ?? ""))
  }
  if (suites.length === 0) {
    const testcaseCount = [...xmlText.matchAll(/<testcase\b/g)].length
    if (testcaseCount === 0) return { tests: 0, failures: 0, errors: 0, skipped: 0 }
    return {
      tests: testcaseCount,
      failures: [...xmlText.matchAll(/<failure\b/g)].length,
      errors: [...xmlText.matchAll(/<error\b/g)].length,
      skipped: [...xmlText.matchAll(/<skipped\b/g)].length,
    }
  }
  return suites.reduce(
    (total, suite) => ({
      tests: total.tests + suite.tests,
      failures: total.failures + suite.failures,
      errors: total.errors + suite.errors,
      skipped: total.skipped + suite.skipped,
    }),
    { tests: 0, failures: 0, errors: 0, skipped: 0 },
  )
}

function parseJUnitAttributes(attributeText) {
  return {
    tests: parseJUnitInteger(attributeText, "tests"),
    failures: parseJUnitInteger(attributeText, "failures"),
    errors: parseJUnitInteger(attributeText, "errors"),
    skipped: parseJUnitInteger(attributeText, "skipped"),
  }
}

function parseJUnitInteger(attributeText, name) {
  const match = attributeText.match(new RegExp(`\\b${name}="(\\d+)"`))
  return match ? Number.parseInt(match[1], 10) : 0
}

export function collectJUnitResults(workspaceDir) {
  const resultDir = join(workspaceDir, JUNIT_RESULT_DIR)
  if (!existsSync(resultDir)) {
    return { outcome: "UNKNOWN", tests: 0, failures: 0, errors: 0, skipped: 0, files: [] }
  }
  const files = listFiles(resultDir)
    .filter((file) => /^TEST-.*\.xml$/.test(basename(file)))
    .map((file) => join(resultDir, file))
  if (files.length === 0) {
    return { outcome: "UNKNOWN", tests: 0, failures: 0, errors: 0, skipped: 0, files: [] }
  }
  const totals = files
    .map((file) => parseJUnitXmlText(readFileSync(file, "utf8")))
    .reduce(
      (total, suite) => ({
        tests: total.tests + suite.tests,
        failures: total.failures + suite.failures,
        errors: total.errors + suite.errors,
        skipped: total.skipped + suite.skipped,
      }),
      { tests: 0, failures: 0, errors: 0, skipped: 0 },
    )
  const outcome = totals.errors > 0 ? "ERROR" : totals.failures > 0 ? "FAIL" : totals.tests > 0 ? "PASS" : "UNKNOWN"
  return { outcome, ...totals, files }
}

export function measureGradleTestResult(workspaceDir, execution) {
  const junit = collectJUnitResults(workspaceDir)
  if (junit.outcome !== "UNKNOWN") return junit
  return { ...junit, outcome: execution.status === 0 ? "UNKNOWN" : "ERROR" }
}

export function measureCompileResult(workspaceDir, execution) {
  if (execution.timedOut || execution.status !== 0) {
    return { outcome: "FAIL", artifacts: [] }
  }
  const artifacts = listFiles(join(workspaceDir, "build")).filter((file) =>
    /^(classes\/(?:java|kotlin)\/main\/|libs\/.+\.(?:jar|war)$)/.test(file.replaceAll("\\", "/")),
  )
  return artifacts.length > 0 ? { outcome: "PASS", artifacts } : { outcome: "UNKNOWN", artifacts }
}

export function parseBackendShapeWarnCount(text) {
  const explicit = text.match(/WARN(?: count)?:\s*(\d+)/i)
  if (explicit) return Number.parseInt(explicit[1], 10)
  const warnMatches = text.match(/\bWARN\b/g)
  return warnMatches ? warnMatches.length : 0
}

export function detectStackAlignment(workspaceDir) {
  const report = runObserveReport(workspaceDir)
  return scoreStackAlignmentFromObserveReport(report, workspaceDir)
}

export function runObserveReport(workspaceDir) {
  const localCli = resolve("dist", "cli", "index.js")
  const command = existsSync(localCli) ? `node ${quoteShell(localCli)} observe --json .` : "npx ph observe --json ."
  const execution = runShell(command, workspaceDir, 60000)
  if (execution.status !== 0) {
    return {
      inspectedFiles: [],
      findings: [],
      observerError: `${execution.stdout}\n${execution.stderr}`.trim(),
    }
  }
  try {
    return JSON.parse(execution.stdout)
  } catch (error) {
    return {
      inspectedFiles: [],
      findings: [],
      observerError: error instanceof Error ? error.message : String(error),
    }
  }
}

export function scoreStackAlignmentFromObserveReport(report, workspaceDir = "") {
  const findings = Array.isArray(report?.findings) ? report.findings : []
  const criterionDetails = {
    controllerServiceDependency: positiveCriterionDetail(
      findings,
      "controller.service-dependency",
      hasControllerServiceStructure(workspaceDir),
      "controller/service dependency inferred from Controller.java source fallback",
    ),
    noControllerRepositoryDependency: noWarnCriterionDetail(findings, "controller.repository-dependency"),
    noServiceStorageOwnership: noWarnCriterionDetail(findings, "service.storage-ownership"),
    dtoBoundary: dtoBoundaryCriterionDetail(findings, hasDtoBoundaryStructure(workspaceDir)),
  }
  const criteria = {
    controllerServiceDependency: criterionDetails.controllerServiceDependency.passed,
    noControllerRepositoryDependency: criterionDetails.noControllerRepositoryDependency.passed,
    noServiceStorageOwnership: criterionDetails.noServiceStorageOwnership.passed,
    dtoBoundary: criterionDetails.dtoBoundary.passed,
  }
  const passed = STACK_CRITERIA.filter((criterion) => criteria[criterion]).length
  const stackAlignmentPrecise = STACK_CRITERIA.every((criterion) => criterionDetails[criterion].source === "observer")
  return {
    rate: passed / STACK_CRITERIA.length,
    score: Math.round((passed / STACK_CRITERIA.length) * 2),
    criteria,
    criterionDetails,
    stackAlignmentPrecise,
    rationale: stackAlignmentPrecise
      ? `${passed}/${STACK_CRITERIA.length} observer-backed stack alignment criteria passed`
      : `${passed}/${STACK_CRITERIA.length} stack alignment criteria passed; includes fallback/low-confidence criteria`,
    observerError: report?.observerError ?? null,
  }
}

function hasFindingPass(findings, ruleId) {
  return findings.some((finding) => finding?.ruleId === ruleId && finding?.result === "PASS")
}

function positiveCriterionDetail(findings, ruleId, fallbackPassed, fallbackLimitation) {
  const matching = findings.filter((finding) => finding?.ruleId === ruleId)
  if (matching.some((finding) => finding.result === "PASS")) {
    return { passed: true, source: "observer", confidence: "HIGH", limitations: [] }
  }
  if (matching.length > 0) {
    return { passed: false, source: "observer", confidence: "HIGH", limitations: [] }
  }
  if (fallbackPassed) {
    return { passed: true, source: "fallback", confidence: "LOW", limitations: [fallbackLimitation] }
  }
  return { passed: false, source: "missing", confidence: "NONE", limitations: [`${ruleId} observer finding missing`] }
}

function noWarnCriterionDetail(findings, ruleId) {
  const matching = findings.filter((finding) => finding?.ruleId === ruleId)
  if (matching.length === 0) {
    return { passed: false, source: "missing", confidence: "NONE", limitations: [`${ruleId} observer finding missing`] }
  }
  return { passed: matching.every((finding) => finding.result === "PASS"), source: "observer", confidence: "HIGH", limitations: [] }
}

function dtoBoundaryCriterionDetail(findings, fallbackPassed) {
  const matching = findings.filter((finding) => finding?.ruleId === "dto.boundary")
  if (matching.length > 0) {
    return {
      passed: hasDtoRolePass(matching, "request") && hasDtoRolePass(matching, "response"),
      source: "observer",
      confidence: "HIGH",
      limitations: [],
    }
  }
  if (fallbackPassed) {
    return {
      passed: true,
      source: "fallback",
      confidence: "LOW",
      limitations: ["DTO boundary inferred from filename fallback"],
    }
  }
  return { passed: false, source: "missing", confidence: "NONE", limitations: ["dto.boundary observer finding missing"] }
}

function hasDtoRolePass(findings, role) {
  return findings.some((finding) => finding.result === "PASS" && finding.evidence?.role === role)
}

function hasControllerServiceStructure(workspaceDir) {
  if (!workspaceDir || !existsSync(workspaceDir)) return false
  return listFiles(workspaceDir)
    .filter((file) => file.endsWith("Controller.java"))
    .some((file) => /\b\w*Service\b/.test(readFileSync(join(workspaceDir, file), "utf8")))
}

function hasDtoBoundaryStructure(workspaceDir) {
  if (!workspaceDir || !existsSync(workspaceDir)) return false
  return listFiles(workspaceDir).some((file) => /(?:Dto|DTO|Request|Response)\.java$/.test(file))
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
  if ((outcomes.stackAlignmentRate ?? 0) < 0.5) labels.push("wrong stack")
  if (outcomes.compileBuildOutcome === "FAIL" || outcomes.compileBuildOutcome === "ERROR") labels.push("compile failure")
  if (outcomes.gradleTestOutcome === "FAIL" || outcomes.gradleTestOutcome === "ERROR") labels.push("test failure")
  if (outcomes.runtimeSmokeOutcome === "FAIL") labels.push("runtime smoke failure")
  if (outcomes.runtimeSmokeOutcome === "NOT RUN") labels.push("runtime smoke failure")
  if (outcomes.providerFailed) labels.push("provider limit")
  if (outcomes.workflowFinishOutcome === "FAIL") labels.push("workflow dead-end")
  return { count: labels.length, labels }
}

export function aggregateRuns(runs) {
  const byCondition = {}
  for (const run of runs) {
    const fixtureMetadata = run.fixtureMetadata ?? fixtureMetadataFor(run.fixtureId)
    const key = `${run.fixtureId}:${run.conditionId}`
    const bucket = byCondition[key] ?? {
      fixtureId: run.fixtureId,
      conditionId: run.conditionId,
      scopeClass: fixtureMetadata.scopeClass,
      singleTurnEligible: fixtureMetadata.singleTurnEligible,
      runs: 0,
      compileBuildPasses: 0,
      compileBuildKnown: 0,
      gradleTestPasses: 0,
      gradleTestKnown: 0,
      runtimeSmokePasses: 0,
      runtimeSmokeKnown: 0,
      stackAlignmentTotal: 0,
      externalFailureModeTotal: 0,
      backendShapeWarnTotal: 0,
      workflowFinishPasses: 0,
    }
    bucket.runs += 1
    if (run.metrics.compileBuildPass === true) bucket.compileBuildPasses += 1
    if (run.metrics.compileBuildPass !== null && run.metrics.compileBuildPass !== undefined) bucket.compileBuildKnown += 1
    if (run.metrics.gradleTestPass === true) bucket.gradleTestPasses += 1
    if (run.metrics.gradleTestPass !== null && run.metrics.gradleTestPass !== undefined) bucket.gradleTestKnown += 1
    if (run.metrics.runtimeSmokePass === true) bucket.runtimeSmokePasses += 1
    if (run.metrics.runtimeSmokePass !== null) bucket.runtimeSmokeKnown += 1
    bucket.stackAlignmentTotal += stackAlignmentRateForRun(run)
    bucket.externalFailureModeTotal += run.metrics.externalFailureModeCount
    bucket.backendShapeWarnTotal += run.metrics.backendShapeWarnCount ?? 0
    if (run.metrics.workflowFinishOutcome === "PASS") bucket.workflowFinishPasses += 1
    byCondition[key] = bucket
  }

  for (const bucket of Object.values(byCondition)) {
    bucket.compileBuildRate = bucket.compileBuildKnown === 0 ? null : rate(bucket.compileBuildPasses, bucket.compileBuildKnown)
    bucket.gradleTestRate = bucket.gradleTestKnown === 0 ? null : rate(bucket.gradleTestPasses, bucket.gradleTestKnown)
    bucket.runtimeSmokeRate = bucket.runtimeSmokeKnown === 0 ? null : rate(bucket.runtimeSmokePasses, bucket.runtimeSmokeKnown)
    bucket.stackAlignmentRate = bucket.runs === 0 ? 0 : bucket.stackAlignmentTotal / bucket.runs
    bucket.workflowFinishPassRate = rate(bucket.workflowFinishPasses, bucket.runs)
  }

  const byConditionValues = Object.values(byCondition)
  return {
    byCondition: byConditionValues,
    singleTurnEligibleByCondition: byConditionValues.filter((bucket) => bucket.singleTurnEligible !== false),
  }
}

function rate(numerator, denominator) {
  return denominator === 0 ? 0 : numerator / denominator
}

export function decideResults(results, options = {}) {
  const policy = options.policy ?? DECISION_POLICIES.legacyStackHard
  const purityFailures = baselinePurityFailures(results)
  if (purityFailures.length > 0) {
    return { policy, verdict: "INCONCLUSIVE", reasons: purityFailures }
  }
  if (policy === DECISION_POLICIES.externalPrimary) return decideExternalPrimaryResults(results, policy)
  if (policy === DECISION_POLICIES.legacyStackHard) return decideLegacyStackHardResults(results, policy)
  throw new Error(`Unknown decision policy: ${policy}`)
}

function baselinePurityFailures(results) {
  const runs = Array.isArray(results?.runs) ? results.runs : []
  return runs
    .filter((run) => run?.conditionId !== "ph-on" && run?.workspacePurity?.status === "FAIL")
    .map((run) => {
      const violations = Array.isArray(run.workspacePurity.violations) ? run.workspacePurity.violations.join(", ") : "unknown violation"
      return `${run.fixtureId ?? "unknown"} ${run.conditionId ?? "unknown"} r${run.repetition ?? "?"}: baseline workspace contamination detected: ${violations}`
    })
}

function decideLegacyStackHardResults(results, policy) {
  const reasons = []
  const runs = Array.isArray(results.runs) ? results.runs : []
  if (runs.length === 0) {
    return { policy, verdict: "INCONCLUSIVE", reasons: ["results contains no runs"] }
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
    const offs = groupBy(offRuns, (run) => run.conditionId)
      .map((group) => summarizeComparable(group))
      .sort(compareComparableSummaries)
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
    } else if (!ph.stackAlignmentPrecise || !plain.stackAlignmentPrecise) {
      anyInconclusive = true
      reasons.push(`${fixtureId}: stack alignment threshold requires observer-backed criteria, fallback/low-confidence criteria observed`)
    } else if (ph.stackAlignmentRate - plain.stackAlignmentRate < 0.2) {
      anyFailure = true
      reasons.push(`${fixtureId}: PH ON stack alignment improvement over plain is below 20 percentage points`)
    }

    for (const staticBaseline of offs.filter((off) => off.conditionId !== "plain")) {
      if (!ph.stackAlignmentPrecise || !staticBaseline.stackAlignmentPrecise) {
        anyInconclusive = true
        reasons.push(`${fixtureId}: stack alignment comparison with ${staticBaseline.conditionId} requires observer-backed criteria`)
      } else if (ph.stackAlignmentRate < staticBaseline.stackAlignmentRate) {
        anyFailure = true
        reasons.push(`${fixtureId}: PH ON stack alignment is worse than ${staticBaseline.conditionId}`)
      }
    }
  }

  if (anyFailure) return { policy, verdict: "FAIL", reasons }
  if (anyInconclusive) return { policy, verdict: "INCONCLUSIVE", reasons }
  return { policy, verdict: "PASS", reasons: ["PH ON met coded v0.4 threshold checks for supplied results"] }
}

function decideExternalPrimaryResults(results, policy) {
  const reasons = []
  if (results.decisionPolicy !== policy) {
    return {
      policy,
      verdict: "INCONCLUSIVE",
      reasons: [`results were not preregistered for ${policy}; rerun eval after gate coding before applying this policy`],
    }
  }
  const runs = Array.isArray(results.runs) ? results.runs : []
  if (runs.length === 0) {
    return { policy, verdict: "INCONCLUSIVE", reasons: ["results contains no runs"] }
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
    const offs = groupBy(offRuns, (run) => run.conditionId)
      .map((group) => summarizeComparable(group))
      .sort(compareComparableSummaries)
    let fixtureTierOneFailed = false

    for (const metric of ["compileBuildRate", "gradleTestRate", "runtimeSmokeRate"]) {
      if (ph[metric] === null || offs.some((off) => off[metric] === null)) {
        anyInconclusive = true
        reasons.push(`${fixtureId}: Tier 1 ${metric} missing for comparable decision`)
        continue
      }
      for (const off of offs) {
        if (ph[metric] < off[metric]) {
          anyFailure = true
          fixtureTierOneFailed = true
          reasons.push(`${fixtureId}: Tier 1 external outcome regression: PH ON ${metric} below ${off.conditionId}`)
        }
      }
    }

    if (ph.workflowFinishRate < 1) {
      anyFailure = true
      fixtureTierOneFailed = true
      reasons.push(`${fixtureId}: Tier 1 workflow finish did not complete for every PH ON run`)
    }

    for (const off of offs) {
      if (ph.externalFailureModeTotal > off.externalFailureModeTotal) {
        anyFailure = true
        fixtureTierOneFailed = true
        reasons.push(`${fixtureId}: Tier 1 failure-mode count increased above ${off.conditionId}`)
      }
    }

    if (fixtureTierOneFailed) continue
    if (!anyInconclusive) reasons.push(`${fixtureId}: Tier 1 external outcomes passed`)

    const plain = offs.find((off) => off.conditionId === "plain")
    if (!plain) {
      reasons.push(`${fixtureId}: Tier 2 stack differentiation not assessed because plain prompt baseline is missing`)
    } else if (!ph.stackAlignmentPrecise || !plain.stackAlignmentPrecise) {
      reasons.push(`${fixtureId}: Tier 2 stack differentiation not assessed because fallback/low-confidence criteria were observed`)
    } else if (ph.stackAlignmentRate - plain.stackAlignmentRate < 0.2) {
      reasons.push(`${fixtureId}: Tier 2 stack differentiation not proven against plain`)
    } else {
      reasons.push(`${fixtureId}: Tier 2 stack differentiation observed against plain`)
    }

    for (const staticBaseline of offs.filter((off) => off.conditionId !== "plain")) {
      if (!ph.stackAlignmentPrecise || !staticBaseline.stackAlignmentPrecise) {
        reasons.push(`${fixtureId}: Tier 2 stack comparison with ${staticBaseline.conditionId} not assessed because fallback/low-confidence criteria were observed`)
      } else if (ph.stackAlignmentRate < staticBaseline.stackAlignmentRate) {
        reasons.push(`${fixtureId}: Tier 2 stack alignment lower than ${staticBaseline.conditionId}`)
      }
    }
  }

  if (anyFailure) return { policy, verdict: "FAIL", reasons }
  if (anyInconclusive) return { policy, verdict: "INCONCLUSIVE", reasons }
  return { policy, verdict: "PASS", reasons }
}

export function summarizeComparable(runs) {
  const total = runs.length
  const conditionId = runs[0]?.conditionId ?? "unknown"
  const compileBuildRate = passRate(runs, "compileBuildPass")
  const gradleTestRate = passRate(runs, "gradleTestPass")
  const runtimeSmokeValues = runs.map((run) => run.metrics.runtimeSmokePass).filter((value) => value !== null)
  const runtimeSmokeRate =
    runtimeSmokeValues.length === 0 ? null : runtimeSmokeValues.filter((value) => value === true).length / runtimeSmokeValues.length
  const stackAlignmentRate = total === 0 ? 0 : runs.reduce((sum, run) => sum + stackAlignmentRateForRun(run), 0) / total
  const stackAlignmentPrecise = runs.every((run) => run.metrics.stackAlignmentPrecise !== false)
  return {
    conditionId,
    total,
    compileBuildRate,
    gradleTestRate,
    runtimeSmokeRate,
    stackAlignmentRate,
    stackAlignmentPrecise,
    workflowFinishRate: total === 0 ? 0 : runs.filter((run) => run.metrics.workflowFinishOutcome === "PASS").length / total,
    externalFailureModeTotal: runs.reduce((sum, run) => sum + run.metrics.externalFailureModeCount, 0),
  }
}

function compareComparableSummaries(left, right) {
  return left.conditionId.localeCompare(right.conditionId)
}

function stackAlignmentRateForRun(run) {
  if (typeof run.metrics.stackAlignmentRate === "number") return run.metrics.stackAlignmentRate
  return run.metrics.stackAlignmentScore === 2 ? 1 : run.metrics.stackAlignmentScore === 1 ? 0.5 : 0
}

function passRate(runs, key) {
  if (runs.length === 0) return null
  if (runs.some((run) => run.metrics[key] === null || run.metrics[key] === undefined)) return null
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

function capturedDecisionPolicy(replayRoot) {
  const resultsPath = join(replayRoot, "results.json")
  if (!existsSync(resultsPath)) return null
  try {
    const results = JSON.parse(readFileSync(resultsPath, "utf8"))
    return typeof results.decisionPolicy === "string" ? results.decisionPolicy : null
  } catch (error) {
    if (error instanceof Error) return null
    throw error
  }
}

export async function runEval(options) {
  if (options.replayDir) {
    return replayEval(options)
  }
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
  const runs = await runWithConcurrency(plan.runs, options.concurrency, (runPlan) =>
    executeRun(options, outputDir, runPlan, environment, gitCommit),
  )

  const results = {
    schemaVersion: "persona-onoff-eval.1",
    decisionPolicy: DECISION_POLICIES.externalPrimary,
    createdAt: new Date().toISOString(),
    gitCommit,
    installSource: options.installSource,
    model: {
      id: options.model,
      version: options.modelVersion === "unknown" ? null : options.modelVersion,
      versionReason: options.modelVersion === "unknown" ? options.modelVersionReason : null,
      temperature: options.temperature === "unknown" ? null : options.temperature,
      temperatureReason: options.temperature === "unknown" ? "OPENCODE_TEMPERATURE is not set or unsupported by the selected CLI surface" : null,
      topP: options.topP === "unknown" ? null : options.topP,
      topPReason: options.topP === "unknown" ? options.topPReason : null,
      seed: options.seed === "unknown" ? null : options.seed,
      seedReason: options.seed === "unknown" ? options.seedReason : null,
    },
    timeoutMs: options.timeoutMs,
    environment,
    options: {
      fixture: options.fixture,
      condition: options.condition,
      runs: options.runs,
      concurrency: options.concurrency,
    },
    fixtureMetadata: plan.fixtureMetadata,
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
  const rawDir = join(outputDir, RAW_ROOT, runPlan.fixtureId, runPlan.conditionId, `r${runPlan.repetition}`)
  const workspaceDir = options.capture ? join(rawDir, "workspace") : join(outputDir, "workspaces", runId)
  mkdirSync(workspaceDir, { recursive: true })
  await writeFile(join(workspaceDir, "README.md"), fixtureText)

  const baselineFile = await prepareConditionFiles(workspaceDir, runPlan.conditionId)
  const prompt = buildPrompt(fixtureText, runPlan.conditionId)
  const promptFile = join(workspaceDir, "prompt.txt")
  await writeFile(promptFile, prompt)

  const logsDir = options.capture ? join(rawDir, "raw") : join(outputDir, "logs", runId)
  mkdirSync(logsDir, { recursive: true })

  const commands = []
  if (runPlan.conditionId === "ph-on") {
    commands.push(["ph-install", options.phInstallCommand])
    commands.push(["ph-init", options.phInitCommand])
  }
  commands.push([
    "opencode",
    formatCommand(options.opencodeCommand, {
      model: options.model,
      prompt,
      promptFile,
      workspaceDir,
      message: "README.md 보고 구현해줘",
      temperature: options.temperature,
      topP: options.topP,
      seed: options.seed,
    }),
  ])

  const commandResults = {}
  const rawOutputPaths = {}
  let providerFailed = false
  for (const [name, command] of commands) {
    const execution = await runShellAsync(command, workspaceDir, options.timeoutMs, {
      cleanupProcessGroup: name === "opencode",
    })
    commandResults[name] = execution
    writeCommandLog(join(logsDir, `${name}.log`), execution)
    rawOutputPaths[name] = writeRawExecutionFiles(logsDir, name, execution)
    if (name === "opencode" && execution.status !== 0) providerFailed = true
  }

  const testExecution = await runShellAsync(gradleCommand(workspaceDir, "test"), workspaceDir, options.timeoutMs)
  writeCommandLog(join(logsDir, "gradle-test.log"), testExecution)
  rawOutputPaths["gradle-test"] = writeRawExecutionFiles(logsDir, "gradle-test", testExecution)
  const buildExecution = await runShellAsync(gradleCommand(workspaceDir, "build"), workspaceDir, options.timeoutMs)
  writeCommandLog(join(logsDir, "gradle-build.log"), buildExecution)
  rawOutputPaths["gradle-build"] = writeRawExecutionFiles(logsDir, "gradle-build", buildExecution)

  const runtimeExecution = options.runtimeSmokeCommand
    ? await runShellAsync(options.runtimeSmokeCommand, workspaceDir, options.timeoutMs, { cleanupProcessGroup: true })
    : null
  if (runtimeExecution) {
    writeCommandLog(join(logsDir, "runtime-smoke.log"), runtimeExecution)
    rawOutputPaths["runtime-smoke"] = writeRawExecutionFiles(logsDir, "runtime-smoke", runtimeExecution)
  }

  const workflowFinishExecution =
    runPlan.conditionId === "ph-on" ? await runShellAsync(options.workflowFinishCommand, workspaceDir, options.timeoutMs) : null
  if (workflowFinishExecution) {
    writeCommandLog(join(logsDir, "workflow-finish.log"), workflowFinishExecution)
    rawOutputPaths["workflow-finish"] = writeRawExecutionFiles(logsDir, "workflow-finish", workflowFinishExecution)
  }

  const backendShapeExecution = options.backendShapeCommand
    ? await runShellAsync(options.backendShapeCommand, workspaceDir, options.timeoutMs)
    : null
  if (backendShapeExecution) {
    writeCommandLog(join(logsDir, "backend-shape.log"), backendShapeExecution)
    rawOutputPaths["backend-shape"] = writeRawExecutionFiles(logsDir, "backend-shape", backendShapeExecution)
  }

  const stackAlignment = detectStackAlignment(workspaceDir)
  const workspacePurity = scanWorkspacePurity(workspaceDir, runPlan.conditionId)
  const compileBuild = measureCompileResult(workspaceDir, buildExecution)
  const gradleTest = measureGradleTestResult(workspaceDir, testExecution)
  const compileBuildOutcome = compileBuild.outcome
  const gradleTestOutcome = gradleTest.outcome
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
    stackAlignmentRate: stackAlignment.rate,
    workflowFinishOutcome,
    providerFailed,
  })

  return {
    runId,
    fixtureId: runPlan.fixtureId,
    fixtureMetadata: fixtureMetadataFor(runPlan.fixtureId),
    conditionId: runPlan.conditionId,
    repetition: runPlan.repetition,
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    workspaceDir,
    logsDir,
    fixtureHash: sha256Text(fixtureText),
    baselineFile,
    workspacePurity,
    gitCommit,
    metadata: {
      model: options.model,
      modelVersion: options.modelVersion === "unknown" ? null : options.modelVersion,
      modelVersionReason: options.modelVersion === "unknown" ? options.modelVersionReason : null,
      temperature: options.temperature === "unknown" ? null : options.temperature,
      temperatureReason:
        options.temperature === "unknown" ? "OPENCODE_TEMPERATURE is not set or unsupported by the selected CLI surface" : null,
      topP: options.topP === "unknown" ? null : options.topP,
      topPReason: options.topP === "unknown" ? options.topPReason : null,
      seed: options.seed === "unknown" ? null : options.seed,
      seedReason: options.seed === "unknown" ? options.seedReason : null,
      timeoutMs: options.timeoutMs,
      environment,
      rawOutputPaths,
    },
    outcomes: {
      compileBuildOutcome,
      gradleTestOutcome,
      runtimeSmokeOutcome,
      workflowFinishOutcome,
      compileBuild,
      gradleTest,
    },
    metrics: {
      compileBuildPass: outcomePassValue(compileBuildOutcome),
      gradleTestPass: outcomePassValue(gradleTestOutcome),
      runtimeSmokePass: runtimeSmokeOutcome === "NOT RUN" ? null : runtimeSmokeOutcome === "PASS",
      stackAlignmentScore: stackAlignment.score,
      stackAlignmentRate: stackAlignment.rate,
      stackAlignmentCriteria: stackAlignment.criteria,
      stackAlignmentCriterionDetails: stackAlignment.criterionDetails,
      stackAlignmentPrecise: stackAlignment.stackAlignmentPrecise,
      stackAlignmentRationale: stackAlignment.rationale,
      externalFailureModeCount: failures.count,
      externalFailureModeLabels: failures.labels,
      workflowFinishOutcome,
      backendShapeWarnCount,
    },
  }
}

export async function runWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length)
  let nextIndex = 0
  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await worker(items[index], index)
    }
  }
  const workerCount = Math.min(concurrency, items.length)
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()))
  return results
}

async function replayEval(options) {
  const replayRoot = resolve(options.projectDir, options.replayDir)
  const rawRoot = join(replayRoot, RAW_ROOT)
  if (!existsSync(rawRoot)) {
    return {
      ok: false,
      preflight: { ok: false, errors: [`capture raw directory not found: ${rawRoot}`] },
      resultsPath: null,
      results: null,
    }
  }
  const environment = collectEnvironment(options)
  const gitCommit = getGitCommit(options.projectDir)
  const runs = []
  for (const fixtureId of readdirSync(rawRoot)) {
    const fixtureDir = join(rawRoot, fixtureId)
    if (!statSync(fixtureDir).isDirectory()) continue
    for (const conditionId of readdirSync(fixtureDir)) {
      const conditionDir = join(fixtureDir, conditionId)
      if (!statSync(conditionDir).isDirectory()) continue
      for (const repetitionDirName of readdirSync(conditionDir)) {
        const replayRunDir = join(conditionDir, repetitionDirName)
        if (!statSync(replayRunDir).isDirectory()) continue
        const workspaceDir = join(replayRunDir, "workspace")
        if (!existsSync(workspaceDir)) {
          return {
            ok: false,
            preflight: { ok: false, errors: [`capture workspace not found: ${workspaceDir}`] },
            resultsPath: null,
            results: null,
          }
        }
        const repetition = Number.parseInt(repetitionDirName.replace(/^r/, ""), 10)
        runs.push(await scoreCapturedRun(options, replayRunDir, workspaceDir, fixtureId, conditionId, repetition, environment, gitCommit))
      }
    }
  }
  if (runs.length === 0) {
    return {
      ok: false,
      preflight: { ok: false, errors: [`no captured runs found under ${rawRoot}`] },
      resultsPath: null,
      results: null,
    }
  }
  const timestamp = new Date().toISOString().replaceAll(":", "").replaceAll(".", "")
  const outputDir = resolve(options.projectDir, options.outputRoot, timestamp)
  mkdirSync(outputDir, { recursive: true })
  const results = {
    schemaVersion: "persona-onoff-eval.1",
    decisionPolicy: capturedDecisionPolicy(replayRoot),
    replayOf: replayRoot,
    createdAt: new Date().toISOString(),
    gitCommit,
    installSource: "replay",
    model: { id: "replay", version: null, versionReason: "replay does not call a model" },
    timeoutMs: options.timeoutMs,
    environment,
    options: { replay: replayRoot },
    fixtureMetadata: fixtureMetadataForIds([...new Set(runs.map((run) => run.fixtureId))]),
    runs,
    aggregate: aggregateRuns(runs),
  }
  const resultsPath = join(outputDir, "results.json")
  writeFileSync(resultsPath, `${JSON.stringify(results, null, 2)}\n`)
  return { ok: true, preflight: { ok: true, errors: [] }, resultsPath, results }
}

async function scoreCapturedRun(options, replayRunDir, workspaceDir, fixtureId, conditionId, repetition, environment, gitCommit) {
  const logsDir = join(replayRunDir, "raw")
  const testExecution = runShell(gradleCommand(workspaceDir, "test"), workspaceDir, options.timeoutMs)
  writeCommandLog(join(logsDir, "replay-gradle-test.log"), testExecution)
  writeRawExecutionFiles(logsDir, "replay-gradle-test", testExecution)
  const buildExecution = runShell(gradleCommand(workspaceDir, "build"), workspaceDir, options.timeoutMs)
  writeCommandLog(join(logsDir, "replay-gradle-build.log"), buildExecution)
  writeRawExecutionFiles(logsDir, "replay-gradle-build", buildExecution)
  const stackAlignment = detectStackAlignment(workspaceDir)
  const workspacePurity = scanWorkspacePurity(workspaceDir, conditionId)
  const compileBuild = measureCompileResult(workspaceDir, buildExecution)
  const gradleTest = measureGradleTestResult(workspaceDir, testExecution)
  const runtimeSmokeOutcome = parseCapturedCommandOutcome(join(logsDir, "runtime-smoke.log"))
  const providerOutcome = parseCapturedCommandOutcome(join(logsDir, "opencode.log"))
  const providerFailed = providerOutcome === "FAIL"
  const capturedWorkflowFinishOutcome = parseCapturedCommandOutcome(join(logsDir, "workflow-finish.log"))
  const workflowFinishOutcome =
    capturedWorkflowFinishOutcome === "NOT RUN" ? "NOT APPLICABLE" : capturedWorkflowFinishOutcome
  const failures = countFailureModes({
    compileBuildOutcome: compileBuild.outcome,
    gradleTestOutcome: gradleTest.outcome,
    runtimeSmokeOutcome,
    stackAlignmentRate: stackAlignment.rate,
    workflowFinishOutcome,
    providerFailed,
  })
  return {
    runId: `${environment.platform}-${fixtureId}-${conditionId}-r${repetition}`.toLowerCase(),
    fixtureId,
    fixtureMetadata: fixtureMetadataFor(fixtureId),
    conditionId,
    repetition,
    replaySource: replayRunDir,
    workspaceDir,
    logsDir,
    fixtureHash: existsSync(join(workspaceDir, "README.md")) ? sha256File(join(workspaceDir, "README.md")) : "unknown",
    workspacePurity,
    gitCommit,
    metadata: { timeoutMs: options.timeoutMs, environment },
    outcomes: {
      compileBuildOutcome: compileBuild.outcome,
      gradleTestOutcome: gradleTest.outcome,
      runtimeSmokeOutcome,
      workflowFinishOutcome,
      compileBuild,
      gradleTest,
    },
    metrics: {
      compileBuildPass: outcomePassValue(compileBuild.outcome),
      gradleTestPass: outcomePassValue(gradleTest.outcome),
      runtimeSmokePass: runtimeSmokeOutcome === "NOT RUN" ? null : runtimeSmokeOutcome === "PASS",
      stackAlignmentScore: stackAlignment.score,
      stackAlignmentRate: stackAlignment.rate,
      stackAlignmentCriteria: stackAlignment.criteria,
      stackAlignmentCriterionDetails: stackAlignment.criterionDetails,
      stackAlignmentPrecise: stackAlignment.stackAlignmentPrecise,
      stackAlignmentRationale: stackAlignment.rationale,
      externalFailureModeCount: failures.count,
      externalFailureModeLabels: failures.labels,
      workflowFinishOutcome,
      backendShapeWarnCount: null,
    },
  }
}

function outcomePassValue(outcome) {
  if (outcome === "PASS") return true
  if (outcome === "UNKNOWN") return null
  return false
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

function writeRawExecutionFiles(logsDir, name, execution) {
  const stdoutPath = join(logsDir, `${name}.stdout.txt`)
  const stderrPath = join(logsDir, `${name}.stderr.txt`)
  writeFileSync(stdoutPath, execution.stdout)
  writeFileSync(stderrPath, execution.stderr)
  return { stdoutPath, stderrPath }
}

function collectEnvironment(options) {
  return {
    platform: process.platform,
    os: {
      type: type(),
      platform: platform(),
      release: release(),
      arch: arch(),
    },
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
