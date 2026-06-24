import { execFileSync } from "node:child_process"
import { delimiter, join, win32 } from "node:path"
import process from "node:process"

type DoctorEnv = Readonly<Record<string, string | undefined>>

export type DoctorCommandRunner = (
  command: string,
  args: readonly string[],
  env: DoctorEnv,
) => string | undefined

export type DoctorCommandFinder = (
  command: string,
  env: DoctorEnv,
) => readonly string[]

export type DoctorCommandDetectionOptions = {
  readonly env: DoctorEnv
  readonly finder?: DoctorCommandFinder
  readonly platform?: NodeJS.Platform
  readonly runner?: DoctorCommandRunner
}

type CommandInvocation = {
  readonly args: readonly string[]
  readonly command: string
}

const DEFAULT_WINDOWS_PATHEXT = [".com", ".exe", ".bat", ".cmd", ".ps1"] as const

function resolveCommandInvocation(command: string, args: readonly string[], platform: NodeJS.Platform): CommandInvocation {
  if (platform !== "win32") {
    return { args, command }
  }
  const lowerCommand = command.toLowerCase()
  if (lowerCommand.endsWith(".cmd") || lowerCommand.endsWith(".bat")) {
    return { args: ["/d", "/s", "/c", command, ...args], command: "cmd.exe" }
  }
  if (lowerCommand.endsWith(".ps1")) {
    return { args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", command, ...args], command: "powershell.exe" }
  }
  return { args, command }
}

function defaultCommandRunner(command: string, args: readonly string[], env: DoctorEnv, platform: NodeJS.Platform): string | undefined {
  const invocation = resolveCommandInvocation(command, args, platform)
  try {
    return execFileSync(invocation.command, [...invocation.args], {
      encoding: "utf8",
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 3000,
    }).trim() || "available"
  } catch (error) {
    if (error instanceof Error) {
      return undefined
    }
    throw error
  }
}

function defaultCommandFinder(command: string, env: DoctorEnv, platform: NodeJS.Platform): readonly string[] {
  if (platform !== "win32") {
    return []
  }
  return defaultCommandRunner("where", [command], env, platform)?.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    ?? defaultCommandRunner("where.exe", [command], env, platform)?.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    ?? []
}

function windowsPathExt(env: DoctorEnv): readonly string[] {
  const configured = env.PATHEXT?.split(";").map((extension) => extension.trim().toLowerCase()).filter(Boolean)
  return configured !== undefined && configured.length > 0 ? configured : DEFAULT_WINDOWS_PATHEXT
}

function commandVariants(command: string, env: DoctorEnv, platform: NodeJS.Platform): readonly string[] {
  if (platform !== "win32" || /\.[^\\/]+$/.test(command)) {
    return [command]
  }
  return [command, ...windowsPathExt(env).map((extension) => `${command}${extension}`)]
}

function pathDirs(env: DoctorEnv, platform: NodeJS.Platform): readonly string[] {
  const pathValue = env.PATH ?? env.Path ?? env.path
  if (pathValue === undefined) {
    return []
  }
  return pathValue.split(platform === "win32" ? win32.delimiter : delimiter).map((entry) => entry.trim()).filter(Boolean)
}

function npmGlobalBinDirs(env: DoctorEnv, platform: NodeJS.Platform): readonly string[] {
  const dirs: string[] = []
  const npmPrefix = env.npm_config_prefix
  if (npmPrefix !== undefined && npmPrefix.length > 0) {
    dirs.push(platform === "win32" ? npmPrefix : join(npmPrefix, "bin"))
  }
  if (platform === "win32") {
    const appData = env.APPDATA
    const userProfile = env.USERPROFILE
    if (appData !== undefined && appData.length > 0) {
      dirs.push(win32.join(appData, "npm"))
    }
    if (userProfile !== undefined && userProfile.length > 0) {
      dirs.push(win32.join(userProfile, "AppData", "Roaming", "npm"))
    }
  }
  return dirs
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)]
}

function commandCandidates(command: string, options: DoctorCommandDetectionOptions): readonly string[] {
  const platform = options.platform ?? process.platform
  if (platform !== "win32") {
    return []
  }
  const finder = options.finder ?? ((target, env) => defaultCommandFinder(target, env, platform))
  const variants = commandVariants(command, options.env, platform)
  const candidateDirs = [...pathDirs(options.env, platform), ...npmGlobalBinDirs(options.env, platform)]
  const pathCandidates = candidateDirs.flatMap((dir) => variants.map((variant) => win32.join(dir, variant)))
  return unique([...finder(command, options.env), ...pathCandidates])
}

export function detectCommandOutput(command: string, args: readonly string[], options: DoctorCommandDetectionOptions): string | undefined {
  const platform = options.platform ?? process.platform
  const runner = options.runner ?? ((target, targetArgs, env) => defaultCommandRunner(target, targetArgs, env, platform))
  const direct = runner(command, args, options.env)
  if (direct !== undefined) {
    return direct
  }
  for (const candidate of commandCandidates(command, options)) {
    const output = runner(candidate, args, options.env)
    if (output !== undefined) {
      return output
    }
  }
  return undefined
}

export function detectCommandVersion(command: string, args: readonly string[], options: DoctorCommandDetectionOptions): string {
  return detectCommandOutput(command, args, options) ?? "missing"
}
