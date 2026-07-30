import { pathToFileURL } from "node:url"

import { assessGithubActionsReadiness } from "./consumer-authority-observer-preflight-core.mjs"

const TOKEN_ENV = "PH_OBSERVER_PREFLIGHT_GITHUB_TOKEN"

async function main() {
  const result = await assessGithubActionsReadiness(process.env[TOKEN_ENV])
  process.stdout.write(`${JSON.stringify(result)}\n`)
  process.exitCode = result.state === "ready" ? 0 : 1
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    process.stdout.write(`${JSON.stringify({
      authorityEligible: false,
      code: "github-actions-read-unusable",
      consumerHome: "isolated",
      credential: "unusable",
      fixtureAuthorization: "blocked",
      mutationPerformed: false,
      next: "github-actions-read-preflight",
      schemaVersion: "consumer-authority-observer-preflight.1",
      state: "blocked",
    })}\n`)
    process.exitCode = 1
  })
}
