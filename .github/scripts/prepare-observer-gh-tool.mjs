#!/usr/bin/env node
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
import { pathToFileURL } from "node:url"

import { assessObserverGhTool } from "../../scripts/consumer-authority-observer-gh-tool.mjs"

const DPKG_QUERY = "/usr/bin/dpkg-query"
const OUTPUT_DIRECTORY = "persona-harness-observer-gh"
const OUTPUT_NAME = "gh"

export function provisionWorkflowObserverGhTool(options = {}) {
  const environment = options.environment ?? process.env
  const runnerTemp = requiredAbsoluteDirectory(environment.RUNNER_TEMP)
  const githubOutput = requiredAbsolutePath(environment.GITHUB_OUTPUT)
  const listPackageFiles = typeof options.listPackageFiles === "function"
    ? options.listPackageFiles
    : listInstalledGhPackageFiles
  const candidate = selectRegularPackageGhCandidate(listPackageFiles())
  const source = assessObserverGhTool(candidate)
  if (source.state !== "ready") return blocked(mapToolCode(source.code))
  const outputDirectory = join(runnerTemp, OUTPUT_DIRECTORY)
  try {
    mkdirSync(outputDirectory, { mode: 0o700 })
    assertRegularDirectory(outputDirectory)
  } catch {
    return blocked("observer-gh-workflow-tool-invalid")
  }
  const output = join(outputDirectory, OUTPUT_NAME)
  const existing = lstatOrUndefined(output)
  if (existing !== undefined) return blocked("observer-gh-workflow-tool-invalid")
  try {
    copyFileSync(candidate, output, constants.COPYFILE_EXCL)
  } catch {
    return blocked("observer-gh-workflow-tool-invalid")
  }
  const tool = assessObserverGhTool(output)
  if (tool.state !== "ready") return blocked(mapToolCode(tool.code))
  try {
    appendGithubOutput(githubOutput, `path=${output}\n`)
  } catch {
    return blocked("observer-gh-workflow-tool-invalid")
  }
  return { code: "observer-gh-workflow-ready", state: "ready" }
}

function listInstalledGhPackageFiles() {
  const result = spawnSync(DPKG_QUERY, ["--listfiles", "gh"], {
    encoding: "utf8",
    env: { LANG: "C", LC_ALL: "C" },
    maxBuffer: 16 * 1024,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 5_000,
  })
  if (result.error !== undefined || result.status !== 0 || typeof result.stdout !== "string") {
    throw new WorkflowObserverGhToolError("observer-gh-workflow-tool-unavailable")
  }
  return result.stdout.split("\n").filter((value) => value.length > 0)
}

function selectRegularPackageGhCandidate(paths) {
  if (!Array.isArray(paths) || !paths.every((path) => typeof path === "string")) {
    throw new WorkflowObserverGhToolError("observer-gh-workflow-tool-invalid")
  }
  const candidates = paths.filter((path) => isAbsolute(path) && basename(path) === "gh")
  if (candidates.length !== 1) throw new WorkflowObserverGhToolError("observer-gh-workflow-tool-invalid")
  return candidates[0]
}

function requiredAbsoluteDirectory(value) {
  const path = requiredAbsolutePath(value)
  try {
    const resolved = realpathSync(path)
    assertRegularDirectory(resolved)
    return resolved
  } catch {
    throw new WorkflowObserverGhToolError("observer-gh-workflow-tool-invalid")
  }
}

function requiredAbsolutePath(value) {
  if (typeof value !== "string" || !isAbsolute(value) || value.includes("\0") || value.length > 4_096) {
    throw new WorkflowObserverGhToolError("observer-gh-workflow-tool-invalid")
  }
  return value
}

function assertRegularDirectory(path) {
  const stat = lstatSync(path)
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new WorkflowObserverGhToolError("observer-gh-workflow-tool-invalid")
  }
}

function appendGithubOutput(path, content) {
  try {
    const stat = lstatSync(path)
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new WorkflowObserverGhToolError("observer-gh-workflow-tool-invalid")
    }
    const descriptor = openSync(path, constants.O_WRONLY | constants.O_APPEND | constants.O_NOFOLLOW)
    try {
      writeSync(descriptor, content, undefined, "utf8")
    } finally {
      closeSync(descriptor)
    }
  } catch (error) {
    if (error instanceof WorkflowObserverGhToolError) throw error
    throw new WorkflowObserverGhToolError("observer-gh-workflow-tool-invalid")
  }
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

function lstatOrUndefined(path) {
  try {
    return lstatSync(path)
  } catch {
    return undefined
  }
}

function blocked(code) {
  return { code, state: "blocked" }
}

export class WorkflowObserverGhToolError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

if (isDirectInvocation()) {
  try {
    const result = provisionWorkflowObserverGhTool()
    process.stdout.write(`${JSON.stringify(result)}\n`)
    if (result.state !== "ready") process.exitCode = 1
  } catch (error) {
    const code = error instanceof WorkflowObserverGhToolError
      ? error.code
      : "observer-gh-workflow-tool-invalid"
    process.stderr.write(`${code}\n`)
    process.exitCode = 1
  }
}

function isDirectInvocation() {
  if (process.argv[1] === undefined) return false
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
  } catch {
    return false
  }
}
