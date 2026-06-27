import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { cpSync } from "node:fs"
import { join, resolve } from "node:path"
import { spawnSync } from "node:child_process"

export function stableAnonymousId(seed, input) {
  return `run-${createHash("sha256").update(`${seed}:${input}`).digest("hex").slice(0, 10)}`
}

export function anonymizeCapture(inputDir, outputDir, seed = "persona-blind-v1") {
  const rawDir = join(inputDir, "raw")
  if (!existsSync(rawDir)) {
    throw new Error(`capture raw directory not found: ${rawDir}`)
  }
  mkdirSync(outputDir, { recursive: true })
  const reviewDir = join(outputDir, "review-package")
  const sealedDir = join(outputDir, "sealed")
  mkdirSync(reviewDir, { recursive: true })
  mkdirSync(sealedDir, { recursive: true })

  const mapping = []
  for (const fixtureId of sortedDirs(rawDir)) {
    for (const conditionId of sortedDirs(join(rawDir, fixtureId))) {
      for (const repetitionId of sortedDirs(join(rawDir, fixtureId, conditionId))) {
        const sourceDir = join(rawDir, fixtureId, conditionId, repetitionId)
        const anonymousId = stableAnonymousId(seed, `${fixtureId}/${conditionId}/${repetitionId}`)
        const targetDir = join(reviewDir, anonymousId)
        cpSync(sourceDir, targetDir, { recursive: true })
        writeFileSync(join(targetDir, "ANONYMIZED_RUN.txt"), `${anonymousId}\n`)
        mapping.push({ anonymousId, fixtureId, conditionId, repetitionId, sourceDir })
      }
    }
  }
  if (mapping.length === 0) {
    throw new Error(`no capture runs found under ${rawDir}`)
  }
  const mappingPath = join(sealedDir, "condition-mapping.json")
  const packagePath = join(reviewDir, "review-package.json")
  writeFileSync(mappingPath, `${JSON.stringify({ seed, mapping }, null, 2)}\n`)
  writeFileSync(
    packagePath,
    `${JSON.stringify(
      {
        schemaVersion: "persona-blind-review-package.1",
        runs: mapping.map((entry) => ({ anonymousId: entry.anonymousId })),
      },
      null,
      2,
    )}\n`,
  )
  return { reviewDir, mappingPath, packagePath, runCount: mapping.length }
}

export function aggregateDisagreements(scores) {
  const runs = Array.isArray(scores?.runs) ? scores.runs : []
  return {
    runCount: runs.length,
    disagreements: runs.map((run) => ({
      anonymousId: run.anonymousId,
      buildDelta: delta(run.graderA?.build, run.graderB?.build),
      testDelta: delta(run.graderA?.test, run.graderB?.test),
      runtimeDelta: delta(run.graderA?.runtime, run.graderB?.runtime),
      stackDelta: numericDelta(run.graderA?.stackAlignment, run.graderB?.stackAlignment),
      failureModeDelta: numericDelta(run.graderA?.failureModeCount, run.graderB?.failureModeCount),
    })),
  }
}

export function runLlmJudge(command, reviewPackageDir) {
  if (!command) {
    throw new Error("LLM judge command is required; refusing to create fake scores")
  }
  const result = spawnSync(command, {
    cwd: reviewPackageDir,
    encoding: "utf8",
    shell: true,
    maxBuffer: 20 * 1024 * 1024,
  })
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  }
}

function sortedDirs(parent) {
  if (!existsSync(parent)) return []
  return readdirSync(parent, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

function delta(a, b) {
  return a === b ? "same" : "different"
}

function numericDelta(a, b) {
  if (typeof a !== "number" || typeof b !== "number") return null
  return a - b
}

export function readScores(path) {
  return JSON.parse(readFileSync(resolve(path), "utf8"))
}
