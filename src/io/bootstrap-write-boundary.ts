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
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { randomUUID } from "node:crypto"
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

export type ProjectReadFile = {
  readonly bytes: Buffer
  readonly identity: NoFollowPathIdentity
}

export type FreshBootstrapPersonaFile = {
  readonly bytes: Buffer
  readonly relativePath: string
}

export type ProjectReadTreeEntry =
  | {
      readonly identity: NoFollowPathIdentity
      readonly kind: "directory"
      readonly path: string
    }
  | {
      readonly bytes: Buffer
      readonly identity: NoFollowPathIdentity
      readonly kind: "file"
      readonly path: string
    }

export type ProjectReadTreeOptions = {
  readonly isExcluded: (relativePath: string) => boolean
  readonly maxEntries: number
  readonly maxFileBytes: number
  readonly maxTotalBytes: number
}

export class BootstrapWriteBoundaryError extends Error {
  constructor() {
    super("bootstrap workspace is unsafe")
    this.name = "BootstrapWriteBoundaryError"
  }
}

export class ProjectReadBoundaryError extends Error {
  constructor() {
    super("project source read boundary is unsafe")
    this.name = "ProjectReadBoundaryError"
  }
}

export class ProjectReadBoundaryLimitError extends Error {
  constructor() {
    super("bootstrap project read exceeds a bounded limit")
    this.name = "ProjectReadBoundaryLimitError"
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

  withCapturedProject<T>(operation: () => T): T {
    this.#assertActive()
    return withReservedProjectDirectory(this.#project, () => {
      this.#assertActive()
      const result = operation()
      this.#assertActive()
      return result
    })
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

  writeProjectFile(relativePath: string, content: string | Buffer): boolean {
    return this.#writeProjectFile(relativePath, content, false)
  }

  writeProjectFileAtomically(relativePath: string, content: string | Buffer): boolean {
    return this.#writeProjectFileAtomically(relativePath, content, false)
  }

  readProjectFile(relativePath: string): Buffer | undefined {
    this.#assertActive()
    const segments = validatedRelativeSegments(relativePath)
    const leaf = segments.pop()
    if (leaf === undefined) throw new BootstrapWriteBoundaryError()
    return withReservedProjectDirectory(this.#project, () => {
      const reservations: DirectoryReservation[] = []
      try {
        let parent = this.#project
        for (const segment of segments) {
          const reservation = reserveExistingCurrentChildDirectory(parent, segment)
          if (reservation === undefined) return undefined
          reservations.push(reservation)
          parent = reservation
        }
        const current = this.#readCurrentFile(leaf, reservations)
        return current.kind === "ready" ? current.bytes : undefined
      } finally {
        leaveCurrentReservations(this.#project, reservations)
      }
    })
  }

  projectFileExists(relativePath: string): boolean {
    return this.readProjectFile(relativePath) !== undefined
  }

  assertSafeProjectDirectoryPath(relativePath: string): void {
    this.#assertActive()
    const segments = validatedRelativeSegments(relativePath)
    withReservedProjectDirectory(this.#project, () => {
      const reservations: DirectoryReservation[] = []
      try {
        let parent = this.#project
        for (const segment of segments) {
          const reservation = reserveExistingCurrentChildDirectory(parent, segment)
          if (reservation === undefined) return
          reservations.push(reservation)
          parent = reservation
        }
        this.#assertAll([this.#project, this.#persona, this.#workflow, ...reservations])
      } finally {
        leaveCurrentReservations(this.#project, reservations)
      }
    })
  }

  listProjectRegularFiles(
    relativeRoots: readonly string[],
    suffix: string,
    maxEntries: number,
  ): readonly string[] {
    if (!Number.isInteger(maxEntries) || maxEntries <= 0 || suffix.length === 0) {
      throw new BootstrapWriteBoundaryError()
    }
    this.#assertActive()
    return withReservedProjectDirectory(this.#project, () => {
      const files: string[] = []
      for (const relativeRoot of relativeRoots) {
        if (files.length >= maxEntries) break
        const segments = validatedRelativeSegments(relativeRoot)
        const reservations: DirectoryReservation[] = []
        try {
          let parent = this.#project
          let absent = false
          for (const segment of segments) {
            const reservation = reserveExistingCurrentChildDirectory(parent, segment)
            if (reservation === undefined) {
              absent = true
              break
            }
            reservations.push(reservation)
            parent = reservation
          }
          if (!absent) {
            this.#collectCurrentRegularFiles(relativeRoot, parent, reservations, suffix, maxEntries, files)
          }
        } finally {
          leaveCurrentReservations(this.#project, reservations)
        }
      }
      return files
    })
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

  #writeProjectFileAtomically(relativePath: string, content: string | Buffer, rootOnly: boolean): boolean {
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
        return this.#writeCurrentFileAtomically(leaf, content, reservations)
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

  #writeCurrentFileAtomically(name: string, content: string | Buffer, reservations: readonly DirectoryReservation[]): boolean {
    const expected = this.#readCurrentFile(name, reservations)
    const nextBytes = typeof content === "string" ? Buffer.from(content, "utf8") : content
    if (expected.kind === "ready" && expected.bytes.equals(nextBytes)) return false
    const temporaryName = `.${name}.${randomUUID()}.tmp`
    let descriptor: number | undefined
    let temporaryIdentity: NoFollowPathIdentity | undefined
    let renamed = false
    try {
      this.#assertAll([this.#project, this.#persona, this.#workflow, ...reservations])
      descriptor = openSync(
        temporaryName,
        constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
        0o600,
      )
      temporaryIdentity = noFollowPathIdentityFromStat(fstatSync(descriptor, { bigint: true }))
      const temporaryPathIdentity = noFollowPathIdentityFromStat(lstatSync(temporaryName, { bigint: true }))
      if (!sameNoFollowPathIdentity(temporaryIdentity, temporaryPathIdentity) || temporaryIdentity.size !== "0") {
        throw new BootstrapWriteBoundaryError()
      }
      writeFileSync(descriptor, nextBytes)
      fsyncSync(descriptor)
      const afterWrite = noFollowPathIdentityFromStat(fstatSync(descriptor, { bigint: true }))
      const temporaryAfterWrite = noFollowPathIdentityFromStat(lstatSync(temporaryName, { bigint: true }))
      if (!sameNoFollowPathIdentity(afterWrite, temporaryAfterWrite)) throw new BootstrapWriteBoundaryError()
      temporaryIdentity = afterWrite
      const current = this.#readCurrentFile(name, reservations)
      if (
        (expected.kind === "absent" && current.kind !== "absent")
        || (expected.kind === "ready" && (current.kind !== "ready" || !sameNoFollowPathIdentity(expected.identity, current.identity)))
      ) {
        throw new BootstrapWriteBoundaryError()
      }
      this.#assertAll([this.#project, this.#persona, this.#workflow, ...reservations])
      renameSync(temporaryName, name)
      renamed = true
      const promoted = noFollowPathIdentityFromStat(lstatSync(name, { bigint: true }))
      const promotedDescriptor = noFollowPathIdentityFromStat(fstatSync(descriptor, { bigint: true }))
      if (!sameNoFollowPathIdentity(promotedDescriptor, promoted)) throw new BootstrapWriteBoundaryError()
      this.#assertAll([this.#project, this.#persona, this.#workflow, ...reservations])
      return true
    } catch (error) {
      if (error instanceof BootstrapWriteBoundaryError) throw error
      throw new BootstrapWriteBoundaryError()
    } finally {
      if (descriptor !== undefined) closeSync(descriptor)
      if (!renamed && temporaryIdentity !== undefined) {
        try {
          const current = lstatSync(temporaryName, { bigint: true })
          if (current.isFile() && !current.isSymbolicLink() && sameNoFollowPathIdentity(temporaryIdentity, noFollowPathIdentityFromStat(current))) {
            unlinkSync(temporaryName)
          }
        } catch {}
      }
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

  #collectCurrentRegularFiles(
    relativeDirectory: string,
    directory: DirectoryReservation,
    reservations: DirectoryReservation[],
    suffix: string,
    maxEntries: number,
    files: string[],
  ): void {
    this.#assertAll([this.#project, this.#persona, this.#workflow, ...reservations])
    for (const entry of readdirSync(".").sort()) {
      if (files.length >= maxEntries) return
      assertLeafName(entry)
      const stat = lstatSync(entry, { bigint: true })
      if (stat.isSymbolicLink()) throw new BootstrapWriteBoundaryError()
      const relativePath = `${relativeDirectory}/${entry}`
      if (stat.isDirectory()) {
        const child = reserveExistingCurrentChildDirectory(directory, entry)
        if (child === undefined) throw new BootstrapWriteBoundaryError()
        reservations.push(child)
        try {
          this.#collectCurrentRegularFiles(relativePath, child, reservations, suffix, maxEntries, files)
        } finally {
          reservations.pop()
          try {
            process.chdir("..")
            assertCurrentDirectory(directory)
          } catch {
            throw new BootstrapWriteBoundaryError()
          } finally {
            closeSync(child.descriptor)
          }
        }
        continue
      }
      if (!stat.isFile()) throw new BootstrapWriteBoundaryError()
      if (entry.endsWith(suffix)) files.push(relativePath)
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

export class ProjectReadBoundary {
  readonly #project: DirectoryReservation
  #closed = false

  constructor(project: DirectoryReservation) {
    this.#project = project
  }

  close(): void {
    if (this.#closed) return
    this.#closed = true
    closeSync(this.#project.descriptor)
  }

  assert(): void {
    this.#assertActive()
  }

  projectIdentity(): NoFollowPathIdentity {
    this.#assertActive()
    return this.#project.identity
  }

  withCapturedProject<T>(operation: () => T): T {
    this.#assertActive()
    return withReservedProjectDirectory(this.#project, () => {
      this.#assertActive()
      const result = operation()
      this.#assertActive()
      return result
    })
  }

  readProjectFile(relativePath: string, maxBytes?: number): Buffer | undefined {
    return this.readProjectFileWithIdentity(relativePath, maxBytes)?.bytes
  }

  readProjectFileWithIdentity(relativePath: string, maxBytes?: number): ProjectReadFile | undefined {
    this.#assertActive()
    const segments = validatedRelativeSegments(relativePath)
    const leaf = segments.pop()
    if (leaf === undefined) throw new ProjectReadBoundaryError()
    return withReservedProjectDirectory(this.#project, () => {
      const reservations: DirectoryReservation[] = []
      try {
        let parent = this.#project
        for (const segment of segments) {
          const reservation = reserveExistingCurrentChildDirectory(parent, segment)
          if (reservation === undefined) return undefined
          reservations.push(reservation)
          parent = reservation
        }
        const current = this.#readCurrentFile(leaf, reservations, maxBytes)
        return current.kind === "ready"
          ? { bytes: current.bytes, identity: current.identity }
          : undefined
      } finally {
        leaveCurrentReservations(this.#project, reservations)
      }
    })
  }

  readProjectDirectoryIdentity(relativePath: string): NoFollowPathIdentity | undefined {
    this.#assertActive()
    const segments = validatedRelativeSegments(relativePath)
    return withReservedProjectDirectory(this.#project, () => {
      const reservations: DirectoryReservation[] = []
      try {
        let parent = this.#project
        for (const segment of segments) {
          const reservation = reserveExistingCurrentChildDirectory(parent, segment)
          if (reservation === undefined) return undefined
          reservations.push(reservation)
          parent = reservation
        }
        this.#assertAll(reservations)
        return parent.identity
      } finally {
        leaveCurrentReservations(this.#project, reservations)
      }
    })
  }

  readProjectTree(options: ProjectReadTreeOptions): readonly ProjectReadTreeEntry[] {
    if (
      !Number.isInteger(options.maxEntries)
      || !Number.isInteger(options.maxFileBytes)
      || !Number.isInteger(options.maxTotalBytes)
      || options.maxEntries <= 0
      || options.maxFileBytes <= 0
      || options.maxTotalBytes <= 0
    ) {
      throw new ProjectReadBoundaryError()
    }
    this.#assertActive()
    return withReservedProjectDirectory(this.#project, () => {
      const entries: ProjectReadTreeEntry[] = []
      let totalBytes = 0
      const visit = (directory: DirectoryReservation, relativeDirectory: string, reservations: DirectoryReservation[]): void => {
        this.#assertAll(reservations)
        for (const name of readdirSync(".").sort()) {
          assertLeafName(name)
          const relativePath = relativeDirectory === "" ? name : `${relativeDirectory}/${name}`
          if (options.isExcluded(relativePath)) continue
          const stat = lstatSync(name, { bigint: true })
          if (stat.isSymbolicLink()) throw new ProjectReadBoundaryError()
          if (stat.isDirectory()) {
            if (entries.length >= options.maxEntries) throw new ProjectReadBoundaryLimitError()
            const child = reserveExistingCurrentChildDirectory(directory, name)
            if (child === undefined) throw new ProjectReadBoundaryError()
            entries.push({ identity: child.identity, kind: "directory", path: relativePath })
            reservations.push(child)
            try {
              visit(child, relativePath, reservations)
            } finally {
              reservations.pop()
              try {
                process.chdir("..")
                assertCurrentDirectory(directory)
              } catch {
                throw new ProjectReadBoundaryError()
              } finally {
                closeSync(child.descriptor)
              }
            }
            continue
          }
          if (!stat.isFile()) throw new ProjectReadBoundaryError()
          if (stat.size > BigInt(options.maxFileBytes) || entries.length >= options.maxEntries) {
            throw new ProjectReadBoundaryLimitError()
          }
          const file = this.#readCurrentFile(name, reservations, options.maxFileBytes)
          if (file.kind !== "ready") throw new ProjectReadBoundaryError()
          totalBytes += file.bytes.byteLength
          if (totalBytes > options.maxTotalBytes) throw new ProjectReadBoundaryLimitError()
          entries.push({ bytes: file.bytes, identity: file.identity, kind: "file", path: relativePath })
        }
        this.#assertAll(reservations)
      }
      visit(this.#project, "", [])
      return entries
    })
  }

  assertSafeProjectDirectoryPath(relativePath: string): void {
    this.#assertActive()
    const segments = validatedRelativeSegments(relativePath)
    withReservedProjectDirectory(this.#project, () => {
      const reservations: DirectoryReservation[] = []
      try {
        let parent = this.#project
        for (const segment of segments) {
          const reservation = reserveExistingCurrentChildDirectory(parent, segment)
          if (reservation === undefined) return
          reservations.push(reservation)
          parent = reservation
        }
        this.#assertAll(reservations)
      } finally {
        leaveCurrentReservations(this.#project, reservations)
      }
    })
  }

  #assertActive(): void {
    if (this.#closed) throw new ProjectReadBoundaryError()
    assertDirectoryReservation(this.#project)
  }

  #assertAll(reservations: readonly DirectoryReservation[]): void {
    this.#assertActive()
    for (const reservation of reservations) assertDirectoryReservation(reservation)
  }

  #readCurrentFile(
    name: string,
    reservations: readonly DirectoryReservation[],
    maxBytes?: number,
  ): CurrentFile {
    let descriptor: number | undefined
    try {
      const currentStat = lstatSync(name, { bigint: true })
      if (!currentStat.isFile() || currentStat.isSymbolicLink()) throw new ProjectReadBoundaryError()
      if (maxBytes !== undefined && currentStat.size > BigInt(maxBytes)) throw new ProjectReadBoundaryLimitError()
      const current = noFollowPathIdentityFromStat(currentStat)
      this.#assertAll(reservations)
      descriptor = openSync(name, constants.O_RDONLY | constants.O_NOFOLLOW)
      const descriptorIdentity = noFollowPathIdentityFromStat(fstatSync(descriptor, { bigint: true }))
      if (maxBytes !== undefined && BigInt(descriptorIdentity.size) > BigInt(maxBytes)) {
        throw new ProjectReadBoundaryLimitError()
      }
      const afterOpen = noFollowPathIdentityFromStat(lstatSync(name, { bigint: true }))
      if (!sameNoFollowPathIdentity(current, descriptorIdentity) || !sameNoFollowPathIdentity(current, afterOpen)) {
        throw new ProjectReadBoundaryError()
      }
      const bytes = readFileSync(descriptor)
      if (maxBytes !== undefined && bytes.byteLength > maxBytes) throw new ProjectReadBoundaryLimitError()
      this.#assertAll(reservations)
      return { bytes, identity: descriptorIdentity, kind: "ready" }
    } catch (error) {
      if (errorCode(error) === "ENOENT") return { kind: "absent" }
      if (error instanceof ProjectReadBoundaryLimitError || error instanceof ProjectReadBoundaryError) throw error
      throw new ProjectReadBoundaryError()
    } finally {
      if (descriptor !== undefined) closeSync(descriptor)
    }
  }
}

export function reserveProjectReadBoundary(projectDir: string): ProjectReadBoundary {
  return new ProjectReadBoundary(reserveProjectDirectory(resolve(projectDir)))
}

export function reserveBootstrapWriteBoundary(projectDir: string): BootstrapWriteBoundary {
  const project = reserveProjectDirectory(resolve(projectDir))
  const persona = reserveCanonicalDirectory(join(project.path, ".persona"))
  const workflow = reserveOrCreateChildDirectory(persona, "workflow")
  return new BootstrapWriteBoundary(project, persona, workflow)
}

export function reserveExistingBootstrapWriteBoundary(projectDir: string): BootstrapWriteBoundary {
  const project = reserveProjectDirectory(resolve(projectDir))
  let persona: DirectoryReservation | undefined
  let workflow: DirectoryReservation | undefined
  try {
    persona = reserveCanonicalDirectory(join(project.path, ".persona"))
    workflow = reserveCanonicalDirectory(join(persona.path, "workflow"))
    const boundary = new BootstrapWriteBoundary(project, persona, workflow)
    persona = undefined
    workflow = undefined
    return boundary
  } catch (error) {
    if (workflow !== undefined) canonicalClose(workflow)
    if (persona !== undefined) canonicalClose(persona)
    canonicalClose(project)
    if (error instanceof BootstrapWriteBoundaryError) throw error
    throw new BootstrapWriteBoundaryError()
  }
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

function reserveExistingCurrentChildDirectory(parent: DirectoryReservation, name: string): DirectoryReservation | undefined {
  assertLeafName(name)
  assertCurrentDirectory(parent)
  assertDirectoryReservation(parent)
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
    if (errorCode(error) === "ENOENT") return undefined
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
