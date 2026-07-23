import {
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  realpathSync,
  writeFileSync,
} from "node:fs"
import { isAbsolute, join, relative } from "node:path"

const ARTIFACT_DIRECTORY = ".project-finish-attestation-artifacts"
const ARTIFACT_FILES = ["receipt.json", "predicate.json"]

export function reserveProjectFinishAttestationArtifactOutput(workspaceRoot) {
  let reservation
  try {
    const workspace = captureDirectory(workspaceRoot)
    const outputPath = join(workspace.realpath, ARTIFACT_DIRECTORY)
    if (!isContained(workspace.realpath, outputPath)) throw new ArtifactOutputError()
    mkdirSync(outputPath, { mode: 0o700 })
    const output = captureDirectory(outputPath)
    if (!sameDirectory(workspace)) throw new ArtifactOutputError()
    const directoryDescriptor = openDirectory(output.realpath)
    reservation = {
      closed: false,
      directoryDescriptor,
      files: new Map(),
      output,
      workspace,
    }
    for (const name of ARTIFACT_FILES) {
      reservation.files.set(name, reserveFile(reservation, name))
    }
    assertReservation(reservation)
    return reservation
  } catch (error) {
    if (reservation !== undefined) closeProjectFinishAttestationArtifactReservation(reservation)
    if (error instanceof ArtifactOutputError) throw error
    throw new ArtifactOutputError()
  }
}

export function materializeProjectFinishAttestationArtifactReservation(reservation, artifacts) {
  try {
    if (!isArtifactSet(artifacts)) throw new ArtifactOutputError()
    writeReservedFile(reservation, "receipt.json", artifacts.receiptBytes)
    writeReservedFile(reservation, "predicate.json", Buffer.from(`${JSON.stringify(artifacts.predicate)}\n`, "utf8"))
    assertReservation(reservation)
  } catch (error) {
    if (error instanceof ArtifactOutputError) throw error
    throw new ArtifactOutputError()
  }
}

export function verifyProjectFinishAttestationArtifactReservation(reservation) {
  try {
    assertReservation(reservation)
    for (const name of ARTIFACT_FILES) {
      const file = requiredReservedFile(reservation, name)
      const stat = fstatSync(file.descriptor, { bigint: true })
      if (!stat.isFile() || stat.size <= 0n || !sameIdentity(file.identity, stat)) {
        throw new ArtifactOutputError()
      }
    }
    return { outputDirectory: reservation.output.realpath }
  } catch (error) {
    if (error instanceof ArtifactOutputError) throw error
    throw new ArtifactOutputError()
  }
}

export function closeProjectFinishAttestationArtifactReservation(reservation) {
  if (!isReservation(reservation) || reservation.closed) return
  reservation.closed = true
  for (const file of reservation.files.values()) {
    closeQuietly(file.descriptor)
  }
  closeQuietly(reservation.directoryDescriptor)
}

export class ArtifactOutputError extends Error {}

function reserveFile(reservation, name) {
  assertDirectoryReservation(reservation)
  const path = join(reservation.output.realpath, name)
  let descriptor
  try {
    descriptor = openSync(
      path,
      constants.O_RDWR | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    )
    const stat = fstatSync(descriptor, { bigint: true })
    const current = lstatSync(path, { bigint: true })
    if (!stat.isFile() || stat.size !== 0n || current.isSymbolicLink() || !sameIdentity(stat, current)) {
      throw new ArtifactOutputError()
    }
    assertDirectoryReservation(reservation)
    return { descriptor, identity: identity(stat), name }
  } catch (error) {
    if (descriptor !== undefined) closeQuietly(descriptor)
    if (error instanceof ArtifactOutputError) throw error
    throw new ArtifactOutputError()
  }
}

function writeReservedFile(reservation, name, bytes) {
  const file = requiredReservedFile(reservation, name)
  try {
    assertReservation(reservation)
    const before = fstatSync(file.descriptor, { bigint: true })
    if (!before.isFile() || before.size !== 0n || !sameIdentity(file.identity, before)) {
      throw new ArtifactOutputError()
    }
    writeFileSync(file.descriptor, bytes)
    fsyncSync(file.descriptor)
    const after = fstatSync(file.descriptor, { bigint: true })
    if (!after.isFile() || after.size !== BigInt(bytes.byteLength)) throw new ArtifactOutputError()
    file.identity = identity(after)
    assertReservation(reservation)
  } catch (error) {
    if (error instanceof ArtifactOutputError) throw error
    throw new ArtifactOutputError()
  }
}

function assertReservation(reservation) {
  assertDirectoryReservation(reservation)
  for (const name of ARTIFACT_FILES) {
    assertReservedFile(reservation, requiredReservedFile(reservation, name))
  }
}

function assertDirectoryReservation(reservation) {
  if (!isReservation(reservation) || reservation.closed) throw new ArtifactOutputError()
  if (!sameDirectory(reservation.workspace) || !sameDirectory(reservation.output)) {
    throw new ArtifactOutputError()
  }
  const descriptor = fstatSync(reservation.directoryDescriptor, { bigint: true })
  if (!descriptor.isDirectory() || !sameLocation(reservation.output.identity, descriptor)) {
    throw new ArtifactOutputError()
  }
}

function assertReservedFile(reservation, file) {
  const descriptor = fstatSync(file.descriptor, { bigint: true })
  const current = lstatSync(join(reservation.output.realpath, file.name), { bigint: true })
  if (
    !descriptor.isFile()
    || !current.isFile()
    || current.isSymbolicLink()
    || !sameIdentity(file.identity, descriptor)
    || !sameIdentity(descriptor, current)
  ) {
    throw new ArtifactOutputError()
  }
}

function requiredReservedFile(reservation, name) {
  if (!isReservation(reservation)) throw new ArtifactOutputError()
  const file = reservation.files.get(name)
  if (file === undefined) throw new ArtifactOutputError()
  return file
}

function openDirectory(path) {
  if (typeof constants.O_DIRECTORY !== "number") throw new ArtifactOutputError()
  try {
    return openSync(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW)
  } catch {
    throw new ArtifactOutputError()
  }
}

function captureDirectory(path) {
  if (typeof path !== "string" || !isAbsolute(path)) throw new ArtifactOutputError()
  try {
    const before = lstatSync(path, { bigint: true })
    if (!before.isDirectory() || before.isSymbolicLink()) throw new ArtifactOutputError()
    const realpath = realpathSync(path)
    if (realpath !== path) throw new ArtifactOutputError()
    const after = lstatSync(path, { bigint: true })
    if (!after.isDirectory() || after.isSymbolicLink() || !sameLocation(before, after)) {
      throw new ArtifactOutputError()
    }
    return { identity: identity(after), realpath }
  } catch (error) {
    if (error instanceof ArtifactOutputError) throw error
    throw new ArtifactOutputError()
  }
}

function sameDirectory(directory) {
  if (directory === undefined || typeof directory.realpath !== "string" || directory.identity === undefined) return false
  try {
    const current = lstatSync(directory.realpath, { bigint: true })
    return current.isDirectory()
      && !current.isSymbolicLink()
      && realpathSync(directory.realpath) === directory.realpath
      && sameLocation(directory.identity, current)
  } catch {
    return false
  }
}

function isArtifactSet(value) {
  return typeof value === "object"
    && value !== null
    && !Array.isArray(value)
    && Buffer.isBuffer(value.receiptBytes)
    && typeof value.predicate === "object"
    && value.predicate !== null
    && !Array.isArray(value.predicate)
}

function isReservation(value) {
  return typeof value === "object"
    && value !== null
    && value.files instanceof Map
    && typeof value.directoryDescriptor === "number"
    && typeof value.closed === "boolean"
    && value.output !== undefined
    && value.workspace !== undefined
}

function isContained(root, candidate) {
  const path = relative(root, candidate)
  return path === "" || (!path.startsWith("..") && !isAbsolute(path))
}

function identity(stat) {
  return {
    ctimeNs: stat.ctimeNs.toString(),
    dev: stat.dev.toString(),
    ino: stat.ino.toString(),
    mode: stat.mode.toString(),
    mtimeNs: stat.mtimeNs.toString(),
    size: stat.size.toString(),
  }
}

function sameIdentity(left, right) {
  const expected = typeof left.dev === "bigint" ? identity(left) : left
  const current = typeof right.dev === "bigint" ? identity(right) : right
  return expected.ctimeNs === current.ctimeNs
    && expected.dev === current.dev
    && expected.ino === current.ino
    && expected.mode === current.mode
    && expected.mtimeNs === current.mtimeNs
    && expected.size === current.size
}

function sameLocation(left, right) {
  const expected = typeof left.dev === "bigint" ? identity(left) : left
  const current = typeof right.dev === "bigint" ? identity(right) : right
  return expected.dev === current.dev && expected.ino === current.ino && expected.mode === current.mode
}

function closeQuietly(descriptor) {
  try {
    closeSync(descriptor)
  } catch {
    // Descriptors are best-effort cleanup after a blocked output lifecycle.
  }
}
