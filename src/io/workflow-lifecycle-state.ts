import {
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  ftruncateSync,
  lstatSync,
  openSync,
  realpathSync,
  writeFileSync,
} from "node:fs"
import { isAbsolute, join, relative, resolve } from "node:path"

import {
  captureNoFollowDirectory,
  noFollowPathIdentityFromStat,
  readNoFollowRegularFile,
  sameNoFollowPathIdentity,
  sameNoFollowPathLocation,
  type NoFollowPathIdentity,
} from "./no-follow-file.js"

const PERSONA_DIRECTORY = ".persona"
const WORKFLOW_DIRECTORY = "workflow"

export const WORKFLOW_LIFECYCLE_STATE_FILES = [
  "workflow-loop-state.json",
  "ralph-loop-state.json",
] as const

export type WorkflowLifecycleStateFileName = typeof WORKFLOW_LIFECYCLE_STATE_FILES[number]
export type WorkflowLifecycleStateToken = NoFollowPathIdentity | null

export type WorkflowLifecycleStateRead =
  | { readonly kind: "absent" }
  | { readonly kind: "blocked" }
  | {
      readonly kind: "ready"
      readonly value: {
        readonly bytes: Buffer
        readonly token: NoFollowPathIdentity
      }
    }

export class WorkflowLifecycleStateError extends Error {
  constructor() {
    super("workflow lifecycle state is unsafe")
    this.name = "WorkflowLifecycleStateError"
  }
}

export class WorkflowLifecycleStateConflictError extends Error {
  constructor() {
    super("workflow lifecycle state changed while it was reserved")
    this.name = "WorkflowLifecycleStateConflictError"
  }
}

type CanonicalDirectory = {
  readonly identity: NoFollowPathIdentity
  readonly path: string
}

type WorkflowDirectoryReservation = {
  readonly persona: CanonicalDirectory
  readonly project: CanonicalDirectory
  readonly workflow: CanonicalDirectory
  readonly workflowDescriptor: number
}

type StateFileReservation = {
  readonly descriptor: number
  identity: NoFollowPathIdentity
  readonly name: WorkflowLifecycleStateFileName
  readonly path: string
}

export function readWorkflowLifecycleStateFile(
  projectDir: string,
  name: WorkflowLifecycleStateFileName,
  maxBytes: number,
): WorkflowLifecycleStateRead {
  const reservation = reserveWorkflowDirectory(projectDir)
  if (reservation.kind !== "ready") return reservation
  try {
    const file = readNoFollowRegularFile(
      join(reservation.value.workflow.path, name),
      maxBytes,
      reservation.value.workflow.path,
    )
    if (file.kind === "absent") {
      return assertWorkflowDirectoryReservation(reservation.value) ? { kind: "absent" } : { kind: "blocked" }
    }
    if (file.kind !== "ready" || !assertWorkflowDirectoryReservation(reservation.value)) {
      return { kind: "blocked" }
    }
    return {
      kind: "ready",
      value: {
        bytes: file.value.bytes,
        token: file.value.identity,
      },
    }
  } finally {
    closeSync(reservation.value.workflowDescriptor)
  }
}

export function writeWorkflowLifecycleStateFile(
  projectDir: string,
  name: WorkflowLifecycleStateFileName,
  expectedToken: WorkflowLifecycleStateToken,
  text: string,
): WorkflowLifecycleStateToken {
  const reservation = reserveWorkflowDirectory(projectDir)
  if (reservation.kind !== "ready") throw new WorkflowLifecycleStateError()
  let file: StateFileReservation | undefined
  try {
    file = reserveStateFile(reservation.value, name, expectedToken)
    if (!assertStateFileReservation(reservation.value, file)) throw new WorkflowLifecycleStateError()
    ftruncateSync(file.descriptor, 0)
    writeFileSync(file.descriptor, text, "utf8")
    fsyncSync(file.descriptor)
    const nextIdentity = noFollowPathIdentityFromStat(fstatSync(file.descriptor, { bigint: true }))
    file.identity = nextIdentity
    if (!assertStateFileReservation(reservation.value, file)) throw new WorkflowLifecycleStateError()
    return nextIdentity
  } catch (error) {
    if (error instanceof WorkflowLifecycleStateError || error instanceof WorkflowLifecycleStateConflictError) throw error
    throw new WorkflowLifecycleStateError()
  } finally {
    if (file !== undefined) closeSync(file.descriptor)
    closeSync(reservation.value.workflowDescriptor)
  }
}

function reserveWorkflowDirectory(projectDir: string):
  | { readonly kind: "absent" }
  | { readonly kind: "blocked" }
  | { readonly kind: "ready"; readonly value: WorkflowDirectoryReservation } {
  const project = captureProjectDirectory(resolve(projectDir))
  if (project.kind !== "ready") return { kind: "blocked" }
  const personaPath = join(project.value.path, PERSONA_DIRECTORY)
  const workflowPath = join(personaPath, WORKFLOW_DIRECTORY)
  if (!isContained(project.value.path, personaPath) || !isContained(project.value.path, workflowPath)) return { kind: "blocked" }

  const persona = captureCanonicalDirectory(personaPath)
  if (persona.kind === "absent") return { kind: "absent" }
  if (persona.kind !== "ready") return { kind: "blocked" }
  const workflow = captureCanonicalDirectory(workflowPath)
  if (workflow.kind === "absent") return { kind: "absent" }
  if (workflow.kind !== "ready") return { kind: "blocked" }

  let workflowDescriptor: number | undefined
  try {
    workflowDescriptor = openNoFollowDirectory(workflow.value.path)
    const descriptorIdentity = noFollowPathIdentityFromStat(fstatSync(workflowDescriptor, { bigint: true }))
    if (!sameNoFollowPathLocation(workflow.value.identity, descriptorIdentity)) return { kind: "blocked" }
    const reservation = {
      persona: persona.value,
      project: project.value,
      workflow: workflow.value,
      workflowDescriptor,
    }
    if (!assertWorkflowDirectoryReservation(reservation)) return { kind: "blocked" }
    workflowDescriptor = undefined
    return { kind: "ready", value: reservation }
  } catch {
    return { kind: "blocked" }
  } finally {
    if (workflowDescriptor !== undefined) closeSync(workflowDescriptor)
  }
}

function captureProjectDirectory(path: string):
  | { readonly kind: "blocked" }
  | { readonly kind: "ready"; readonly value: CanonicalDirectory } {
  if (!isAbsolute(path)) return { kind: "blocked" }
  const requested = captureNoFollowDirectory(path)
  if (requested.kind !== "ready") return { kind: "blocked" }
  try {
    const canonicalPath = realpathSync(path)
    const canonical = captureCanonicalDirectory(canonicalPath)
    if (
      canonical.kind !== "ready"
      || !sameNoFollowPathLocation(requested.value, canonical.value.identity)
    ) {
      return { kind: "blocked" }
    }
    return canonical
  } catch {
    return { kind: "blocked" }
  }
}

function reserveStateFile(
  reservation: WorkflowDirectoryReservation,
  name: WorkflowLifecycleStateFileName,
  expectedToken: WorkflowLifecycleStateToken,
): StateFileReservation {
  if (!assertWorkflowDirectoryReservation(reservation)) throw new WorkflowLifecycleStateError()
  const path = join(reservation.workflow.path, name)
  if (!isContained(reservation.workflow.path, path)) throw new WorkflowLifecycleStateError()
  let descriptor: number | undefined
  try {
    descriptor = expectedToken === null
      ? openSync(
          path,
          constants.O_RDWR | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
          0o600,
        )
      : openSync(path, constants.O_RDWR | constants.O_NOFOLLOW)
    const identity = noFollowPathIdentityFromStat(fstatSync(descriptor, { bigint: true }))
    const current = lstatSync(path, { bigint: true })
    const currentIdentity = noFollowPathIdentityFromStat(current)
    if (!current.isFile() || current.isSymbolicLink() || !sameNoFollowPathIdentity(identity, currentIdentity)) {
      throw new WorkflowLifecycleStateError()
    }
    if (expectedToken !== null && !sameNoFollowPathIdentity(expectedToken, identity)) {
      throw new WorkflowLifecycleStateConflictError()
    }
    if (expectedToken === null && identity.size !== "0") throw new WorkflowLifecycleStateConflictError()
    if (!assertWorkflowDirectoryReservation(reservation)) throw new WorkflowLifecycleStateError()
    const file = { descriptor, identity, name, path }
    descriptor = undefined
    return file
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor)
    if (error instanceof WorkflowLifecycleStateError || error instanceof WorkflowLifecycleStateConflictError) throw error
    if (
      (expectedToken === null && errorCode(error) === "EEXIST")
      || (expectedToken !== null && errorCode(error) === "ENOENT")
    ) {
      throw new WorkflowLifecycleStateConflictError()
    }
    throw new WorkflowLifecycleStateError()
  }
}

function assertStateFileReservation(
  reservation: WorkflowDirectoryReservation,
  file: StateFileReservation,
): boolean {
  if (!assertWorkflowDirectoryReservation(reservation)) return false
  try {
    const descriptorIdentity = noFollowPathIdentityFromStat(fstatSync(file.descriptor, { bigint: true }))
    const current = lstatSync(file.path, { bigint: true })
    return descriptorIdentity.size === file.identity.size
      && current.isFile()
      && !current.isSymbolicLink()
      && sameNoFollowPathIdentity(file.identity, descriptorIdentity)
      && sameNoFollowPathIdentity(descriptorIdentity, noFollowPathIdentityFromStat(current))
  } catch {
    return false
  }
}

function assertWorkflowDirectoryReservation(reservation: WorkflowDirectoryReservation): boolean {
  try {
    const descriptorIdentity = noFollowPathIdentityFromStat(fstatSync(reservation.workflowDescriptor, { bigint: true }))
    return sameNoFollowPathLocation(reservation.workflow.identity, descriptorIdentity)
      && sameCanonicalDirectory(reservation.project)
      && sameCanonicalDirectory(reservation.persona)
      && sameCanonicalDirectory(reservation.workflow)
  } catch {
    return false
  }
}

function captureCanonicalDirectory(path: string):
  | { readonly kind: "absent" }
  | { readonly kind: "blocked" }
  | { readonly kind: "ready"; readonly value: CanonicalDirectory } {
  if (!isAbsolute(path)) return { kind: "blocked" }
  const before = captureNoFollowDirectory(path)
  if (before.kind !== "ready") return before
  let descriptor: number | undefined
  try {
    descriptor = openNoFollowDirectory(path)
    const descriptorIdentity = noFollowPathIdentityFromStat(fstatSync(descriptor, { bigint: true }))
    const after = captureNoFollowDirectory(path)
    if (
      after.kind !== "ready"
      || realpathSync(path) !== path
      || !sameNoFollowPathIdentity(before.value, after.value)
      || !sameNoFollowPathLocation(after.value, descriptorIdentity)
    ) {
      return { kind: "blocked" }
    }
    return { kind: "ready", value: { identity: after.value, path } }
  } catch {
    return { kind: "blocked" }
  } finally {
    if (descriptor !== undefined) closeSync(descriptor)
  }
}

function sameCanonicalDirectory(expected: CanonicalDirectory): boolean {
  const current = captureCanonicalDirectory(expected.path)
  return current.kind === "ready" && sameNoFollowPathLocation(expected.identity, current.value.identity)
}

function openNoFollowDirectory(path: string): number {
  if (typeof constants.O_DIRECTORY !== "number") throw new WorkflowLifecycleStateError()
  return openSync(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW)
}

function isContained(root: string, candidate: string): boolean {
  const path = relative(root, candidate)
  return path === "" || (!path.startsWith("..") && !isAbsolute(path))
}

function errorCode(error: unknown): string | undefined {
  return error !== null
    && typeof error === "object"
    && "code" in error
    && typeof error.code === "string"
    ? error.code
    : undefined
}
