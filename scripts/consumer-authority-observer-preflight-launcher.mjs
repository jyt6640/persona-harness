import { chmodSync, mkdtempSync, rmSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import {
  isObserverPreflightResult,
  observerPreflightWorkerEnvironment,
} from "./consumer-authority-observer-preflight-core.mjs"

const GH_TIMEOUT_MS = 5_000
const MAX_GH_OUTPUT_BYTES = 8 * 1024
const MAX_WORKER_OUTPUT_BYTES = 64 * 1024
const WORKER_TIMEOUT_MS = 20_000
const WORKER_PATH = fileURLToPath(new URL("./consumer-authority-observer-preflight-worker.mjs", import.meta.url))

export function runObserverCredentialPreflight(options = {}) {
  const environment = options.environment ?? process.env
  const execute = options.execute ?? runCommand
  const createHome = options.createHome ?? createIsolatedHome
  const removeHome = options.removeHome ?? removeIsolatedHome
  let host
  try {
    host = hostGhEnvironment(environment)
  } catch {
    return blocked("host-gh-auth-unavailable", "host-github-authentication")
  }
  if (host === undefined) return blocked("host-gh-auth-unavailable", "host-github-authentication")

  let tokenResult
  try {
    tokenResult = execute("gh", ["auth", "token", "--hostname", "github.com"], {
      env: host,
      maxBuffer: MAX_GH_OUTPUT_BYTES,
      timeout: GH_TIMEOUT_MS,
    })
  } catch {
    return blocked("host-gh-auth-unavailable", "host-github-authentication")
  }
  const token = readToken(tokenResult)
  if (token === undefined) return blocked("host-gh-auth-unavailable", "host-github-authentication")

  let home
  try {
    home = createHome()
  } catch {
    return blocked("observer-home-unavailable", "github-actions-read-preflight")
  }
  let outcome
  try {
    const result = execute(process.execPath, [WORKER_PATH], {
      env: observerPreflightWorkerEnvironment(token, home),
      maxBuffer: MAX_WORKER_OUTPUT_BYTES,
      timeout: WORKER_TIMEOUT_MS,
    })
    outcome = readWorkerResult(result) ?? blocked("github-actions-read-unusable", "github-actions-read-preflight")
  } catch {
    outcome = blocked("github-actions-read-unusable", "github-actions-read-preflight")
  }
  try {
    removeHome(home)
  } catch {
    return blocked("observer-home-cleanup-unavailable", "github-actions-read-preflight")
  }
  return outcome
}

function hostGhEnvironment(environment) {
  const home = environment.HOME
  const path = environment.PATH
  if (!isAbsolutePath(home) || !isSafePathValue(path)) return undefined
  const result = { HOME: home, LANG: "C", LC_ALL: "C", PATH: path }
  for (const name of ["XDG_CONFIG_HOME", "XDG_DATA_HOME", "XDG_STATE_HOME", "APPDATA", "LOCALAPPDATA", "USERPROFILE"]) {
    const value = environment[name]
    if (isSafePathValue(value)) result[name] = value
  }
  return result
}

function runCommand(command, args, options) {
  return spawnSync(command, args, {
    encoding: "utf8",
    env: options.env,
    maxBuffer: options.maxBuffer,
    shell: false,
    stdio: ["ignore", "pipe", "ignore"],
    timeout: options.timeout,
  })
}

function readToken(result) {
  if (result?.error !== undefined || result?.status !== 0 || typeof result?.stdout !== "string") return undefined
  const token = result.stdout.trim()
  return /^[A-Za-z0-9._-]{1,4096}$/u.test(token) ? token : undefined
}

function readWorkerResult(result) {
  if (result?.error !== undefined || typeof result?.stdout !== "string") return undefined
  try {
    const output = JSON.parse(result.stdout)
    return isObserverPreflightResult(output) && result.status === (output.state === "ready" ? 0 : 1)
      ? output
      : undefined
  } catch {
    return undefined
  }
}

function createIsolatedHome() {
  const home = mkdtempSync(join(tmpdir(), "persona-authority-observer-"))
  chmodSync(home, 0o700)
  return home
}

function removeIsolatedHome(home) {
  rmSync(home, { force: true, recursive: true })
}

function blocked(code, next) {
  return {
    authorityEligible: false,
    code,
    consumerHome: "isolated",
    credential: "unusable",
    fixtureAuthorization: "blocked",
    mutationPerformed: false,
    next,
    schemaVersion: "consumer-authority-observer-preflight.1",
    state: "blocked",
  }
}

function isAbsolutePath(value) {
  return typeof value === "string" && value.startsWith("/") && isSafePathValue(value)
}

function isSafePathValue(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 4_096 && !value.includes("\u0000")
}
