import { lstatSync, realpathSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, posix, win32 } from "node:path"

import { PersonalizationFileError, readPersonalizationFile, withPersonalizationFileMutation } from "./personalization-file-boundary.js"
import {
  emptyPersonalizationStore,
  parsePersonalizationStore,
  PersonalizationValidationError,
  type PersonalizationStoreDocument,
} from "./personalization-profile-model.js"

export type PersonalizationStoreOptions = {
  readonly env?: Readonly<Record<string, string | undefined>>
  readonly homeDir?: string
  readonly idFactory?: () => string
  readonly now?: () => Date
  readonly platform?: NodeJS.Platform
  readonly storeRoot?: string
}

export class PersonalizationStoreError extends Error {
  readonly code: "personalization-store-unsafe" | "personalization-store-busy" | "personalization-store-corrupt" | "personalization-candidate-invalid" | "personalization-candidate-conflict" | "personalization-candidate-missing" | "personalization-resolution-invalid" | "personalization-rule-missing"

  constructor(code: PersonalizationStoreError["code"]) {
    super(code)
    this.name = "PersonalizationStoreError"
    this.code = code
  }
}

export function resolvePersonalizationStoreRoot(options: Pick<PersonalizationStoreOptions, "env" | "homeDir" | "platform"> = {}): string {
  const env = options.env ?? process.env
  const platform = options.platform ?? process.platform
  const path = platform === "win32" ? win32 : posix
  const configured = firstNonEmpty(env.PH_HOME)
  if (configured !== undefined) return safeRoot(configured, path)
  if (platform === "win32") {
    const appData = firstNonEmpty(env.APPDATA)
    if (appData !== undefined) return safeRoot(path.join(appData, "persona-harness"), path)
  }
  const xdg = firstNonEmpty(env.XDG_CONFIG_HOME)
  if (xdg !== undefined) return safeRoot(path.join(xdg, "persona-harness"), path)
  const home = firstNonEmpty(options.homeDir) ?? firstNonEmpty(env.HOME) ?? firstNonEmpty(env.USERPROFILE) ?? homedir()
  return safeRoot(path.join(home, ".config", "persona-harness"), path)
}

export function personalizationStorePath(options: PersonalizationStoreOptions = {}): string {
  const root = options.storeRoot ?? resolvePersonalizationStoreRoot(options)
  const path = options.platform === "win32" ? win32 : posix
  return path.join(assertSafeStoreRoot(root, path), "profile.json")
}

export type PersonalizationStoreSnapshot = {
  readonly status: "ready" | "missing"
  readonly document: PersonalizationStoreDocument
}

export function readPersonalizationStore(options: PersonalizationStoreOptions = {}): PersonalizationStoreDocument {
  return readPersonalizationStoreSnapshot(options).document
}

export function readPersonalizationStoreSnapshot(options: PersonalizationStoreOptions = {}): PersonalizationStoreSnapshot {
  return withStoreErrors(() => parseFileSnapshot(readPersonalizationFile(dirname(personalizationStorePath(options)))))
}

function parseFileSnapshot(file: ReturnType<typeof readPersonalizationFile>): PersonalizationStoreSnapshot {
  if (file.kind === "absent") return { status: "missing", document: emptyPersonalizationStore() }
  let parsed: unknown
  try {
    parsed = JSON.parse(file.value.bytes.toString("utf8"))
  } catch (error) {
    if (error instanceof SyntaxError) throw new PersonalizationStoreError("personalization-store-corrupt")
    throw error
  }
  try {
    return { status: "ready", document: parsePersonalizationStore(parsed) }
  } catch (error) {
    if (error instanceof PersonalizationValidationError && error.code === "personalization-store-corrupt") {
      throw new PersonalizationStoreError("personalization-store-corrupt")
    }
    throw error
  }
}

export function writePersonalizationStore(document: PersonalizationStoreDocument, options: PersonalizationStoreOptions = {}): void {
  const bytes = serializedStore(document)
  withStoreErrors(() => withPersonalizationFileMutation(dirname(personalizationStorePath(options)), (file) => file.publish(bytes)))
}

export function mutatePersonalizationStore<T extends { readonly document: PersonalizationStoreDocument }>(
  options: PersonalizationStoreOptions,
  mutation: (current: PersonalizationStoreDocument) => T,
): T {
  return withStoreErrors(() => withPersonalizationFileMutation(dirname(personalizationStorePath(options)), (file) => {
    const result = mutation(parseFileSnapshot(file.snapshot).document)
    file.publish(serializedStore(result.document))
    return result
  }))
}

function serializedStore(document: PersonalizationStoreDocument): Buffer {
  let validated: PersonalizationStoreDocument
  try {
    validated = parsePersonalizationStore(document)
  } catch (error) {
    if (error instanceof PersonalizationValidationError) throw new PersonalizationStoreError("personalization-store-corrupt")
    throw error
  }
  return Buffer.from(`${JSON.stringify(validated, null, 2)}\n`)
}

function withStoreErrors<T>(operation: () => T): T {
  try { return operation() }
  catch (error) {
    if (error instanceof PersonalizationFileError) {
      throw new PersonalizationStoreError(error.code === "busy" ? "personalization-store-busy" : "personalization-store-unsafe")
    }
    throw error
  }
}

function assertSafeStoreRoot(root: string, path: typeof posix | typeof win32): string {
  if (!path.isAbsolute(root) || root.includes("\0") || root.trim() === "") throw new PersonalizationStoreError("personalization-store-unsafe")
  const parsed = path.parse(root)
  let current = parsed.root
  if (validateExistingDirectory(current) === "missing") throw new PersonalizationStoreError("personalization-store-unsafe")
  const relativeRoot = path.relative(parsed.root, root)
  for (const segment of relativeRoot.split(path.sep).filter((value) => value.length > 0)) {
    current = path.join(current, segment)
    if (validateExistingDirectory(current) === "missing") return root
  }
  return root
}

function validateExistingDirectory(candidate: string): "present" | "missing" {
  try {
    const stat = lstatSync(candidate)
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new PersonalizationStoreError("personalization-store-unsafe")
    const canonical = realpathSync.native(candidate)
    const canonicalStat = lstatSync(canonical)
    if (canonicalStat.isSymbolicLink() || !canonicalStat.isDirectory()) throw new PersonalizationStoreError("personalization-store-unsafe")
    return "present"
  } catch (error) {
    if (error instanceof PersonalizationStoreError) throw error
    if (isMissingPathError(error)) return "missing"
    throw new PersonalizationStoreError("personalization-store-unsafe")
  }
}

function isMissingPathError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT"
}

function safeRoot(root: string, path: typeof posix | typeof win32): string {
  if (!path.isAbsolute(root) || root.includes("\0") || root.trim() === "") throw new PersonalizationStoreError("personalization-store-unsafe")
  return root
}

function firstNonEmpty(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === "" ? undefined : value
}
