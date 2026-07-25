import { existsSync } from "node:fs"

import { beforeEach, describe, expect, it, vi } from "vitest"

const childProcess = vi.hoisted(() => ({
  spawnSync: vi.fn(),
}))

vi.mock("node:child_process", () => ({
  spawnSync: childProcess.spawnSync,
}))

import {
  runProjectFinishAttestationWorker,
  runProjectFinishTrustReadinessWorker,
} from "../src/cli/project-finish-attestation-worker.js"

beforeEach(() => {
  childProcess.spawnSync.mockReset()
})

describe("project finish attestation Sigstore worker boundary", () => {
  it.each([
    "certificate-invalid",
    "dns-unavailable",
    "malformed-bundle",
    "network-unavailable",
    "signature-invalid",
    "transparency-invalid",
    "trust-root-unavailable",
    "verification-timeout",
  ] as const)("preserves the bounded %s failure code without forwarding caller environment", (state) => {
    childProcess.spawnSync.mockReturnValue({
      stdout: JSON.stringify({ ok: false, state }),
    })

    const result = runProjectFinishAttestationWorker(Buffer.from("{}"))

    expect(result).toEqual({ ok: false, state })
    const options = childProcess.spawnSync.mock.calls[0]?.[2]
    expect(options).toMatchObject({
      env: { LANG: "C", LC_ALL: "C" },
      shell: false,
      stdio: ["pipe", "pipe", "ignore"],
      timeout: 30_000,
    })
    expect(JSON.stringify(options)).not.toContain("GITHUB_TOKEN")
    expect(JSON.stringify(options)).not.toContain("PH_SECRET")
  })

  it("reports the absolute child-process deadline separately from cryptographic rejection", () => {
    let cachePath: string | undefined
    childProcess.spawnSync.mockImplementation((_command, _args, options) => {
      cachePath = options.env.PH_PROJECT_FINISH_SIGSTORE_CACHE_PATH
      if (cachePath === undefined) throw new Error("worker must provide a product-owned cache path")
      expect(existsSync(cachePath)).toBe(true)
      return {
        error: { code: "ETIMEDOUT" },
        signal: "SIGTERM",
        status: null,
        stdout: "",
      }
    })

    expect(runProjectFinishAttestationWorker(Buffer.from("{}"))).toEqual({
      ok: false,
      state: "verification-timeout",
    })
    expect(cachePath).toBeDefined()
    if (cachePath === undefined) throw new Error("worker cache path was not captured")
    expect(existsSync(cachePath)).toBe(false)
  })

  it("runs a live no-cache trust-readiness check through the same bounded worker", () => {
    childProcess.spawnSync.mockReturnValue({
      stdout: JSON.stringify({ ok: true, state: "ready" }),
    })

    expect(runProjectFinishTrustReadinessWorker()).toEqual({ ok: true })
    expect(childProcess.spawnSync.mock.calls[0]?.[1]).toEqual([
      expect.stringContaining("verify-project-finish-attestation.mjs"),
      "--trust-readiness",
    ])
    expect(childProcess.spawnSync.mock.calls[0]?.[2]).toMatchObject({
      env: { LANG: "C", LC_ALL: "C" },
      timeout: 30_000,
    })
  })

  it("fails closed for malformed worker output", () => {
    childProcess.spawnSync.mockReturnValue({ stdout: "{not-json" })

    expect(runProjectFinishAttestationWorker(Buffer.from("{}"))).toEqual({
      ok: false,
      state: "malformed",
    })
  })

  it("preserves an unsupported runtime block without accepting evidence", () => {
    childProcess.spawnSync.mockReturnValue({
      stdout: JSON.stringify({ ok: false, state: "runtime-unsupported" }),
    })

    expect(runProjectFinishAttestationWorker(Buffer.from("{}"))).toEqual({
      ok: false,
      state: "runtime-unsupported",
    })
  })

  it("fails closed when the worker has no parseable result", () => {
    childProcess.spawnSync.mockReturnValue({ stdout: "" })

    expect(runProjectFinishAttestationWorker(Buffer.from("{}"))).toEqual({
      ok: false,
      state: "crypto-failed",
    })
  })
})
