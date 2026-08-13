import { isRecord, stripJsonComments } from "../config/jsonc.js"
import type { BootstrapWriteBoundary } from "../io/bootstrap-write-boundary.js"
import { InitManifestError } from "./init-manifest.js"

const HARNESS_CONFIG_PATH = ".persona/harness.jsonc"

export function enableAttachEnforcement(boundary: BootstrapWriteBoundary): void {
  const bytes = boundary.readProjectFile(HARNESS_CONFIG_PATH)
  if (bytes === undefined) {
    throw new InitManifestError(`${HARNESS_CONFIG_PATH} is missing; no files were changed.`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(stripJsonComments(bytes.toString("utf8")))
  } catch {
    throw new InitManifestError(`${HARNESS_CONFIG_PATH} is malformed; no files were changed.`)
  }
  if (!isRecord(parsed)) {
    throw new InitManifestError(`${HARNESS_CONFIG_PATH} must contain a JSON object; no files were changed.`)
  }
  const features = isRecord(parsed.features) ? parsed.features : {}
  const enforce = isRecord(parsed.enforce) ? parsed.enforce : {}
  boundary.writeProjectFileAtomically(
    HARNESS_CONFIG_PATH,
    `${JSON.stringify({
      ...parsed,
      features: { ...features, entrySteering: false, runtimeInjection: false },
      enforce: {
        ...enforce,
        executeVerification: true,
        idleContinuation: false,
        ralphLoop: {
          ...(isRecord(enforce.ralphLoop) ? enforce.ralphLoop : {}),
          enabled: false,
        },
        systemConstitution: false,
      },
    }, null, 2)}\n`,
  )
}
