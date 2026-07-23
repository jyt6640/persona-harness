import { beforeEach, describe, expect, it, vi } from "vitest"

const childProcess = vi.hoisted(() => ({
  spawnSync: vi.fn(),
}))

vi.mock("node:child_process", () => ({
  spawnSync: childProcess.spawnSync,
}))

import { runFinishAttestationWorker } from "../src/cli/workflow-finish-attestation-worker.js"

beforeEach(() => {
  childProcess.spawnSync.mockReset()
})

describe("finish attestation Sigstore worker boundary", () => {
  it("preserves a bounded unsupported runtime result even when the direct worker exits nonzero", () => {
    childProcess.spawnSync.mockReturnValue({
      status: 1,
      stdout: JSON.stringify({ ok: false, state: "runtime-unsupported" }),
    })

    expect(runFinishAttestationWorker("/workspace")).toEqual({
      message: "Node.js does not meet the required Sigstore runtime range; finish authority remains blocked.",
      ok: false,
      state: "runtime-unsupported",
    })
    expect(JSON.stringify(childProcess.spawnSync.mock.calls[0]?.[2])).not.toContain("GITHUB_TOKEN")
  })
})
