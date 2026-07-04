import { spawnSync } from "node:child_process"
import process from "node:process"

import { signalExitCode } from "./bearshell-exit-code.js"

export type BoundedProcessResult = {
  readonly killed: boolean
  readonly signal: NodeJS.Signals | null
  readonly status: number
  readonly stderr: string
  readonly stdout: string
  readonly timedOut: boolean
}

export type BoundedProcessOptions = {
  readonly args: readonly string[]
  readonly command: string
  readonly cwd?: string
  readonly env?: Readonly<Record<string, string | undefined>>
  readonly graceMs: number
  readonly timeoutMs: number
}

const SUPERVISOR_SOURCE = `
const { spawn } = require("node:child_process")
function parseInput(text) {
  const value = JSON.parse(text)
  if (typeof value !== "object" || value === null) throw new Error("input must be an object")
  if (typeof value.command !== "string" || value.command.length === 0) throw new Error("command is required")
  if (!Array.isArray(value.args) || !value.args.every((arg) => typeof arg === "string")) throw new Error("args must be strings")
  return value
}
function killChild(pid, signal) {
  if (pid === undefined) return
  try {
    if (process.platform === "win32") process.kill(pid, signal)
    else process.kill(-pid, signal)
  } catch {
    try { process.kill(pid, signal) } catch {}
  }
}
function run(input) {
  return new Promise((resolve) => {
    let stdout = ""
    let stderr = ""
    let timedOut = false
    let killed = false
    let settled = false
    let graceTimer
    const child = spawn(input.command, [...input.args], {
      cwd: input.cwd,
      detached: process.platform !== "win32",
      env: { ...process.env, ...input.env },
      stdio: ["ignore", "pipe", "pipe"],
    })
    const timeoutTimer = setTimeout(() => {
      timedOut = true
      killChild(child.pid, "SIGTERM")
      graceTimer = setTimeout(() => {
        if (settled) return
        killed = true
        killChild(child.pid, "SIGKILL")
      }, input.graceMs)
    }, input.timeoutMs)
    child.stdout.setEncoding("utf8")
    child.stderr.setEncoding("utf8")
    child.stdout.on("data", (chunk) => { stdout += chunk })
    child.stderr.on("data", (chunk) => { stderr += chunk })
    child.on("error", (error) => { stderr += error.message + "\\n" })
    child.on("close", (status, signal) => {
      settled = true
      clearTimeout(timeoutTimer)
      if (graceTimer !== undefined) clearTimeout(graceTimer)
      resolve({ killed, signal, status, stderr, stdout, timedOut })
    })
  })
}
run(parseInput(process.argv[1]))
  .then((result) => { process.stdout.write(JSON.stringify(result)) })
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    process.stdout.write(JSON.stringify({ killed: false, signal: null, status: 1, stderr: message + "\\n", stdout: "", timedOut: false }))
    process.exitCode = 1
  })
`

export function runBoundedProcess(options: BoundedProcessOptions): BoundedProcessResult {
  const input = JSON.stringify(options)
  const spawned = spawnSync(process.execPath, ["-e", SUPERVISOR_SOURCE, input], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  })
  const supervisorStdout = typeof spawned.stdout === "string" ? spawned.stdout : ""
  const supervisorStderr = typeof spawned.stderr === "string" ? spawned.stderr : ""
  if (spawned.error !== undefined) {
    return {
      killed: false,
      signal: spawned.signal,
      status: 1,
      stderr: `${spawned.error.message}\n${supervisorStderr}`,
      stdout: "",
      timedOut: false,
    }
  }
  try {
    const parsed: unknown = JSON.parse(supervisorStdout)
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("supervisor result was not an object")
    }
    const record = parsed as Record<string, unknown>
    const signal = typeof record.signal === "string" ? (record.signal as NodeJS.Signals) : null
    const rawStatus = typeof record.status === "number" ? record.status : signalExitCode(signal)
    return {
      killed: record.killed === true,
      signal,
      status: rawStatus,
      stderr: typeof record.stderr === "string" ? record.stderr : "",
      stdout: typeof record.stdout === "string" ? record.stdout : "",
      timedOut: record.timedOut === true,
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      killed: false,
      signal: spawned.signal,
      status: spawned.status ?? signalExitCode(spawned.signal),
      stderr: `Failed to parse bounded process supervisor output: ${message}\n${supervisorStdout}${supervisorStderr}`,
      stdout: "",
      timedOut: false,
    }
  }
}
