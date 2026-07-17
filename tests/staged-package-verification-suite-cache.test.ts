import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  createInstallCacheObservation,
  suiteNpmCommandRunner,
  warmSuiteNpmCache,
  type PackageCommandResult,
} from "./staged-package-verification-suite-cache.js"

const roots: string[] = []

function createRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "persona-staged-package-cache-test-"))
  roots.push(root)
  return root
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { force: true, recursive: true })
  }
})

describe("staged package verification suite cache", () => {
  it("warms one suite cache and routes only fresh npm installs through it", () => {
    const root = createRoot()
    const commands: { readonly args: readonly string[]; readonly command: string; readonly cwd: string }[] = []
    const runner = (command: string, args: readonly string[], cwd: string): PackageCommandResult => {
      commands.push({ args, command, cwd })
      return { output: "", status: 0 }
    }
    const cache = warmSuiteNpmCache(root, "candidate.tgz", runner)
    const observation = createInstallCacheObservation()
    const commandRunner = suiteNpmCommandRunner({
      cache,
      observeInstall: observation.observe,
      runProvenance: () => ({ output: "provenance", status: 1 }),
      runner,
    })

    const install = commandRunner("npm", ["install", "--cache", "private-cache", "candidate.tgz"], "fresh-consumer")
    const test = commandRunner("npm", ["test"], "fresh-consumer")
    const provenance = commandRunner("npm", ["audit", "signatures", "--json"], "fresh-consumer")

    expect(install).toEqual({ output: "", status: 0 })
    expect(test).toEqual({ output: "", status: 0 })
    expect(provenance).toEqual({ output: "provenance", status: 1 })
    expect(observation.path()).toBe(cache.path)
    expect(commands).toEqual([
      { args: ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--no-save", "--package-lock=false", "--cache", cache.path, "candidate.tgz"], command: "npm", cwd: join(root, "cache-warm") },
      { args: ["install", "--cache", cache.path, "candidate.tgz"], command: "npm", cwd: "fresh-consumer" },
      { args: ["test"], command: "npm", cwd: "fresh-consumer" },
    ])
  })
})
