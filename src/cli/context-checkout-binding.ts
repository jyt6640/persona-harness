import { randomUUID } from "node:crypto"
import { closeSync, constants, fstatSync, fsyncSync, linkSync, lstatSync, openSync, realpathSync, unlinkSync, writeFileSync } from "node:fs"
import { basename, dirname, join, resolve } from "node:path"

import { isRecord } from "../config/jsonc.js"
import { canonicalContextDigest } from "../context-core/context-digest.js"
import { withNoFollowDirectoryChain } from "../io/no-follow-directory-chain.js"
import { captureNoFollowDirectory, noFollowPathIdentityFromStat, readNoFollowProjectFile, sameNoFollowPathLocation } from "../io/no-follow-file.js"
import { personalizationStorePath, type PersonalizationStoreOptions } from "./personalization-store-io.js"

const MAX_BYTES = 4_096

type ScopeBindingOptions = PersonalizationStoreOptions & { readonly taskSession?: string }
export type ContextScopeBinding = { readonly status: "unbound" } | { readonly status: "bound"; readonly scopeKey: string }

export type CheckoutProjectBinding =
  | { readonly status: "unbound" }
  | { readonly status: "bound"; readonly projectKey: string }

export class ContextScopeError extends Error {
  constructor(readonly code: "context-scope-unavailable" | "context-scope-invalid" | "context-scope-existing-binding" | "context-scope-key-mismatch") {
    super(code)
    this.name = "ContextScopeError"
  }
}

export function readCheckoutProjectBinding(projectDir: string, options: PersonalizationStoreOptions = {}): CheckoutProjectBinding {
  const result = readContextScopeBinding(projectDir, options)
  return result.status === "bound" ? { status: "bound", projectKey: result.scopeKey } : result
}

export function changeCheckoutProjectBinding(
  projectDir: string,
  change: { readonly action: "bind" | "unbind"; readonly projectKey: string },
  options: PersonalizationStoreOptions = {},
): CheckoutProjectBinding {
  const result = changeContextScopeBinding(projectDir, { action: change.action, scopeKey: change.projectKey }, options)
  return result.status === "bound" ? { status: "bound", projectKey: result.scopeKey } : result
}

export function readContextScopeBinding(projectDir: string, options: ScopeBindingOptions): ContextScopeBinding {
  const location = bindingLocation(projectDir, options)
  const file = readNoFollowProjectFile(location.root, location.relativePath, MAX_BYTES)
  switch (file.kind) {
    case "absent": return { status: "unbound" }
    case "blocked": throw new ContextScopeError("context-scope-unavailable")
    case "ready": return parseBinding(file.value.bytes, location)
    default: return assertNever(file)
  }
}

export function changeContextScopeBinding(
  projectDir: string,
  change: { readonly action: "bind" | "unbind"; readonly scopeKey: string },
  options: ScopeBindingOptions,
): ContextScopeBinding {
  const checkoutPath = resolve(projectDir)
  const location = bindingLocation(checkoutPath, options)
  const root = captureNoFollowDirectory(location.root)
  if (root.kind !== "ready") throw new ContextScopeError("context-scope-unavailable")
  const existing = readContextScopeBinding(checkoutPath, options)
  if (existing.status === "bound" && existing.scopeKey !== change.scopeKey) {
    throw new ContextScopeError(change.action === "bind" ? "context-scope-existing-binding" : "context-scope-key-mismatch")
  }
  if (existing.status === "unbound" && change.action === "unbind") return existing
  if (existing.status === "bound" && change.action === "bind") return existing

  const result = withNoFollowDirectoryChain(join(location.root, location.directory), 0o700, () => {
    const parent = captureNoFollowDirectory("..")
    if (parent.kind !== "ready" || !sameNoFollowPathLocation(root.value, parent.value)
      || bindingLocation(checkoutPath, options).bindingDigest !== location.bindingDigest) {
      throw new ContextScopeError("context-scope-unavailable")
    }
    const leaf = basename(location.relativePath)
    const lock = `${leaf}.lock`
    const lockDescriptor = openSync(lock, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
    try {
      const latest = readContextScopeBinding(checkoutPath, options)
      if (latest.status === "bound" && latest.scopeKey !== change.scopeKey) {
        throw new ContextScopeError(change.action === "bind" ? "context-scope-existing-binding" : "context-scope-key-mismatch")
      }
      if (latest.status === "unbound" && change.action === "unbind") return latest
      if (latest.status === "bound" && change.action === "bind") return latest
      switch (change.action) {
        case "bind": {
          const temporary = `.binding-${randomUUID()}.tmp`
          const descriptor = openSync(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
          let temporaryPresent = true
          try {
            writeFileSync(descriptor, `${JSON.stringify({ schemaVersion: location.schema, [location.digestField]: location.bindingDigest, [location.keyField]: change.scopeKey })}\n`)
            fsyncSync(descriptor)
            // Publish complete bytes without replacing any existing binding.
            linkSync(temporary, leaf)
            unlinkSync(temporary)
            temporaryPresent = false
            const opened = fstatSync(descriptor, { bigint: true })
            const current = lstatSync(leaf, { bigint: true })
            if (!opened.isFile() || opened.nlink !== 1n || current.isSymbolicLink()
              || !sameNoFollowPathLocation(noFollowPathIdentityFromStat(opened), noFollowPathIdentityFromStat(current))) {
              throw new ContextScopeError("context-scope-unavailable")
            }
          } finally {
            closeSync(descriptor)
            if (temporaryPresent) unlinkSync(temporary)
          }
          return { status: "bound", scopeKey: change.scopeKey } as const
        }
        case "unbind": {
          const file = readNoFollowProjectFile(location.root, location.relativePath, MAX_BYTES)
          if (file.kind !== "ready" || parseBinding(file.value.bytes, location).scopeKey !== change.scopeKey) {
            throw new ContextScopeError("context-scope-unavailable")
          }
          unlinkSync(leaf)
          return { status: "unbound" } as const
        }
        default: return assertNever(change.action)
      }
    } finally {
      closeSync(lockDescriptor)
      unlinkSync(lock)
    }
  })
  if (result === undefined) throw new ContextScopeError("context-scope-unavailable")
  return result
}

function bindingLocation(projectDir: string, options: ScopeBindingOptions) {
  if (options.taskSession !== undefined && !/^[a-f0-9]{64}$/u.test(options.taskSession)) throw new ContextScopeError("context-scope-invalid")
  const projectPath = resolve(projectDir)
  const captured = captureNoFollowDirectory(projectPath)
  if (captured.kind !== "ready") throw new ContextScopeError("context-scope-unavailable")
  let canonicalPath: string
  let birthtime: string
  try {
    canonicalPath = realpathSync.native(projectPath)
    const stat = lstatSync(canonicalPath, { bigint: true })
    if (!stat.isDirectory() || !sameNoFollowPathLocation(captured.value, noFollowPathIdentityFromStat(stat))) {
      throw new ContextScopeError("context-scope-unavailable")
    }
    birthtime = stat.birthtimeNs.toString()
  } catch (error) {
    if (error instanceof ContextScopeError) throw error
    throw new ContextScopeError("context-scope-unavailable")
  }
  const checkoutDigest = canonicalContextDigest({ path: canonicalPath, dev: captured.value.dev, ino: captured.value.ino, birthtime })
  const root = dirname(personalizationStorePath(options))
  const task = options.taskSession !== undefined
  const bindingDigest = task ? canonicalContextDigest({ checkoutDigest, sessionHandle: options.taskSession }) : checkoutDigest
  const directory = task ? "task-bindings" : "project-bindings"
  return {
    root, bindingDigest, directory, relativePath: `${directory}/${bindingDigest}.json`,
    schema: task ? "persona-context-task-binding.1" : "persona-context-checkout-binding.1",
    digestField: task ? "bindingDigest" : "checkoutDigest",
    keyField: task ? "taskKey" : "projectKey",
  }
}

function parseBinding(bytes: Buffer, location: ReturnType<typeof bindingLocation>): Extract<ContextScopeBinding, { readonly status: "bound" }> {
  let value: unknown
  try {
    value = JSON.parse(bytes.toString("utf8"))
  } catch (error) {
    if (error instanceof SyntaxError) throw new ContextScopeError("context-scope-invalid")
    throw error
  }
  if (!isRecord(value) || Object.keys(value).length !== 3
    || value.schemaVersion !== location.schema || value[location.digestField] !== location.bindingDigest) {
    throw new ContextScopeError("context-scope-invalid")
  }
  const scopeKey = value[location.keyField]
  if (typeof scopeKey !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/u.test(scopeKey)) throw new ContextScopeError("context-scope-invalid")
  return { status: "bound", scopeKey }
}

function assertNever(value: never): never {
  throw new ContextScopeError("context-scope-invalid")
}
