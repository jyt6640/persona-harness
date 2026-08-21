import { lstatSync, readlinkSync } from "node:fs"
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path"

import {
  captureNoFollowDirectory,
  readNoFollowRegularFile,
  sameNoFollowPathIdentity,
  type NoFollowPathIdentity,
} from "../io/no-follow-file.js"

const DARWIN_TMP_ALIAS = "/tmp"
const DARWIN_TMP_PHYSICAL_ROOT = "/private/tmp"
const DARWIN_TMP_TARGET = "private/tmp"

type DarwinTemporaryAlias = {
  readonly gid: bigint
  readonly isSymbolicLink: boolean
  readonly target: string
  readonly uid: bigint
}

type AuthorityArchivePathOptions = {
  readonly darwinTemporaryAlias?: DarwinTemporaryAlias
  readonly platform?: NodeJS.Platform
}

export function readExplicitAuthorityArchive(path: string): Buffer | undefined {
  const absolutePath = canonicalAuthorityArchivePath(path)
  if (absolutePath === undefined) return undefined
  const parentPath = dirname(absolutePath)
  const chain = captureDirectoryChain(parentPath)
  if (chain === undefined) return undefined
  const source = readNoFollowRegularFile(absolutePath, 8 * 1024 * 1024, parentPath)
  if (source.kind !== "ready") return undefined
  for (const entry of chain) {
    const current = captureNoFollowDirectory(entry.path)
    if (current.kind !== "ready" || !sameNoFollowPathIdentity(entry.identity, current.value)) return undefined
  }
  return source.value.bytes
}

export function canonicalAuthorityArchivePath(
  path: string,
  options: AuthorityArchivePathOptions = {},
): string | undefined {
  const absolutePath = resolve(path)
  const platform = options.platform ?? process.platform
  if (platform !== "darwin" || !isPathWithin(DARWIN_TMP_ALIAS, absolutePath)) return absolutePath
  const alias = options.darwinTemporaryAlias ?? readDarwinTemporaryAlias()
  if (!isTrustedDarwinTemporaryAlias(alias)) return undefined
  return join(DARWIN_TMP_PHYSICAL_ROOT, relative(DARWIN_TMP_ALIAS, absolutePath))
}

function readDarwinTemporaryAlias(): DarwinTemporaryAlias | undefined {
  try {
    const stat = lstatSync(DARWIN_TMP_ALIAS, { bigint: true })
    return {
      gid: stat.gid,
      isSymbolicLink: stat.isSymbolicLink(),
      target: readlinkSync(DARWIN_TMP_ALIAS, "utf8"),
      uid: stat.uid,
    }
  } catch {
    // The platform alias is unavailable, so archive intake remains fail-closed.
    return undefined
  }
}

function isTrustedDarwinTemporaryAlias(alias: DarwinTemporaryAlias | undefined): alias is DarwinTemporaryAlias {
  return alias !== undefined
    && alias.isSymbolicLink
    && alias.uid === 0n
    && alias.gid === 0n
    && alias.target === DARWIN_TMP_TARGET
}

function isPathWithin(root: string, path: string): boolean {
  const child = relative(root, path)
  return child === "" || (child !== ".." && !child.startsWith(`..${sep}`) && !isAbsolute(child))
}

function captureDirectoryChain(path: string): readonly { readonly identity: NoFollowPathIdentity; readonly path: string }[] | undefined {
  const chain: Array<{ readonly identity: NoFollowPathIdentity; readonly path: string }> = []
  let currentPath = resolve(path)
  while (true) {
    const directory = captureNoFollowDirectory(currentPath)
    if (directory.kind !== "ready") return undefined
    chain.unshift({ identity: directory.value, path: currentPath })
    const parentPath = dirname(currentPath)
    if (parentPath === currentPath) return chain
    currentPath = parentPath
  }
}
