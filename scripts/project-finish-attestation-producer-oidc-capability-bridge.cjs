const { join } = require("node:path")
const { pathToFileURL } = require("node:url")

const OIDC_AUDIENCE = "persona-harness-project-finish-attestation"
const PRODUCER_ENVIRONMENT_KEYS = [
  "GITHUB_ACTIONS",
  "GITHUB_EVENT_NAME",
  "GITHUB_REF",
  "GITHUB_REPOSITORY",
  "GITHUB_REPOSITORY_ID",
  "GITHUB_RUN_ATTEMPT",
  "GITHUB_RUN_ID",
  "GITHUB_SHA",
  "GITHUB_WORKFLOW_REF",
  "GITHUB_WORKFLOW_SHA",
  "GITHUB_WORKSPACE",
  "PERSONA_HARNESS_CALLER_VISIBILITY",
  "PERSONA_HARNESS_PRODUCER_SHA",
  "RUNNER_ENVIRONMENT",
  "RUNNER_OS",
]

async function runProjectFinishAttestationProducerWithCore({ core, environment = process.env }) {
  const builder = await loadBuilder()
  if (builder === undefined) return { code: "project-finish-producer-oidc", kind: "blocked" }
  const token = await requestFixedAudienceToken(core)
  try {
    return await builder.runProjectFinishAttestationBuilder({
      environment: fixedProducerEnvironment(environment),
      oidcToken: token,
      producerRoot: join(__dirname, ".."),
    })
  } catch {
    return { code: "project-finish-producer-oidc", kind: "blocked" }
  }
}

function fixedProducerEnvironment(environment) {
  const fixed = {}
  if (typeof environment !== "object" || environment === null) return fixed
  for (const key of PRODUCER_ENVIRONMENT_KEYS) {
    const value = environment[key]
    if (typeof value === "string") fixed[key] = value
  }
  return fixed
}

async function loadBuilder() {
  try {
    const source = await import(pathToFileURL(join(__dirname, "build-project-finish-attestation.mjs")).href)
    return typeof source.runProjectFinishAttestationBuilder === "function" ? source : undefined
  } catch {
    return undefined
  }
}

async function requestFixedAudienceToken(core) {
  if (typeof core !== "object" || core === null || typeof core.getIDToken !== "function") return undefined
  try {
    const token = await core.getIDToken(OIDC_AUDIENCE)
    return typeof token === "string" && token.length > 0 && token.length <= 16 * 1024 && !/[\u0000\r\n]/u.test(token)
      ? token
      : undefined
  } catch {
    return undefined
  }
}

module.exports = { runProjectFinishAttestationProducerWithCore }
