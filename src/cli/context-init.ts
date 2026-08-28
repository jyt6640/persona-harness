import {
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { join, resolve } from "node:path"

import { DEFAULT_CONTEXT_CONFIG } from "../config/context-config.js"
import {
  captureNoFollowDirectory,
  noFollowPathIdentityFromStat,
  sameNoFollowPathIdentity,
  sameNoFollowPathLocation,
  type NoFollowPathIdentity,
} from "../io/no-follow-file.js"

const CONFIG_FILE_NAME = "harness.jsonc"
const PERSONA_DIRECTORY_NAME = ".persona"

export type ContextInitCommandResult = {
  readonly status: 0 | 1
  readonly stderr: string
  readonly stdout: string
}

type EnableOutcome = "created" | "existing" | "unavailable" | "unsafe"

type PersonaDirectory = {
  readonly created: boolean
  readonly identity: NoFollowPathIdentity
  readonly path: string
}

export function runContextInitCommand(
  args: readonly string[],
  projectDir: string,
): ContextInitCommandResult {
  if (args.length === 0) return preview()
  if (args.length !== 1 || args[0] !== "--enable") return failure("context-init-arguments-invalid")

  const outcome = enableContext(projectDir)
  if (outcome === "created") return enabled()
  if (outcome === "existing") return failure("context-init-existing-config")
  if (outcome === "unsafe") return failure("context-init-path-unsafe")
  return failure("context-init-write-unavailable")
}

function enableContext(projectDir: string): EnableOutcome {
  const rootPath = resolve(projectDir)
  const root = captureNoFollowDirectory(rootPath)
  if (root.kind !== "ready") return "unsafe"

  const persona = reservePersonaDirectory(rootPath, root.value)
  if (persona === undefined) return "unsafe"

  const configPath = join(persona.path, CONFIG_FILE_NAME)
  const before = inspectConfigFile(configPath)
  if (before === "existing") return "existing"
  if (before === "unsafe") {
    removeEmptyCreatedPersona(persona)
    return "unsafe"
  }

  let descriptor: number | undefined
  let createdIdentity: NoFollowPathIdentity | undefined
  let completed = false
  try {
    if (!sameDirectoryLocation(rootPath, root.value) || !sameDirectoryLocation(persona.path, persona.identity)) {
      return "unsafe"
    }
    descriptor = openSync(
      configPath,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    )
    const opened = fstatSync(descriptor, { bigint: true })
    if (!opened.isFile()) return "unsafe"
    createdIdentity = noFollowPathIdentityFromStat(opened)
    writeFileSync(descriptor, contextConfigText())
    fsyncSync(descriptor)

    const afterWrite = noFollowPathIdentityFromStat(fstatSync(descriptor, { bigint: true }))
    const pathAfterWrite = lstatSync(configPath, { bigint: true })
    if (
      !pathAfterWrite.isFile()
      || pathAfterWrite.isSymbolicLink()
      || !sameNoFollowPathIdentity(afterWrite, noFollowPathIdentityFromStat(pathAfterWrite))
      || !sameDirectoryLocation(rootPath, root.value)
      || !sameDirectoryLocation(persona.path, persona.identity)
    ) {
      return "unsafe"
    }
    createdIdentity = afterWrite
    completed = true
    return "created"
  } catch (error) {
    const after = inspectConfigFile(configPath)
    if (after === "existing" && createdIdentity === undefined) return "existing"
    if (after === "unsafe") return "unsafe"
    return isAlreadyPresent(error) ? "existing" : "unavailable"
  } finally {
    if (descriptor !== undefined) closeSync(descriptor)
    if (!completed && createdIdentity !== undefined) {
      removeOwnedConfig(configPath, createdIdentity)
    }
    if (!completed) {
      removeEmptyCreatedPersona(persona)
    }
  }
}

function reservePersonaDirectory(rootPath: string, rootIdentity: NoFollowPathIdentity): PersonaDirectory | undefined {
  const personaPath = join(rootPath, PERSONA_DIRECTORY_NAME)
  const existing = captureNoFollowDirectory(personaPath)
  if (existing.kind === "ready") return { created: false, identity: existing.value, path: personaPath }
  if (existing.kind === "blocked") return undefined

  let createdHere = false
  try {
    mkdirSync(personaPath, { mode: 0o700 })
    createdHere = true
  } catch (error) {
    if (!isAlreadyPresent(error)) return undefined
  }
  const created = captureNoFollowDirectory(personaPath)
  if (created.kind !== "ready" || !sameDirectoryLocation(rootPath, rootIdentity)) return undefined
  return { created: createdHere, identity: created.value, path: personaPath }
}

function inspectConfigFile(path: string): "absent" | "existing" | "unsafe" {
  try {
    const stat = lstatSync(path, { bigint: true })
    return stat.isFile() && !stat.isSymbolicLink() ? "existing" : "unsafe"
  } catch (error) {
    return isMissing(error) ? "absent" : "unsafe"
  }
}

function sameDirectoryLocation(path: string, expected: NoFollowPathIdentity): boolean {
  const current = captureNoFollowDirectory(path)
  return current.kind === "ready" && sameNoFollowPathLocation(current.value, expected)
}

function contextConfigText(): string {
  return `${JSON.stringify({
    context: {
      enabled: true,
      maxCapsules: DEFAULT_CONTEXT_CONFIG.maxCapsules,
      maxChars: DEFAULT_CONTEXT_CONFIG.maxChars,
      mode: DEFAULT_CONTEXT_CONFIG.mode,
    },
  }, null, 2)}\n`
}

function preview(): ContextInitCommandResult {
  return success([
    "Context Personalization (Experimental)",
    "Initialization: preview-only",
    "Context enabled: false",
    "Context Core: available",
    "No files were written.",
    "",
  ].join("\n"))
}

function enabled(): ContextInitCommandResult {
  return success([
    "Context Personalization (Experimental)",
    "Initialization: enabled",
    "Configuration: .persona/harness.jsonc",
    "Context enabled: true",
    "No host adapter was activated.",
    "",
  ].join("\n"))
}

function success(stdout: string): ContextInitCommandResult {
  return { status: 0, stderr: "", stdout }
}

function failure(code: string): ContextInitCommandResult {
  return { status: 1, stderr: `${code}\n`, stdout: "" }
}

function removeOwnedConfig(path: string, expected: NoFollowPathIdentity): void {
  try {
    const current = lstatSync(path, { bigint: true })
    if (current.isFile() && !current.isSymbolicLink() && sameNoFollowPathLocation(expected, noFollowPathIdentityFromStat(current))) {
      unlinkSync(path)
    }
  } catch {}
}

function removeEmptyCreatedPersona(persona: PersonaDirectory): void {
  if (!persona.created || !sameDirectoryLocation(persona.path, persona.identity)) return
  try {
    rmdirSync(persona.path)
  } catch {}
}

function isAlreadyPresent(error: unknown): boolean {
  return error !== null && typeof error === "object" && "code" in error && error.code === "EEXIST"
}

function isMissing(error: unknown): boolean {
  return error !== null && typeof error === "object" && "code" in error && error.code === "ENOENT"
}
