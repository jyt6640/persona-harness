import { spawnSync } from "node:child_process"
import { join } from "node:path"
import process from "node:process"

import { describe, expect, it } from "vitest"

import { withPackagePackLock } from "./package-pack-lock.js"

type SupportRuntime = {
  readonly nodeMajor: 20 | 22 | 24
  readonly platform: "linux" | "macos"
}

const repositoryRoot = process.cwd()

function currentSupportRuntime(): SupportRuntime {
  const nodeMajor = Number(process.versions.node.split(".", 1)[0])
  if (process.platform === "darwin" && nodeMajor === 22) {
    return { nodeMajor: 22, platform: "macos" }
  }
  if (process.platform === "linux" && (nodeMajor === 20 || nodeMajor === 22 || nodeMajor === 24)) {
    return { nodeMajor, platform: "linux" }
  }
  throw new Error("unsupported-local-supported-node-surface-runtime")
}

function run(command: string, args: readonly string[]) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  })
  return {
    output: `${result.stdout}\n${result.stderr}`,
    status: result.status ?? 1,
  }
}

describe("source-built supported Node authority-negative surface", () => {
  it("keeps the exact source-built support command at trusted-authority-required", { timeout: 60_000 }, () => {
    const runtime = currentSupportRuntime()
    const result = withPackagePackLock(() => {
      const build = run("npm", ["run", "build"])
      expect(build.status).toBe(0)
      return run(process.execPath, [
        join(repositoryRoot, "scripts", "verify-supported-node-surface.mjs"),
        "--surface",
        "source",
        "--expected-platform",
        runtime.platform,
        "--expected-node-major",
        String(runtime.nodeMajor),
      ])
    })

    expect(result.status).toBe(0)
    expect(result.output).toContain('"surface":"source"')
  })
})
