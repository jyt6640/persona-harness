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
import { isAbsolute, join } from "node:path"

import { assessObserverGhTool } from "./consumer-authority-observer-gh-tool.mjs"
import {
  ObserverGhPackageOwnershipError,
  ObserverGhPackageRecordError,
  readInstalledGhPackageRecord,
  selectInstalledObserverGhCandidate,
} from "./consumer-authority-observer-gh-package-record.mjs"

const OUTPUT_DIRECTORY = "persona-harness-observer-gh"
const OUTPUT_NAME = "gh"
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

  let selection
  try {
    selection = selectWorkflowPackageCandidate(settings)
  } catch (error) {
    if (error instanceof ObserverGhPackageOwnershipError) {
      return blocked("observer-gh-workflow-tool-unavailable", "package-list")
    }
    if (error instanceof ObserverGhPackageRecordError) {
      return blocked("observer-gh-workflow-tool-invalid", "package-record", error.shape)
    }
    return blocked("observer-gh-workflow-tool-invalid", "package-record")
  }
  if (selection === undefined) return blocked("observer-gh-workflow-tool-unavailable", "package-record", "primary-missing")
  const { candidate, packageRecordShape } = selection

  const assessTool = typeof settings.assessTool === "function" ? settings.assessTool : assessObserverGhTool
  let source
  try {
    source = assessTool(candidate)
  } catch {
    return blocked("observer-gh-workflow-tool-invalid", "source-assessment", packageRecordShape)
  }
  if (source.state !== "ready") return blocked(mapToolCode(source.code), "source-assessment", packageRecordShape)

  const outputDirectory = join(runnerTemp, OUTPUT_DIRECTORY)
  try {
    mkdirSync(outputDirectory, { mode: 0o700 })
    if (!isRegularDirectory(outputDirectory)) throw new WorkflowObserverGhToolError("observer-gh-workflow-tool-invalid")
  } catch {
    return blocked("observer-gh-workflow-tool-invalid", "private-reservation", packageRecordShape)
  }

  const output = join(outputDirectory, OUTPUT_NAME)
  const copyFile = typeof settings.copyFile === "function" ? settings.copyFile : copyFileSync
  try {
    if (pathExists(output)) throw new WorkflowObserverGhToolError("observer-gh-workflow-tool-invalid")
    copyFile(candidate, output, constants.COPYFILE_EXCL)
  } catch {
    return blocked("observer-gh-workflow-tool-invalid", "private-copy", packageRecordShape)
  }

  let tool
  try {
    tool = assessTool(output)
  } catch {
    return blocked("observer-gh-workflow-tool-invalid", "private-assessment", packageRecordShape)
  }
  if (tool.state !== "ready") return blocked(mapToolCode(tool.code), "private-assessment", packageRecordShape)

  if (!appendGithubOutput(githubOutput, `path=${output}\n`)) {
    return blocked("observer-gh-workflow-tool-invalid", "output-handoff", packageRecordShape)
  }
  return {
    code: "observer-gh-workflow-ready",
    packageRecordShape,
    selectorStage: "output-handoff",
    state: "ready",
  }
}

function selectWorkflowPackageCandidate(settings) {
  const records = typeof settings.readPackageRecord === "function"
    ? settings.readPackageRecord()
    : readInstalledGhPackageRecord()
  const lstat = typeof settings.lstatPackageRecord === "function"
    ? settings.lstatPackageRecord
    : undefined
  return selectInstalledObserverGhCandidate(records, { lstat })
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

function blocked(code, selectorStage, packageRecordShape) {
  return packageRecordShape === undefined
    ? { code, selectorStage, state: "blocked" }
    : { code, packageRecordShape, selectorStage, state: "blocked" }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}
