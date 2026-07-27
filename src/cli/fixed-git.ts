import { spawnSync } from "node:child_process"
import { lstatSync, realpathSync } from "node:fs"
import { dirname } from "node:path"

const MAX_OUTPUT_BYTES = 4 * 1024 * 1024
const GIT_TIMEOUT_MS = 5_000
const FIXED_GIT_OPTIONS = [
  "--no-optional-locks",
  "-c",
  "core.filemode=true",
  "-c",
  "core.fsmonitor=false",
  "-c",
  "core.untrackedCache=false",
] as const

export type FixedGitResult = {
  readonly available: boolean
  readonly diagnosticCode: string
  readonly status: number
  readonly stdout: string
}

export function runFixedGit(projectDir: string, args: readonly string[]): FixedGitResult {
  const executable = resolveFixedGitExecutable()
  if (executable === undefined) return unavailable("git-executable-unavailable")
  try {
    const result = spawnSync(executable, [...FIXED_GIT_OPTIONS, ...args], {
      cwd: projectDir,
      encoding: "utf8",
      env: fixedGitEnvironment(executable),
      maxBuffer: MAX_OUTPUT_BYTES,
      shell: false,
      stdio: ["ignore", "pipe", "ignore"],
      timeout: GIT_TIMEOUT_MS,
    })
    if (result.error !== undefined) return unavailable("git-execution-failed")
    return {
      available: true,
      diagnosticCode: "git-execution-complete",
      status: result.status ?? 1,
      stdout: typeof result.stdout === "string" ? result.stdout : "",
    }
  } catch {
    return unavailable("git-execution-failed")
  }
}

function resolveFixedGitExecutable(): string | undefined {
  for (const candidate of fixedGitCandidates()) {
    if (isSafeFixedExecutable(candidate)) return candidate
  }
  return undefined
}

function fixedGitCandidates(): readonly string[] {
  if (process.platform === "darwin") return ["/usr/bin/git"]
  if (process.platform === "linux") return ["/usr/bin/git", "/usr/local/bin/git"]
  if (process.platform === "win32") {
    return [
      "C:\\Program Files\\Git\\cmd\\git.exe",
      "C:\\Program Files (x86)\\Git\\cmd\\git.exe",
    ]
  }
  return []
}

function isSafeFixedExecutable(candidate: string): boolean {
  try {
    const stat = lstatSync(candidate, { bigint: true })
    if (!stat.isFile() || stat.isSymbolicLink()) return false
    if (process.platform !== "win32" && (stat.mode & 0o111n) === 0n) return false
    const realpath = realpathSync(candidate)
    return process.platform === "win32"
      ? realpath.toLowerCase() === candidate.toLowerCase()
      : realpath === candidate
  } catch {
    return false
  }
}

function fixedGitEnvironment(executable: string): NodeJS.ProcessEnv {
  const nullDevice = process.platform === "win32" ? "NUL" : "/dev/null"
  return {
    GIT_CONFIG_GLOBAL: nullDevice,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_SYSTEM: nullDevice,
    GIT_OPTIONAL_LOCKS: "0",
    GIT_PAGER: "cat",
    GIT_TERMINAL_PROMPT: "0",
    LANG: "C",
    LC_ALL: "C",
    PATH: dirname(executable),
    ...(process.platform === "win32" ? { SystemRoot: "C:\\Windows" } : {}),
  }
}

function unavailable(diagnosticCode: string): FixedGitResult {
  return { available: false, diagnosticCode, status: 1, stdout: "" }
}
