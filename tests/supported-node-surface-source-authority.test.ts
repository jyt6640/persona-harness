import { spawnSync } from "node:child_process"
import { join } from "node:path"
import process from "node:process"

import { describe, expect, it } from "vitest"

import { withPackagePackLock } from "./package-pack-lock.js"

type SupportRuntime = {
  readonly expectedNode: "20" | "22" | "24"
  readonly nodeMode: "major"
  readonly platform: "linux" | "macos"
}

const repositoryRoot = process.cwd()

function currentSupportRuntime(): SupportRuntime {
  const nodeMajor = Number(process.versions.node.split(".", 1)[0])
  if (process.platform === "darwin" && nodeMajor === 22) {
    return { expectedNode: "22", nodeMode: "major", platform: "macos" }
  }
  if (process.platform === "linux" && (nodeMajor === 20 || nodeMajor === 22 || nodeMajor === 24)) {
    return {
      expectedNode: nodeMajor === 20 ? "20" : nodeMajor === 22 ? "22" : "24",
      nodeMode: "major",
      platform: "linux",
    }
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

describe("source-built and packed installed supported Node authority-negative surfaces", () => {
  it("keeps both support commands at trusted-authority-required with verifier imports", { timeout: 120_000 }, () => {
    const runtime = currentSupportRuntime()
    const result = withPackagePackLock(() => {
      const build = run("npm", ["run", "build"])
      expect(build.status).toBe(0)
      const args = [
        join(repositoryRoot, "scripts", "verify-supported-node-surface.mjs"),
        "--surface",
        "source",
        "--expected-platform",
        runtime.platform,
        "--expected-node",
        runtime.expectedNode,
        "--expected-node-mode",
        runtime.nodeMode,
      ]
      const source = run(process.execPath, args)
      const installedArgs = [...args]
      installedArgs[2] = "installed"
      const installed = run(process.execPath, installedArgs)
      return { installed, source }
    })

    expect(result.source.status).toBe(0)
    expect(result.source.output).toContain('"surface":"source"')
    expect(result.source.output).toContain('"verifierImports":{"source":"PASS"}')
    expect(result.installed.status).toBe(0)
    expect(result.installed.output).toContain('"surface":"installed"')
    expect(result.installed.output).toContain('"verifierImports":{"installed":"PASS","packed":"PASS"}')
  })
})
