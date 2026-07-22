import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  createFailureDiagnostic,
  runBoundedBuilderCommand,
} from "../scripts/build-clean-ci-attestation.mjs"

const root = process.cwd()
const builderPath = join(root, "scripts", "build-clean-ci-attestation.mjs")
const tempDirs: string[] = []

function createTempDir(): string {
  const directory = mkdtempSync(join(tmpdir(), "canonical-builder-process-"))
  tempDirs.push(directory)
  return directory
}

function fixedNodeCommand(id: string, source: string) {
  return { args: ["-e", source], executable: process.execPath, id }
}

const boundedOptions = {
  graceMs: 50,
  timeoutMs: 2_000,
}

afterEach(() => {
  for (const directory of tempDirs) {
    rmSync(directory, { force: true, recursive: true })
  }
  tempDirs.length = 0
})

describe("canonical builder bounded process contract", () => {
  it("keeps fixed streaming caps and group escalation in the canonical runner", () => {
    const builder = readFileSync(builderPath, "utf8")

    expect(builder).toContain("const COMMAND_MAX_STDOUT_BYTES = 1024 * 1024")
    expect(builder).toContain("const COMMAND_MAX_STDERR_BYTES = 1024 * 1024")
    expect(builder).toContain("const COMMAND_MAX_TOTAL_OUTPUT_BYTES = 1024 * 1024")
    expect(builder).toContain("const COMMAND_TERMINATION_GRACE_MS = 5_000")
    expect(builder).toContain('terminateProcessTree(child.pid, "SIGTERM")')
    expect(builder).toContain('terminateProcessTree(child.pid, "SIGKILL")')
    expect(builder).not.toContain("stdout += chunk")
    expect(builder).not.toContain("stderr += chunk")
  })

  it("returns normal under-cap command facts", async () => {
    const result = await runBoundedBuilderCommand(
      fixedNodeCommand("under-cap", "process.stdout.write('normal-output'); process.stderr.write('normal-error')"),
      createTempDir(),
      boundedOptions,
    )

    expect(result).toMatchObject({
      exitCode: 0,
      id: "under-cap",
      stdout: "normal-output",
    })
    expect(result.stderrDigest).toMatch(/^sha256:/)
    expect(result.stdoutDigest).toMatch(/^sha256:/)
  })

  it("fails closed at the fixed stdout cap without retaining a 2 MiB command output", async () => {
    const marker = "CANONICAL_BUILDER_STDOUT_SECRET"
    const error = await runBoundedBuilderCommand(
      fixedNodeCommand("output-cap", `process.stdout.write(${JSON.stringify(marker)}.repeat(2 * 1024 * 1024))`),
      createTempDir(),
      boundedOptions,
    ).catch((candidate: unknown) => candidate)

    expect(error).toMatchObject({
      details: { commandId: "output-cap", exitState: "output-limit" },
      message: "fixed command failed: output-cap",
    })
    expect(String(error)).not.toContain(marker)
  })

  it("fails closed at the fixed stderr cap without retaining raw output", async () => {
    const marker = "CANONICAL_BUILDER_STDERR_SECRET"
    const error = await runBoundedBuilderCommand(
      fixedNodeCommand("stderr-cap", `process.stderr.write(${JSON.stringify(marker)}.repeat(2 * 1024 * 1024))`),
      createTempDir(),
      boundedOptions,
    ).catch((candidate: unknown) => candidate)

    expect(error).toMatchObject({
      details: { commandId: "stderr-cap", exitState: "output-limit" },
      message: "fixed command failed: stderr-cap",
    })
    expect(String(error)).not.toContain(marker)
  })

  it("fails closed when safe individual streams exceed the aggregate cap together", async () => {
    const error = await runBoundedBuilderCommand(
      fixedNodeCommand(
        "aggregate-cap",
        "process.stdout.write('a'.repeat(768 * 1024)); process.stderr.write('b'.repeat(768 * 1024))",
      ),
      createTempDir(),
      boundedOptions,
    ).catch((candidate: unknown) => candidate)

    expect(error).toMatchObject({
      details: { commandId: "aggregate-cap", exitState: "output-limit" },
      message: "fixed command failed: aggregate-cap",
    })
  })

  it.runIf(process.platform !== "win32")("terminates a SIGTERM-ignoring descendant after an output cap breach", async () => {
    const fixtureRoot = createTempDir()
    const heartbeatPath = join(fixtureRoot, "output-cap-descendant.heartbeat")
    const descendantScript = [
      "import { appendFileSync, writeFileSync } from 'node:fs'",
      `const heartbeatPath = ${JSON.stringify(heartbeatPath)}`,
      "process.on('SIGTERM', () => {})",
      "writeFileSync(heartbeatPath, 'started\\n')",
      "setInterval(() => appendFileSync(heartbeatPath, 'tick\\n'), 10)",
    ].join(";")
    const parentScript = [
      "import { spawn } from 'node:child_process'",
      `spawn(process.execPath, ['-e', ${JSON.stringify(descendantScript)}], { stdio: 'ignore' })`,
      "setInterval(() => process.stdout.write('x'.repeat(16 * 1024)), 1)",
    ].join(";")

    await expect(runBoundedBuilderCommand(
      fixedNodeCommand("output-descendant", parentScript),
      fixtureRoot,
      boundedOptions,
    )).rejects.toMatchObject({
      details: { commandId: "output-descendant", exitState: "output-limit" },
    })

    expect(existsSync(heartbeatPath)).toBe(true)
    const heartbeatBefore = readFileSync(heartbeatPath, "utf8")
    expect(heartbeatBefore).toContain("started\n")

    await new Promise<void>((resolve) => setTimeout(resolve, 150))

    expect(readFileSync(heartbeatPath, "utf8")).toBe(heartbeatBefore)
  })

  it.runIf(process.platform !== "win32")("terminates a SIGTERM-ignoring descendant after a command timeout", async () => {
    const fixtureRoot = createTempDir()
    const heartbeatPath = join(fixtureRoot, "timeout-descendant.heartbeat")
    const descendantScript = [
      "import { appendFileSync, writeFileSync } from 'node:fs'",
      `const heartbeatPath = ${JSON.stringify(heartbeatPath)}`,
      "process.on('SIGTERM', () => {})",
      "writeFileSync(heartbeatPath, 'started\\n')",
      "setInterval(() => appendFileSync(heartbeatPath, 'tick\\n'), 10)",
    ].join(";")
    const parentScript = [
      "import { spawn } from 'node:child_process'",
      `spawn(process.execPath, ['-e', ${JSON.stringify(descendantScript)}], { stdio: 'ignore' })`,
      "setInterval(() => {}, 1000)",
    ].join(";")

    await expect(runBoundedBuilderCommand(
      fixedNodeCommand("timeout-descendant", parentScript),
      fixtureRoot,
      { graceMs: 50, timeoutMs: 100 },
    )).rejects.toMatchObject({
      details: { commandId: "timeout-descendant", exitState: "timeout" },
    })

    expect(existsSync(heartbeatPath)).toBe(true)
    const heartbeatBefore = readFileSync(heartbeatPath, "utf8")
    await new Promise<void>((resolve) => setTimeout(resolve, 150))
    expect(readFileSync(heartbeatPath, "utf8")).toBe(heartbeatBefore)
  })

  it("keeps output-limit diagnostics non-authoritative and free of output fields", () => {
    const diagnostic = createFailureDiagnostic(
      { commandId: "output-cap", exitCode: 143, exitState: "output-limit" },
      join(createTempDir(), "missing-test-results.json"),
      root,
    )
    const serialized = JSON.stringify(diagnostic)

    expect(diagnostic).toMatchObject({
      authorityEligible: false,
      commandId: "output-cap",
      exitCode: 143,
      exitState: "output-limit",
      rawOutputIncluded: false,
    })
    expect(serialized).not.toContain("stdout")
    expect(serialized).not.toContain("stderr")
    expect(serialized).not.toContain("CANONICAL_BUILDER_STDOUT_SECRET")
  })
})
