import { spawnSync } from "node:child_process"
import {
  closeSync,
  constants,
  copyFileSync,
  lstatSync,
  mkdirSync,
  openSync,
  realpathSync,
  writeSync,
} from "node:fs"
import { basename, isAbsolute, join } from "node:path"

import { assessObserverGhTool } from "./consumer-authority-observer-gh-tool.mjs"

const DPKG_QUERY = "/usr/bin/dpkg-query"
const OUTPUT_DIRECTORY = "persona-harness-observer-gh"
const OUTPUT_NAME = "gh"
const DOCUMENTED_ANCILLARY_GH_RECORDS = new Set([
  "/usr/share/bash-completion/completions/gh",
])
const SELECTOR_STAGES = Object.freeze([
  "environment",
  "package-list",
  "package-record",
  "source-assessment",
  "private-reservation",
  "private-copy",
  "private-assessment",
  "output-handoff",
])

export const OBSERVER_GH_WORKFLOW_SELECTOR_STAGES = SELECTOR_STAGES

export class WorkflowObserverGhToolError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function provisionWorkflowObserverGhTool(options = {}) {
  try {
    return provision(options)
  } catch {
    return blocked("observer-gh-workflow-tool-invalid", "selector-internal")
  }
}

function provision(options) {
  const settings = isRecord(options) ? options : {}
  const environment = isRecord(settings.environment) ? settings.environment : process.env
  const runnerTemp = resolveRegularDirectory(environment.RUNNER_TEMP)
  const githubOutput = requiredAbsolutePath(environment.GITHUB_OUTPUT)
  if (runnerTemp === undefined || githubOutput === undefined) {
    return blocked("observer-gh-workflow-tool-invalid", "environment")
  }

  const listPackageFiles = typeof settings.listPackageFiles === "function"
    ? settings.listPackageFiles
    : listInstalledGhPackageFiles
  let packageFiles
  try {
    packageFiles = listPackageFiles()
  } catch {
    return blocked("observer-gh-workflow-tool-unavailable", "package-list")
  }

  let candidate
  try {
    candidate = selectRegularPackageGhCandidate(packageFiles)
  } catch {
    return blocked("observer-gh-workflow-tool-invalid", "package-record")
  }
  if (candidate === undefined) return blocked("observer-gh-workflow-tool-unavailable", "package-record")

  let source
  try {
    source = assessObserverGhTool(candidate)
  } catch {
    return blocked("observer-gh-workflow-tool-invalid", "source-assessment")
  }
  if (source.state !== "ready") return blocked(mapToolCode(source.code), "source-assessment")

  const outputDirectory = join(runnerTemp, OUTPUT_DIRECTORY)
  try {
    mkdirSync(outputDirectory, { mode: 0o700 })
    if (!isRegularDirectory(outputDirectory)) throw new WorkflowObserverGhToolError("observer-gh-workflow-tool-invalid")
  } catch {
    return blocked("observer-gh-workflow-tool-invalid", "private-reservation")
  }

  const output = join(outputDirectory, OUTPUT_NAME)
  const copyFile = typeof settings.copyFile === "function" ? settings.copyFile : copyFileSync
  try {
    if (pathExists(output)) throw new WorkflowObserverGhToolError("observer-gh-workflow-tool-invalid")
    copyFile(candidate, output, constants.COPYFILE_EXCL)
  } catch {
    return blocked("observer-gh-workflow-tool-invalid", "private-copy")
  }

  let tool
  try {
    tool = assessObserverGhTool(output)
  } catch {
    return blocked("observer-gh-workflow-tool-invalid", "private-assessment")
  }
  if (tool.state !== "ready") return blocked(mapToolCode(tool.code), "private-assessment")

  if (!appendGithubOutput(githubOutput, `path=${output}\n`)) {
    return blocked("observer-gh-workflow-tool-invalid", "output-handoff")
  }
  return { code: "observer-gh-workflow-ready", selectorStage: "output-handoff", state: "ready" }
}

function listInstalledGhPackageFiles() {
  let result
  try {
    result = spawnSync(DPKG_QUERY, ["--listfiles", "gh"], {
      encoding: "utf8",
      env: { LANG: "C", LC_ALL: "C" },
      maxBuffer: 16 * 1024,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 5_000,
    })
  } catch {
    throw new WorkflowObserverGhToolError("observer-gh-workflow-tool-unavailable")
  }
  if (result.error !== undefined || result.status !== 0 || typeof result.stdout !== "string") {
    throw new WorkflowObserverGhToolError("observer-gh-workflow-tool-unavailable")
  }
  return result.stdout.split("\n").filter((value) => value.length > 0)
}

export function selectRegularPackageGhCandidate(paths, options = {}) {
  if (!Array.isArray(paths) || !paths.every((path) => typeof path === "string")) {
    throw new WorkflowObserverGhToolError("observer-gh-workflow-tool-invalid")
  }
  const lstat = isRecord(options) && typeof options.lstat === "function" ? options.lstat : lstatSync
  const candidates = []
  let matchingRecordCount = 0
  let missingMatchingRecord = false
  for (const path of paths) {
    if (!isPackageRecordPath(path)) throw new WorkflowObserverGhToolError("observer-gh-workflow-tool-invalid")
    if (basename(path) !== "gh") continue
    matchingRecordCount += 1
    let stat
    try {
      stat = lstat(path)
    } catch (error) {
      if (isMissingPathError(error)) {
        missingMatchingRecord = true
        continue
      }
      throw new WorkflowObserverGhToolError("observer-gh-workflow-tool-invalid")
    }
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new WorkflowObserverGhToolError("observer-gh-workflow-tool-invalid")
    }
    if ((stat.mode & 0o111) !== 0) {
      candidates.push(path)
    } else if (!DOCUMENTED_ANCILLARY_GH_RECORDS.has(path)) {
      throw new WorkflowObserverGhToolError("observer-gh-workflow-tool-invalid")
    }
  }
  if (matchingRecordCount === 0 || candidates.length === 0) return undefined
  if (missingMatchingRecord || candidates.length !== 1) {
    throw new WorkflowObserverGhToolError("observer-gh-workflow-tool-invalid")
  }
  return candidates[0]
}

function resolveRegularDirectory(value) {
  const path = requiredAbsolutePath(value)
  if (path === undefined) return undefined
  try {
    const resolved = realpathSync(path)
    return isRegularDirectory(resolved) ? resolved : undefined
  } catch {
    return undefined
  }
}

function requiredAbsolutePath(value) {
  if (typeof value !== "string" || !isAbsolute(value) || value.includes("\0") || value.length > 4_096) return undefined
  return value
}

function isRegularDirectory(path) {
  const stat = lstatSync(path)
  return stat.isDirectory() && !stat.isSymbolicLink()
}

function pathExists(path) {
  try {
    lstatSync(path)
    return true
  } catch (error) {
    if (isMissingPathError(error)) return false
    throw error
  }
}

function appendGithubOutput(path, content) {
  try {
    const stat = lstatSync(path)
    if (!stat.isFile() || stat.isSymbolicLink()) return false
    const descriptor = openSync(path, constants.O_WRONLY | constants.O_APPEND | constants.O_NOFOLLOW)
    try {
      writeSync(descriptor, content, undefined, "utf8")
    } finally {
      closeSync(descriptor)
    }
    return true
  } catch {
    return false
  }
}

function isPackageRecordPath(path) {
  return isAbsolute(path) && !path.includes("\0") && path.length <= 4_096
}

function isMissingPathError(error) {
  return isRecord(error) && error.code === "ENOENT"
}

function mapToolCode(code) {
  switch (code) {
    case "gh-command-tool-invalid":
      return "observer-gh-workflow-tool-invalid"
    case "gh-command-tool-required":
    case "gh-command-unavailable":
      return "observer-gh-workflow-tool-unavailable"
    case "gh-command-version-unsupported":
      return "observer-gh-workflow-tool-version-unsupported"
    default:
      return "observer-gh-workflow-tool-invalid"
  }
}

function blocked(code, selectorStage) {
  return { code, selectorStage, state: "blocked" }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}
