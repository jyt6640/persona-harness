import { spawnSync } from "node:child_process"
import process from "node:process"

import { signalExitCode } from "./bearshell-exit-code.js"

export type BoundedProcessOutcome =
  | "failed"
  | "output-limit"
  | "passed"
  | "signal"
  | "spawn-failure"
  | "timeout"

export type BoundedProcessResult = {
  readonly killed: boolean
  readonly outcome: BoundedProcessOutcome
  readonly outputLimited: boolean
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
  readonly maxStderrBytes?: number
  readonly maxStdoutBytes?: number
  readonly maxTotalBytes?: number
  readonly timeoutMs: number
}

export const DEFAULT_MAX_STDOUT_BYTES = 1 * 1024 * 1024
export const DEFAULT_MAX_STDERR_BYTES = 1 * 1024 * 1024
export const DEFAULT_MAX_TOTAL_BYTES = 2 * 1024 * 1024

const MAX_CAPTURE_BYTES = 8 * 1024 * 1024
const SUPERVISOR_MAX_BUFFER_BYTES = 16 * 1024 * 1024

const SUPERVISOR_SOURCE = `
const { spawn } = require("node:child_process")
const process = require("node:process")

function positiveLimit(value, fallback) {
  return Number.isInteger(value) && value > 0 ? Math.min(value, ${MAX_CAPTURE_BYTES}) : fallback
}

function parseInput(text) {
  const value = JSON.parse(text)
  if (typeof value !== "object" || value === null) throw new Error("input must be an object")
  if (typeof value.command !== "string" || value.command.length === 0) throw new Error("command is required")
  if (!Array.isArray(value.args) || !value.args.every((arg) => typeof arg === "string")) throw new Error("args must be strings")
  if (!Number.isInteger(value.graceMs) || value.graceMs < 0) throw new Error("graceMs must be a non-negative integer")
  if (!Number.isInteger(value.timeoutMs) || value.timeoutMs < 1) throw new Error("timeoutMs must be a positive integer")
  const stdoutLimit = positiveLimit(value.maxStdoutBytes, ${DEFAULT_MAX_STDOUT_BYTES})
  const stderrLimit = positiveLimit(value.maxStderrBytes, ${DEFAULT_MAX_STDERR_BYTES})
  const totalLimit = Math.max(2, positiveLimit(value.maxTotalBytes, ${DEFAULT_MAX_TOTAL_BYTES}))
  return {
    args: value.args,
    command: value.command,
    cwd: value.cwd,
    env: value.env,
    graceMs: value.graceMs,
    maxStderrBytes: Math.max(1, Math.min(stderrLimit, Math.floor(totalLimit / 2))),
    maxStdoutBytes: Math.max(1, Math.min(stdoutLimit, Math.floor(totalLimit / 2))),
    maxTotalBytes: totalLimit,
    timeoutMs: value.timeoutMs,
  }
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

function signalStatus(signal) {
  if (signal === null) return 1
  const signalCodes = {
    SIGABRT: 6,
    SIGBUS: 7,
    SIGFPE: 8,
    SIGHUP: 1,
    SIGILL: 4,
    SIGINT: 2,
    SIGKILL: 9,
    SIGPIPE: 13,
    SIGQUIT: 3,
    SIGSEGV: 11,
    SIGTERM: 15,
    SIGTRAP: 5,
    SIGUSR1: 10,
    SIGUSR2: 12,
  }
  return 128 + (signalCodes[signal] ?? 1)
}

function createCapture(limit) {
  const headLimit = Math.max(1, Math.ceil(limit * 0.6))
  const tailLimit = Math.max(0, limit - headLimit)
  let head = Buffer.alloc(0)
  let tail = Buffer.alloc(0)

  function append(chunk) {
    const input = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
    if (input.length === 0) return
    let remaining = input
    if (head.length < headLimit) {
      const take = Math.min(headLimit - head.length, remaining.length)
      head = Buffer.concat([head, remaining.subarray(0, take)])
      remaining = remaining.subarray(take)
    }
    if (remaining.length > 0 && tailLimit > 0) {
      const combined = Buffer.concat([tail, remaining])
      tail = combined.length > tailLimit ? combined.subarray(combined.length - tailLimit) : combined
    }
  }

  function text() {
    return Buffer.concat([head, tail]).toString("utf8")
  }

  return { append, text }
}

function run(input) {
  return new Promise((resolve) => {
    const stdoutCapture = createCapture(input.maxStdoutBytes)
    const stderrCapture = createCapture(input.maxStderrBytes)
    let timedOut = false
    let killed = false
    let outputLimited = false
    let spawnFailure = false
    let settled = false
    let terminating = false
    let observedTotalBytes = 0
    let observedStderrBytes = 0
    let observedStdoutBytes = 0
    let graceTimer
    let timeoutTimer
    let child

    const terminate = (reason) => {
      if (settled || terminating) return
      terminating = true
      if (reason === "timeout") timedOut = true
      if (reason === "output-limit") outputLimited = true
      killChild(child?.pid, "SIGTERM")
      graceTimer = setTimeout(() => {
        if (settled) return
        killed = true
        killChild(child?.pid, "SIGKILL")
      }, input.graceMs)
    }

    const append = (capture, chunk, streamName) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
      observedTotalBytes += buffer.byteLength
      if (streamName === "stdout") observedStdoutBytes += buffer.byteLength
      else observedStderrBytes += buffer.byteLength
      capture.append(buffer)
      if (
        observedTotalBytes > input.maxTotalBytes
        || observedStdoutBytes > input.maxStdoutBytes
        || observedStderrBytes > input.maxStderrBytes
      ) {
        terminate("output-limit")
      }
    }

    try {
      child = spawn(input.command, [...input.args], {
        cwd: input.cwd,
        detached: process.platform !== "win32",
        env: { ...process.env, ...(input.env ?? {}) },
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      resolve({
        killed: false,
        outcome: "spawn-failure",
        outputLimited: false,
        signal: null,
        status: 1,
        stderr: message + "\\n",
        stdout: "",
        timedOut: false,
      })
      return
    }

    timeoutTimer = setTimeout(() => terminate("timeout"), input.timeoutMs)
    child.stdout.on("data", (chunk) => append(stdoutCapture, chunk, "stdout"))
    child.stderr.on("data", (chunk) => append(stderrCapture, chunk, "stderr"))
    child.on("error", (error) => {
      spawnFailure = true
      append(stderrCapture, error.message + "\\n", "stderr")
    })
    child.on("close", (status, signal) => {
      settled = true
      clearTimeout(timeoutTimer)
      if (graceTimer !== undefined) clearTimeout(graceTimer)
      const exitStatus = typeof status === "number" && status >= 0 ? status : signalStatus(signal)
      const outcome = spawnFailure
        ? "spawn-failure"
        : outputLimited
          ? "output-limit"
          : timedOut
            ? "timeout"
            : signal !== null
              ? "signal"
              : exitStatus === 0
                ? "passed"
                : "failed"
      resolve({
        killed,
        outcome,
        outputLimited,
        signal,
        status: exitStatus,
        stderr: stderrCapture.text(),
        stdout: stdoutCapture.text(),
        timedOut,
      })
    })
  })
}

run(parseInput(process.argv[1]))
  .then((result) => { process.stdout.write(JSON.stringify(result)) })
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    process.stdout.write(JSON.stringify({
      killed: false,
      outcome: "spawn-failure",
      outputLimited: false,
      signal: null,
      status: 1,
      stderr: message + "\\n",
      stdout: "",
      timedOut: false,
    }))
    process.exitCode = 1
  })
`

function normalizeLimit(value: number | undefined, fallback: number): number {
  if (!Number.isInteger(value) || value === undefined || value < 1) {
    return fallback
  }
  return Math.min(value, MAX_CAPTURE_BYTES)
}

function processLimits(options: BoundedProcessOptions): {
  readonly maxStderrBytes: number
  readonly maxStdoutBytes: number
  readonly maxTotalBytes: number
} {
  const maxStdoutBytes = normalizeLimit(options.maxStdoutBytes, DEFAULT_MAX_STDOUT_BYTES)
  const maxStderrBytes = normalizeLimit(options.maxStderrBytes, DEFAULT_MAX_STDERR_BYTES)
  const maxTotalBytes = Math.max(
    2,
    normalizeLimit(options.maxTotalBytes, Math.min(DEFAULT_MAX_TOTAL_BYTES, maxStdoutBytes + maxStderrBytes)),
  )
  return { maxStderrBytes, maxStdoutBytes, maxTotalBytes }
}

function fallbackResult(
  outcome: BoundedProcessOutcome,
  status: number,
  signal: NodeJS.Signals | null,
  stderr: string,
  timedOut = false,
  outputLimited = false,
): BoundedProcessResult {
  return {
    killed: false,
    outcome,
    outputLimited,
    signal,
    status,
    stderr,
    stdout: "",
    timedOut,
  }
}

function parseOutcome(value: unknown): BoundedProcessOutcome {
  return value === "failed"
    || value === "output-limit"
    || value === "passed"
    || value === "signal"
    || value === "spawn-failure"
    || value === "timeout"
    ? value
    : "spawn-failure"
}

export function runBoundedProcess(options: BoundedProcessOptions): BoundedProcessResult {
  const limits = processLimits(options)
  const input = JSON.stringify({ ...options, ...limits })
  const spawned = spawnSync(process.execPath, ["-e", SUPERVISOR_SOURCE, input], {
    encoding: "utf8",
    maxBuffer: Math.min(SUPERVISOR_MAX_BUFFER_BYTES, limits.maxTotalBytes + 512 * 1024),
  })
  const supervisorStdout = typeof spawned.stdout === "string" ? spawned.stdout : ""
  const supervisorStderr = typeof spawned.stderr === "string" ? spawned.stderr : ""
  if (spawned.error !== undefined) {
    const errorCode = "code" in spawned.error && typeof spawned.error.code === "string"
      ? spawned.error.code
      : undefined
    return fallbackResult(
      errorCode === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER" ? "output-limit" : "spawn-failure",
      spawned.status ?? signalExitCode(spawned.signal),
      spawned.signal,
      `${spawned.error.message}\n${supervisorStderr}`,
      false,
      errorCode === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER",
    )
  }
  try {
    const parsed: unknown = JSON.parse(supervisorStdout)
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("supervisor result was not an object")
    }
    const record = parsed as Record<string, unknown>
    const signal = typeof record.signal === "string" ? record.signal as NodeJS.Signals : null
    return {
      killed: record.killed === true,
      outcome: parseOutcome(record.outcome),
      outputLimited: record.outputLimited === true,
      signal,
      status: typeof record.status === "number" ? record.status : signalExitCode(signal),
      stderr: typeof record.stderr === "string" ? record.stderr : "",
      stdout: typeof record.stdout === "string" ? record.stdout : "",
      timedOut: record.timedOut === true,
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return fallbackResult(
      "spawn-failure",
      spawned.status ?? signalExitCode(spawned.signal),
      spawned.signal,
      `Failed to parse bounded process supervisor output: ${message}\n${supervisorStdout}${supervisorStderr}`,
    )
  }
}
