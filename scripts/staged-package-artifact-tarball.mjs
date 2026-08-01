import {
  MAX_PACKAGE_CONTENT_TARBALL_BYTES,
  PackageContentIdentityError,
  readPackageTarball,
} from "./package-content-identity.mjs"
import { createHash } from "node:crypto"

export const MAX_STAGED_TARBALL_BYTES = MAX_PACKAGE_CONTENT_TARBALL_BYTES

export class StagedTarballError extends Error {
  constructor(code) {
    super(code)
    this.code = code
    this.name = "StagedTarballError"
  }
}

export function readStagedTarballFacts(bytes, expectedName, expectedVersion) {
  if (!Buffer.isBuffer(bytes) || bytes.byteLength === 0 || bytes.byteLength > MAX_STAGED_TARBALL_BYTES) {
    fail("staged-producer-tarball-bounds")
  }
  let parsed
  try {
    parsed = readPackageTarball(bytes)
  } catch (error) {
    if (error instanceof PackageContentIdentityError && error.code === "package-content-identity-bounds") {
      fail("staged-producer-tarball-bounds")
    }
    if (error instanceof PackageContentIdentityError && error.code === "package-content-identity-manifest") {
      fail("staged-producer-packed-manifest-format")
    }
    fail("staged-producer-tarball-format")
  }
  if (parsed.manifest.name !== expectedName || parsed.manifest.version !== expectedVersion) {
    fail("staged-producer-packed-manifest-mismatch")
  }
  return {
    contentIdentity: parsed.identity,
    integrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}`,
    packageName: parsed.manifest.name,
    sha1: createHash("sha1").update(bytes).digest("hex"),
    sha256: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
    size: bytes.byteLength,
    version: parsed.manifest.version,
  }
}

function fail(code) {
  throw new StagedTarballError(code)
}
