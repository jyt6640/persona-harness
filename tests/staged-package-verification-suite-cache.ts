import { mkdirSync } from "node:fs"
import { join } from "node:path"

export type PackageCommandResult = {
  readonly output: string
  readonly status: number
}

export type PackageCommandRunner = (
  command: string,
  args: readonly string[],
  cwd: string,
) => PackageCommandResult

export type SuiteNpmCache = {
  readonly path: string
}

export type InstallCacheObservation = {
  readonly path: () => string
  readonly observe: (args: readonly string[]) => void
}

export type SuiteNpmCommandRunnerOptions = {
  readonly cache: SuiteNpmCache
  readonly observeInstall?: (args: readonly string[]) => void
  readonly runProvenance: () => PackageCommandResult
  readonly runner: PackageCommandRunner
}

function withSuiteNpmCache(cache: SuiteNpmCache, command: string, args: readonly string[]): readonly string[] {
  if (command !== "npm" || args[0] !== "install") return args

  const cacheIndex = args.indexOf("--cache")
  const cachePathIndex = cacheIndex + 1
  if (cacheIndex < 0 || cachePathIndex >= args.length) {
    throw new Error("suite-npm-cache-unavailable")
  }
  return args.map((arg, index) => index === cachePathIndex ? cache.path : arg)
}

export function warmSuiteNpmCache(
  root: string,
  tarballPath: string,
  runner: PackageCommandRunner,
): SuiteNpmCache {
  const path = join(root, "npm-cache")
  const consumerDir = join(root, "cache-warm")
  mkdirSync(consumerDir)
  const result = runner(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--no-save",
      "--package-lock=false",
      "--cache",
      path,
      tarballPath,
    ],
    consumerDir,
  )
  if (result.status !== 0) throw new Error("suite-npm-cache-warmup-failed")
  return { path }
}

export function createInstallCacheObservation(): InstallCacheObservation {
  let observedPath = ""
  return {
    path: () => observedPath,
    observe: (args) => {
      const cacheIndex = args.indexOf("--cache")
      observedPath = cacheIndex >= 0 && cacheIndex + 1 < args.length
        ? (args[cacheIndex + 1] ?? "")
        : ""
    },
  }
}

export function suiteNpmCommandRunner(options: SuiteNpmCommandRunnerOptions): PackageCommandRunner {
  return (command, args, cwd) => {
    if (command === "npm" && args[0] === "audit" && args[1] === "signatures" && args[2] === "--json") {
      return options.runProvenance()
    }
    const suiteArgs = withSuiteNpmCache(options.cache, command, args)
    if (command === "npm" && suiteArgs[0] === "install") options.observeInstall?.(suiteArgs)
    return options.runner(command, suiteArgs, cwd)
  }
}
