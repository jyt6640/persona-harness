import { execFileSync } from "node:child_process"
import { pathToFileURL } from "node:url"

export const PROJECT_FINISH_PRODUCER_ORIGIN_IDENTITY = "github.com/jyt6640/persona-harness"

const CHECKOUT_FAILURE_CODE = "project-finish-producer-checkout-origin-identity"
const EXPECTED_ORIGINS = new Set([
  "https://github.com/jyt6640/persona-harness",
  "https://github.com/jyt6640/persona-harness.git",
])
const IMMUTABLE_SHA = /^[a-f0-9]{40}$/u

export function normalizeProjectFinishProducerOrigin(value) {
  if (
    typeof value !== "string"
    || value.length === 0
    || value.length > 256
    || /[\u0000\r\n]/u.test(value)
    || !EXPECTED_ORIGINS.has(value)
  ) {
    return undefined
  }
  return PROJECT_FINISH_PRODUCER_ORIGIN_IDENTITY
}

export function verifyProjectFinishProducerCheckout(producerRoot, expectedSha) {
  if (typeof expectedSha !== "string" || !IMMUTABLE_SHA.test(expectedSha)) {
    return { code: CHECKOUT_FAILURE_CODE, kind: "blocked" }
  }

  const head = gitText(producerRoot, ["rev-parse", "HEAD"])
  const origin = gitText(producerRoot, ["config", "--get", "remote.origin.url"])
  if (
    head !== expectedSha
    || normalizeProjectFinishProducerOrigin(origin) !== PROJECT_FINISH_PRODUCER_ORIGIN_IDENTITY
  ) {
    return { code: CHECKOUT_FAILURE_CODE, kind: "blocked" }
  }
  return {
    kind: "verified",
    repository: PROJECT_FINISH_PRODUCER_ORIGIN_IDENTITY,
  }
}

function gitText(cwd, args) {
  try {
    const output = execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 1024,
      stdio: ["ignore", "pipe", "ignore"],
    })
    if (!output.endsWith("\n")) return undefined
    const value = output.slice(0, -1)
    return value.length === 0 || value.length > 256 || /[\u0000\r\n]/u.test(value)
      ? undefined
      : value
  } catch {
    return undefined
  }
}

function main() {
  const result = process.argv.length === 2
    ? verifyProjectFinishProducerCheckout(process.cwd(), process.env.PERSONA_HARNESS_PRODUCER_SHA)
    : { code: CHECKOUT_FAILURE_CODE, kind: "blocked" }
  if (result.kind === "blocked") {
    process.stderr.write(`${CHECKOUT_FAILURE_CODE}\n`)
    process.exitCode = 1
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
