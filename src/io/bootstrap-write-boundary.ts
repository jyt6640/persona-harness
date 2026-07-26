import {
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  ftruncateSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { isAbsolute, join, resolve } from "node:path"
import process from "node:process"

import {
  captureNoFollowDirectory,
  noFollowPathIdentityFromStat,
  sameNoFollowPathIdentity,
  sameNoFollowPathLocation,
  type NoFollowPathIdentity,
} from "./no-follow-file.js"

type DirectoryReservation = {
  readonly descriptor: number
  readonly identity: NoFollowPathIdentity
  readonly path: string
}

type ExistingFile = { readonly kind: "absent" } | { readonly identity: NoFollowPathIdentity; readonly kind: "ready" }

type CurrentFile =
  | { readonly kind: "absent" }
  | { readonly bytes: Buffer; readonly identity: NoFollowPathIdentity; readonly kind: "ready" }

export type FreshBootstrapPersonaFile = {
  readonly bytes: Buffer
  readonly relativePath: string
}

export class BootstrapWriteBoundaryError extends Error {
  constructor() {
    super("bootstrap workspace is unsafe")
    this.name = "BootstrapWriteBoundaryError"
  }
}

export class BootstrapWriteBoundary {
  readonly #persona: DirectoryReservation
  readonly #project: DirectoryReservation
  readonly #workflow: DirectoryReservation
  #closed = false

  constructor(project: DirectoryReservation, persona: DirectoryReservation, workflow: DirectoryReservation) {
    this.#project = project
    this.#persona = persona
    this.#workflow = workflow
  }

  close(): void {
    if (this.#closed) return
    this.#closed = true
    closeSync(this.#workflow.descriptor)
    closeSync(this.#persona.descriptor)
    closeSync(this.#project.descriptor)
  }

  assert(): void {
    this.#assertActive()
  }

  assertSafePersonaFile(relativePath: string): void {
    this.#assertActive()
    const { directory, leaf, reservations } = this.#reserveExistingPersonaParent(relativePath)
    try {
      if (directory === undefined) return
      this.#assertAll([...reservations, directory])
      this.#readExistingFile(join(directory.path, leaf))
    } finally {
      closeTemporaryReservations(reservations)
    }
  }

  assertSafeWorkflowFile(name: string): void {
    this.#assertActive()
    assertLeafName(name)
    this.#assertAll([this.#workflow])
    this.#readExistingFile(join(this.#workflow.path, name))
  }

  writePersonaFile(relativePath: string, text: string): void {
    this.#writeProjectFile(`.persona/${relativePath}`, text, false)
  }

  writeWorkflowFile(name: string, text: string): void {
    assertLeafName(name)
    this.#writeProjectFile(`.persona/workflow/${name}`, text, false)
  }

  writeRootFile(relativePath: string, bytes: Buffer): boolean {
    return this.#writeProjectFile(relativePath, bytes, true)
  }

  #assertActive(): void {
    if (this.#closed) throw new BootstrapWriteBoundaryError()
    this.#assertAll([this.#project, this.#persona, this.#workflow])
  }

  #reserveExistingPersonaParent(relativePath: string): {
    readonly directory: DirectoryReservation | undefined
    readonly leaf: string
    readonly reservations: readonly DirectoryReservation[]
  } {
    const segments = validatedRelativeSegments(relativePath)
    const leaf = segments.pop()
    if (leaf === undefined) throw new BootstrapWriteBoundaryError()
    let parent = this.#persona
    const reservations: DirectoryReservation[] = []
    for (const segment of segments) {
      const path = join(parent.path, segment)
      const captured = captureNoFollowDirectory(path)
      if (captured.kind === "absent") return { directory: undefined, leaf, reservations }
      if (captured.kind !== "ready") throw new BootstrapWriteBoundaryError()
      const next = reserveCanonicalDirectory(path)
      reservations.push(next)
      parent = next
    }
    return { directory: parent, leaf, reservations }
  }

  #writeProjectFile(relativePath: string, content: string | Buffer, rootOnly: boolean): boolean {
    this.#assertActive()
    const segments = validatedRelativeSegments(relativePath)
    if (rootOnly && segments[0] === ".persona") throw new BootstrapWriteBoundaryError()
    const leaf = segments.pop()
    if (leaf === undefined) throw new BootstrapWriteBoundaryError()
    return withReservedProjectDirectory(this.#project, () => {
      const reservations: DirectoryReservation[] = []
      try {
        let parent = this.#project
        for (const segment of segments) {
          const reservation = reserveOrCreateCurrentChildDirectory(parent, segment)
          reservations.push(reservation)
          parent = reservation
        }
        return this.#writeCurrentFile(leaf, content, reservations)
      } finally {
        leaveCurrentReservations(this.#project, reservations)
      }
    })
  }

  #writeCurrentFile(name: string, content: string | Buffer, reservations: readonly DirectoryReservation[]): boolean {
    const expected = this.#readCurrentFile(name, reservations)
    const nextBytes = typeof content === "string" ? Buffer.from(content, "utf8") : content
    if (expected.kind === "ready" && expected.bytes.equals(nextBytes)) return false
    let descriptor: number | undefined
    try {
      this.#assertAll([this.#project, this.#persona, this.#workflow, ...reservations])
      descriptor = openSync(
        name,
        expected.kind === "absent"
          ? constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW
          : constants.O_WRONLY | constants.O_NOFOLLOW,
        0o644,
      )
      const descriptorIdentity = noFollowPathIdentityFromStat(fstatSync(descriptor, { bigint: true }))
      const current = noFollowPathIdentityFromStat(lstatSync(name, { bigint: true }))
      if (
        !sameNoFollowPathIdentity(descriptorIdentity, current)
        || (expected.kind === "ready" && !sameNoFollowPathIdentity(expected.identity, descriptorIdentity))
        || (expected.kind === "absent" && descriptorIdentity.size !== "0")
      ) {
        throw new BootstrapWriteBoundaryError()
      }
      this.#assertAll([this.#project, this.#persona, this.#workflow, ...reservations])
      ftruncateSync(descriptor, 0)
      writeFileSync(descriptor, nextBytes)
      fsyncSync(descriptor)
      const after = noFollowPathIdentityFromStat(fstatSync(descriptor, { bigint: true }))
      const pathAfter = noFollowPathIdentityFromStat(lstatSync(name, { bigint: true }))
      if (!sameNoFollowPathIdentity(after, pathAfter)) throw new BootstrapWriteBoundaryError()
      this.#assertAll([this.#project, this.#persona, this.#workflow, ...reservations])
      return true
    } catch (error) {
      if (error instanceof BootstrapWriteBoundaryError) throw error
      throw new BootstrapWriteBoundaryError()
    } finally {
      if (descriptor !== undefined) closeSync(descriptor)
    }
  }

  #readCurrentFile(name: string, reservations: readonly DirectoryReservation[]): CurrentFile {
    let descriptor: number | undefined
    try {
      const currentStat = lstatSync(name, { bigint: true })
      if (!currentStat.isFile() || currentStat.isSymbolicLink()) throw new BootstrapWriteBoundaryError()
      const current = noFollowPathIdentityFromStat(currentStat)
      this.#assertAll([this.#project, this.#persona, this.#workflow, ...reservations])
      descriptor = openSync(name, constants.O_RDONLY | constants.O_NOFOLLOW)
      const descriptorIdentity = noFollowPathIdentityFromStat(fstatSync(descriptor, { bigint: true }))
      const afterOpen = noFollowPathIdentityFromStat(lstatSync(name, { bigint: true }))
      if (!sameNoFollowPathIdentity(current, descriptorIdentity) || !sameNoFollowPathIdentity(current, afterOpen)) {
        throw new BootstrapWriteBoundaryError()
      }
      const bytes = readFileSync(descriptor)
      this.#assertAll([this.#project, this.#persona, this.#workflow, ...reservations])
      return { bytes, identity: descriptorIdentity, kind: "ready" }
    } catch (error) {
      if (errorCode(error) === "ENOENT") return { kind: "absent" }
      if (error instanceof BootstrapWriteBoundaryError) throw error
      throw new BootstrapWriteBoundaryError()
    } finally {
      if (descriptor !== undefined) closeSync(descriptor)
    }
  }

  #readExistingFile(path: string): ExistingFile {
    try {
      const stat = lstatSync(path, { bigint: true })
      if (!stat.isFile() || stat.isSymbolicLink()) throw new BootstrapWriteBoundaryError()
      return { identity: noFollowPathIdentityFromStat(stat), kind: "ready" }
    } catch (error) {
      if (errorCode(error) === "ENOENT") return { kind: "absent" }
      if (error instanceof BootstrapWriteBoundaryError) throw error
      throw new BootstrapWriteBoundaryError()
    }
  }

  #assertAll(reservations: readonly DirectoryReservation[]): void {
    for (const reservation of reservations) assertDirectoryReservation(reservation)
  }
}

export function reserveBootstrapWriteBoundary(projectDir: string): BootstrapWriteBoundary {
  const project = reserveProjectDirectory(resolve(projectDir))
  const persona = reserveCanonicalDirectory(join(project.path, ".persona"))
  const workflow = reserveOrCreateChildDirectory(persona, "workflow")
  return new BootstrapWriteBoundary(project, persona, workflow)
}

export function materializeFreshBootstrapWriteBoundary(
  projectDir: string,
  files: readonly FreshBootstrapPersonaFile[],
): BootstrapWriteBoundary {
  const project = reserveProjectDirectory(resolve(projectDir))
  let stagingPath: string | undefined
  let persona: DirectoryReservation | undefined
  let workflow: DirectoryReservation | undefined
  try {
    withReservedProjectDirectory(project, () => {
      assertCurrentChildAbsent(".persona")
      stagingPath = mkdtempSync(join(tmpdir(), "persona-bootstrap-staging-"))
      for (const file of [...files].sort((left, right) => left.relativePath.localeCompare(right.relativePath))) {
        writeFreshPersonaStagingFile(stagingPath, file)
      }
      assertDirectoryReservation(project)
      assertCurrentChildAbsent(".persona")
      renameSync(stagingPath, ".persona")
      stagingPath = undefined
    })
    persona = reserveChildDirectory(project, ".persona")
    workflow = reserveOrCreateChildDirectory(persona, "workflow")
    const boundary = new BootstrapWriteBoundary(project, persona, workflow)
    persona = undefined
    workflow = undefined
    return boundary
  } catch (error) {
    if (stagingPath !== undefined) {
      try {
        rmSync(stagingPath, { force: true, recursive: true })
      } catch {}
    }
    if (workflow !== undefined) canonicalClose(workflow)
    if (persona !== undefined) canonicalClose(persona)
    canonicalClose(project)
    if (error instanceof BootstrapWriteBoundaryError) throw error
    throw new BootstrapWriteBoundaryError()
  }
}

function writeFreshPersonaStagingFile(stagingPath: string, file: FreshBootstrapPersonaFile): void {
  if (!file.relativePath.startsWith(".persona/")) throw new BootstrapWriteBoundaryError()
  const segments = validatedRelativeSegments(file.relativePath.slice(".persona/".length))
  const leaf = segments.pop()
  if (leaf === undefined) throw new BootstrapWriteBoundaryError()
  let parent = stagingPath
  try {
    for (const segment of segments) {
      parent = join(parent, segment)
      mkdirSync(parent, { mode: 0o700, recursive: true })
    }
    const path = join(parent, leaf)
    const descriptor = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
    try {
      writeFileSync(descriptor, file.bytes)
      fsyncSync(descriptor)
    } finally {
      closeSync(descriptor)
    }
  } catch (error) {
    if (error instanceof BootstrapWriteBoundaryError) throw error
    throw new BootstrapWriteBoundaryError()
  }
}

function withReservedProjectDirectory<T>(project: DirectoryReservation, operation: () => T): T {
  let previous: DirectoryReservation | undefined
  try {
    previous = reserveCurrentDirectory()
    assertDirectoryReservation(project)
    process.chdir(project.path)
    assertCurrentDirectory(project)
    return operation()
  } catch (error) {
    if (error instanceof BootstrapWriteBoundaryError) throw error
    throw new BootstrapWriteBoundaryError()
  } finally {
    if (previous !== undefined) {
      restoreCurrentDirectory(previous)
      closeSync(previous.descriptor)
    }
  }
}

function reserveCurrentDirectory(): DirectoryReservation {
  const path = process.cwd()
  const current = captureNoFollowDirectory(path)
  if (current.kind !== "ready") throw new BootstrapWriteBoundaryError()
  let descriptor: number | undefined
  try {
    descriptor = openSync(".", constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW)
    const descriptorIdentity = noFollowPathIdentityFromStat(fstatSync(descriptor, { bigint: true }))
    if (!sameNoFollowPathLocation(current.value, descriptorIdentity)) throw new BootstrapWriteBoundaryError()
    const reservation = { descriptor, identity: descriptorIdentity, path }
    descriptor = undefined
    return reservation
  } catch (error) {
    if (error instanceof BootstrapWriteBoundaryError) throw error
    throw new BootstrapWriteBoundaryError()
  } finally {
    if (descriptor !== undefined) closeSync(descriptor)
  }
}

function restoreCurrentDirectory(previous: DirectoryReservation): void {
  try {
    const current = captureNoFollowDirectory(previous.path)
    if (current.kind === "ready" && sameNoFollowPathLocation(current.value, previous.identity)) {
      process.chdir(previous.path)
      assertCurrentDirectory(previous)
      return
    }
  } catch {}
  try {
    process.chdir("/")
  } catch {}
}

function assertCurrentDirectory(reservation: DirectoryReservation): void {
  let descriptor: number | undefined
  try {
    descriptor = openSync(".", constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW)
    const current = noFollowPathIdentityFromStat(fstatSync(descriptor, { bigint: true }))
    if (!sameNoFollowPathLocation(reservation.identity, current)) throw new BootstrapWriteBoundaryError()
  } catch (error) {
    if (error instanceof BootstrapWriteBoundaryError) throw error
    throw new BootstrapWriteBoundaryError()
  } finally {
    if (descriptor !== undefined) closeSync(descriptor)
  }
}

function assertCurrentChildAbsent(name: string): void {
  assertLeafName(name)
  try {
    lstatSync(name, { bigint: true })
    throw new BootstrapWriteBoundaryError()
  } catch (error) {
    if (error instanceof BootstrapWriteBoundaryError) throw error
    if (errorCode(error) !== "ENOENT") throw new BootstrapWriteBoundaryError()
  }
}

function reserveOrCreateCurrentChildDirectory(parent: DirectoryReservation, name: string): DirectoryReservation {
  assertLeafName(name)
  assertCurrentDirectory(parent)
  assertDirectoryReservation(parent)
  try {
    mkdirSync(name, { mode: 0o700 })
  } catch (error) {
    if (errorCode(error) !== "EEXIST") throw new BootstrapWriteBoundaryError()
  }
  let descriptor: number | undefined
  try {
    const beforeStat = lstatSync(name, { bigint: true })
    if (!beforeStat.isDirectory() || beforeStat.isSymbolicLink()) throw new BootstrapWriteBoundaryError()
    const before = noFollowPathIdentityFromStat(beforeStat)
    descriptor = openSync(name, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW)
    const descriptorIdentity = noFollowPathIdentityFromStat(fstatSync(descriptor, { bigint: true }))
    const after = noFollowPathIdentityFromStat(lstatSync(name, { bigint: true }))
    if (!sameNoFollowPathIdentity(before, after) || !sameNoFollowPathLocation(after, descriptorIdentity)) {
      throw new BootstrapWriteBoundaryError()
    }
    const reservation = { descriptor, identity: after, path: join(parent.path, name) }
    process.chdir(name)
    assertCurrentDirectory(reservation)
    descriptor = undefined
    return reservation
  } catch (error) {
    if (error instanceof BootstrapWriteBoundaryError) throw error
    throw new BootstrapWriteBoundaryError()
  } finally {
    if (descriptor !== undefined) closeSync(descriptor)
  }
}

function leaveCurrentReservations(project: DirectoryReservation, reservations: readonly DirectoryReservation[]): void {
  let failureAt: number | undefined
  for (let index = reservations.length - 1; index >= 0; index -= 1) {
    const reservation = reservations[index]
    const parent = index === 0 ? project : reservations[index - 1]
    try {
      process.chdir("..")
      assertCurrentDirectory(parent)
    } catch {
      failureAt = index
    } finally {
      closeSync(reservation.descriptor)
    }
    if (failureAt !== undefined) break
  }
  if (failureAt !== undefined) {
    for (let index = failureAt - 1; index >= 0; index -= 1) {
      try {
        closeSync(reservations[index].descriptor)
      } catch {}
    }
    throw new BootstrapWriteBoundaryError()
  }
}

function reserveProjectDirectory(path: string): DirectoryReservation {
  if (!isAbsolute(path)) throw new BootstrapWriteBoundaryError()
  const requested = captureNoFollowDirectory(path)
  if (requested.kind !== "ready") throw new BootstrapWriteBoundaryError()
  try {
    const canonicalPath = realpathSync(path)
    const canonical = reserveCanonicalDirectory(canonicalPath)
    if (!sameNoFollowPathLocation(requested.value, canonical.identity)) {
      canonicalClose(canonical)
      throw new BootstrapWriteBoundaryError()
    }
    return canonical
  } catch (error) {
    if (error instanceof BootstrapWriteBoundaryError) throw error
    throw new BootstrapWriteBoundaryError()
  }
}

function reserveCanonicalDirectory(path: string): DirectoryReservation {
  if (!isAbsolute(path)) throw new BootstrapWriteBoundaryError()
  const before = captureNoFollowDirectory(path)
  if (before.kind !== "ready") throw new BootstrapWriteBoundaryError()
  let descriptor: number | undefined
  try {
    descriptor = openSync(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW)
    const descriptorIdentity = noFollowPathIdentityFromStat(fstatSync(descriptor, { bigint: true }))
    const after = captureNoFollowDirectory(path)
    if (
      after.kind !== "ready"
      || realpathSync(path) !== path
      || !sameNoFollowPathIdentity(before.value, after.value)
      || !sameNoFollowPathLocation(after.value, descriptorIdentity)
    ) {
      throw new BootstrapWriteBoundaryError()
    }
    const reservation = { descriptor, identity: after.value, path }
    descriptor = undefined
    return reservation
  } catch (error) {
    if (error instanceof BootstrapWriteBoundaryError) throw error
    throw new BootstrapWriteBoundaryError()
  } finally {
    if (descriptor !== undefined) closeSync(descriptor)
  }
}

function reserveChildDirectory(parent: DirectoryReservation, name: string): DirectoryReservation {
  assertLeafName(name)
  assertDirectoryReservation(parent)
  return reserveCanonicalDirectory(join(parent.path, name))
}

function reserveOrCreateChildDirectory(parent: DirectoryReservation, name: string): DirectoryReservation {
  assertLeafName(name)
  assertDirectoryReservation(parent)
  const path = join(parent.path, name)
  try {
    mkdirSync(path, { mode: 0o700 })
  } catch (error) {
    if (errorCode(error) !== "EEXIST") throw new BootstrapWriteBoundaryError()
  }
  assertDirectoryReservation(parent)
  return reserveCanonicalDirectory(path)
}

function assertDirectoryReservation(reservation: DirectoryReservation): void {
  try {
    const descriptorIdentity = noFollowPathIdentityFromStat(fstatSync(reservation.descriptor, { bigint: true }))
    const current = captureNoFollowDirectory(reservation.path)
    if (
      current.kind !== "ready"
      || realpathSync(reservation.path) !== reservation.path
      || !sameNoFollowPathLocation(reservation.identity, descriptorIdentity)
      || !sameNoFollowPathLocation(reservation.identity, current.value)
    ) {
      throw new BootstrapWriteBoundaryError()
    }
  } catch (error) {
    if (error instanceof BootstrapWriteBoundaryError) throw error
    throw new BootstrapWriteBoundaryError()
  }
}

function closeTemporaryReservations(reservations: readonly DirectoryReservation[]): void {
  for (const reservation of [...reservations].reverse()) closeSync(reservation.descriptor)
}

function canonicalClose(reservation: DirectoryReservation): void {
  closeSync(reservation.descriptor)
}

function validatedRelativeSegments(path: string): string[] {
  const segments = path.split("/")
  if (segments.length === 0 || segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new BootstrapWriteBoundaryError()
  }
  return segments
}

function assertLeafName(name: string): void {
  if (name.length === 0 || name.includes("/") || name.includes("\\")) throw new BootstrapWriteBoundaryError()
}

function errorCode(error: unknown): string | undefined {
  return error !== null && typeof error === "object" && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined
}
