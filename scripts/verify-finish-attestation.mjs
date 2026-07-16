import { createHash } from "node:crypto"
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { bundleFromJSON } from "@sigstore/bundle"
import { getTrustedRoot } from "@sigstore/tuf"
import { toSignedEntity, toTrustMaterial, Verifier } from "@sigstore/verify"

const BUNDLE_PATH = ".persona/evidence/finish-attestation/bundle.json"
const MAX_BUNDLE_BYTES = 16 * 1024 * 1024
const TRUST_ROOT_MIRROR = "https://tuf-repo-cdn.sigstore.dev"
const CERTIFICATE_ISSUER = "https://token.actions.githubusercontent.com"
const CERTIFICATE_IDENTITY = "^https://github\\.com/jyt6640/persona-harness/\\.github/workflows/canonical-clean-ci-attestation-builder\\.yml@refs/heads/main$"

async function main() {
  const bundlePath = join(process.cwd(), BUNDLE_PATH)
  const stat = statSync(bundlePath)
  if (!stat.isFile() || stat.size > MAX_BUNDLE_BYTES) {
    throw new Error("finish attestation bundle is missing, unsafe, or too large")
  }
  const bundleBytes = readFileSync(bundlePath)
  const bundleDigest = `sha256:${createHash("sha256").update(bundleBytes).digest("hex")}`
  const bundle = bundleFromJSON(JSON.parse(bundleBytes.toString("utf8")))
  if (bundle.content?.$case !== "dsseEnvelope") {
    throw new Error("finish attestation must use a DSSE envelope")
  }

  const cachePath = mkdtempSync(join(tmpdir(), "persona-harness-sigstore-"))
  try {
    const trustedRoot = await getTrustedRoot({
      cachePath,
      forceCache: false,
      forceInit: true,
      mirrorURL: TRUST_ROOT_MIRROR,
      timeout: 5_000,
    })
    const verifier = new Verifier(toTrustMaterial(trustedRoot), {
      ctlogThreshold: 1,
      tlogThreshold: 1,
    })
    verifier.verify(toSignedEntity(bundle), {
      extensions: { issuer: CERTIFICATE_ISSUER },
      subjectAlternativeName: CERTIFICATE_IDENTITY,
    })
    const statement = JSON.parse(Buffer.from(bundle.content.dsseEnvelope.payload).toString("utf8"))
    process.stdout.write(JSON.stringify({ bundleDigest, ok: true, statement }))
  } finally {
    rmSync(cachePath, { force: true, recursive: true })
  }
}

main().catch(() => {
  process.exitCode = 1
})
