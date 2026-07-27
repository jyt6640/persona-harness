export type NativeProjectReadIdentity = {
  readonly ctimeNs: string
  readonly dev: string
  readonly ino: string
  readonly mode: string
  readonly mtimeNs: string
  readonly size: string
}

export type NativeProjectReadTreeEntry =
  | {
      readonly identity: NativeProjectReadIdentity
      readonly kind: "directory"
      readonly path: string
    }
  | {
      readonly bytes: Buffer
      readonly identity: NativeProjectReadIdentity
      readonly kind: "file"
      readonly path: string
    }

const STATUS = {
  absent: 1,
  invalid: 5,
  io: 4,
  limit: 3,
  ready: 0,
  unsafe: 2,
} as const

export class NativeProjectReadProtocolError extends Error {
  readonly name = "NativeProjectReadProtocolError"

  constructor(readonly code: "absent" | "invalid" | "io" | "limit" | "unsafe") {
    super(code)
  }
}

export function parseNativeReadResponse(response: Buffer): {
  readonly bytes: Buffer
  readonly identity: NativeProjectReadIdentity
} {
  const cursor = new ProtocolCursor(response)
  assertReady(cursor)
  const identity = cursor.identity()
  const length = cursor.u32()
  const bytes = cursor.bytes(length)
  cursor.assertComplete()
  return { bytes, identity }
}

export function parseNativeDirectoryResponse(response: Buffer): NativeProjectReadIdentity {
  const cursor = new ProtocolCursor(response)
  assertReady(cursor)
  const identity = cursor.identity()
  cursor.assertComplete()
  return identity
}

export function parseNativeTreeResponse(response: Buffer): readonly NativeProjectReadTreeEntry[] {
  const cursor = new ProtocolCursor(response)
  assertReady(cursor)
  const count = cursor.u32()
  const entries: NativeProjectReadTreeEntry[] = []
  for (let index = 0; index < count; index += 1) {
    const kind = cursor.u8()
    const path = cursor.bytes(cursor.u16()).toString("utf8")
    if (!validRelativePath(path)) throw new NativeProjectReadProtocolError("invalid")
    const identity = cursor.identity()
    const length = cursor.u32()
    if (kind === 1) {
      if (length !== 0) throw new NativeProjectReadProtocolError("invalid")
      entries.push({ identity, kind: "directory", path })
      continue
    }
    if (kind === 2) {
      entries.push({ bytes: cursor.bytes(length), identity, kind: "file", path })
      continue
    }
    throw new NativeProjectReadProtocolError("invalid")
  }
  cursor.assertComplete()
  return entries
}

function assertReady(cursor: ProtocolCursor): void {
  const status = cursor.u8()
  switch (status) {
    case STATUS.ready:
      return
    case STATUS.absent:
      throw new NativeProjectReadProtocolError("absent")
    case STATUS.unsafe:
      throw new NativeProjectReadProtocolError("unsafe")
    case STATUS.limit:
      throw new NativeProjectReadProtocolError("limit")
    case STATUS.io:
      throw new NativeProjectReadProtocolError("io")
    case STATUS.invalid:
      throw new NativeProjectReadProtocolError("invalid")
    default:
      throw new NativeProjectReadProtocolError("invalid")
  }
}

function validRelativePath(value: string): boolean {
  return value.length > 0
    && !value.startsWith("/")
    && !value.includes("\\")
    && value.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== "..")
}

class ProtocolCursor {
  #offset = 0

  constructor(readonly value: Buffer) {}

  assertComplete(): void {
    if (this.#offset !== this.value.byteLength) throw new NativeProjectReadProtocolError("invalid")
  }

  bytes(length: number): Buffer {
    if (!Number.isSafeInteger(length) || length < 0 || length > this.value.byteLength - this.#offset) {
      throw new NativeProjectReadProtocolError("invalid")
    }
    const start = this.#offset
    this.#offset += length
    return this.value.subarray(start, this.#offset)
  }

  identity(): NativeProjectReadIdentity {
    const dev = this.u64()
    const ino = this.u64()
    const mode = this.u64()
    const size = this.u64()
    const mtimeNs = this.u64()
    const ctimeNs = this.u64()
    return {
      ctimeNs: ctimeNs.toString(),
      dev: dev.toString(),
      ino: ino.toString(),
      mode: Number(mode & 0o777n).toString(8).padStart(4, "0"),
      mtimeNs: mtimeNs.toString(),
      size: size.toString(),
    }
  }

  u8(): number {
    return this.bytes(1)[0] ?? invalidByte()
  }

  u16(): number {
    return this.bytes(2).readUInt16LE()
  }

  u32(): number {
    return this.bytes(4).readUInt32LE()
  }

  u64(): bigint {
    return this.bytes(8).readBigUInt64LE()
  }
}

function invalidByte(): never {
  throw new NativeProjectReadProtocolError("invalid")
}
