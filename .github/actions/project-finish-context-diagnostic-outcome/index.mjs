const FAILURE_CODE = "project-finish-producer-context-diagnostic-blocked"

const outcome = process.env["INPUT_DIAGNOSTIC-OUTCOME"]
if (outcome !== "match") {
  process.stderr.write(`${FAILURE_CODE}\n`)
  process.exitCode = 1
}
