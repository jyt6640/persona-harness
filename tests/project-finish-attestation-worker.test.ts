import { beforeEach, describe, expect, it, vi } from "vitest"

const childProcess = vi.hoisted(() => ({
  spawnSync: vi.fn(),
}))

vi.mock("node:child_process", () => ({
  spawnSync: childProcess.spawnSync,
}))

import { runProjectFinishAttestationWorker } from "../src/cli/project-finish-attestation-worker.js"

beforeEach(() => {
  childProcess.spawnSync.mockReset()
})

describe("project finish attestation Sigstore worker boundary", () => {
  it("preserves network-unavailable separately from cryptographic rejection without forwarding caller environment", () => {
    childProcess.spawnSync.mockReturnValue({
      stdout: JSON.stringify({ ok: false, state: "network-unavailable" }),
    })

    const result = runProjectFinishAttestationWorker(Buffer.from("{}"))

    expect(result).toEqual({ ok: false, state: "network-unavailable" })
    const options = childProcess.spawnSync.mock.calls[0]?.[2]
    expect(options).toMatchObject({
      env: { LANG: "C", LC_ALL: "C" },
      shell: false,
      stdio: ["pipe", "pipe", "ignore"],
    })
    expect(JSON.stringify(options)).not.toContain("GITHUB_TOKEN")
    expect(JSON.stringify(options)).not.toContain("PH_SECRET")
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
