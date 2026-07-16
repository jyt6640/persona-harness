import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runBoundedProcess } from "../src/cli/bounded-process.js"

const tempDirs: string[] = []

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "persona-bounded-process-test-"))
  tempDirs.push(dir)
  return dir
}

function runNodeScript(
  script: string,
  options: Partial<Parameters<typeof runBoundedProcess>[0]> = {},
) {
  return runBoundedProcess({
    args: ["-e", script],
    command: process.execPath,
    cwd: createTempDir(),
    graceMs: 50,
    timeoutMs: 1_000,
    ...options,
  })
}

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { force: true, recursive: true })
  }
  tempDirs.length = 0
})

describe("bounded streaming process helper", () => {
  it("returns a structured passed result for direct argv", () => {
    const result = runNodeScript("process.stdout.write('ok')")

    expect(result).toMatchObject({
      outcome: "passed",
      outputLimited: false,
      status: 0,
    })
    expect(result.stdout).toBe("ok")
    expect(result.stderr).toBe("")
  })

  it("retains bounded head and tail output and stops at the total limit", () => {
    const result = runNodeScript(
      `process.stdout.write(${JSON.stringify(`HEAD${"x".repeat(4_096)}TAIL`)})`,
      {
        maxStdoutBytes: 128,
        maxStderrBytes: 128,
        maxTotalBytes: 256,
      },
    )

    expect(result.outcome).toBe("output-limit")
    expect(result.outputLimited).toBe(true)
    expect(Buffer.byteLength(result.stdout)).toBeLessThanOrEqual(128)
    expect(Buffer.byteLength(result.stderr)).toBeLessThanOrEqual(128)
    expect(Buffer.byteLength(result.stdout) + Buffer.byteLength(result.stderr)).toBeLessThanOrEqual(256)
    expect(result.stdout).toContain("HEAD")
    expect(result.stdout).toContain("TAIL")
  })

  it("bounds both streams before returning an output-limit result", () => {
    const result = runNodeScript(
      `process.stdout.write(${JSON.stringify("o".repeat(2_048))}); process.stderr.write(${JSON.stringify("e".repeat(2_048))})`,
      {
        maxStdoutBytes: 96,
        maxStderrBytes: 96,
        maxTotalBytes: 192,
      },
    )

    expect(result.outcome).toBe("output-limit")
    expect(Buffer.byteLength(result.stdout)).toBeLessThanOrEqual(96)
    expect(Buffer.byteLength(result.stderr)).toBeLessThanOrEqual(96)
    expect(Buffer.byteLength(result.stdout) + Buffer.byteLength(result.stderr)).toBeLessThanOrEqual(192)
  })

  it("distinguishes timeout and signal outcomes", () => {
    const timedOut = runNodeScript("setInterval(() => {}, 1_000)", { timeoutMs: 20 })
    const signaled = runNodeScript("process.kill(process.pid, 'SIGTERM')")

    expect(timedOut.outcome).toBe("timeout")
    expect(timedOut.timedOut).toBe(true)
    expect(signaled.outcome).toBe("signal")
    expect(signaled.signal).toBe("SIGTERM")
  })

  it("reports spawn failures without throwing or buffering unbounded diagnostics", () => {
    const result = runBoundedProcess({
      args: [],
      command: join(createTempDir(), "missing-command"),
      graceMs: 50,
      timeoutMs: 1_000,
    })

    expect(result.outcome).toBe("spawn-failure")
    expect(result.status).toBeGreaterThan(0)
    expect(Buffer.byteLength(result.stderr)).toBeLessThanOrEqual(256)
  })

  it.runIf(process.platform !== "win32")("stops a descendant with the timed-out process group", async () => {
    const dir = createTempDir()
    const heartbeatPath = join(dir, "descendant.heartbeat")
    const descendantScript = [
      "import { appendFileSync, writeFileSync } from 'node:fs'",
      `const heartbeatPath = ${JSON.stringify(heartbeatPath)}`,
      "process.on('SIGTERM', () => {})",
      "writeFileSync(heartbeatPath, 'started\\n')",
      "setInterval(() => appendFileSync(heartbeatPath, 'tick\\n'), 10)",
    ].join(";")
    const script = [
      "import { spawn } from 'node:child_process'",
      `spawn(process.execPath, ['-e', ${JSON.stringify(descendantScript)}], { stdio: 'ignore' })`,
      "process.on('SIGTERM', () => {})",
      "setInterval(() => {}, 1000)",
    ].join(";")

    const result = runBoundedProcess({
      args: ["-e", script],
      command: process.execPath,
      cwd: dir,
      graceMs: 50,
      timeoutMs: 1_000,
    })

    expect(result.outcome).toBe("timeout")
    expect(result.killed).toBe(true)
    expect(existsSync(heartbeatPath)).toBe(true)
    const heartbeatBefore = readFileSync(heartbeatPath, "utf8")
    expect(heartbeatBefore).toContain("started\n")

    await new Promise<void>((resolve) => setTimeout(resolve, 150))

    expect(readFileSync(heartbeatPath, "utf8")).toBe(heartbeatBefore)
  })
})
