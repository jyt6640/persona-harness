import { runObserverCredentialPreflight } from "./consumer-authority-observer-preflight-launcher.mjs"

function main() {
  const json = process.argv.slice(2)
  if (json.length > 1 || (json.length === 1 && json[0] !== "--json")) {
    process.stderr.write("Usage: node preflight-consumer-authority-observer.mjs [--json]\n")
    process.exitCode = 1
    return
  }
  const result = runObserverCredentialPreflight()
  process.stdout.write(`${JSON.stringify(result)}\n`)
  process.exitCode = result.state === "ready" ? 0 : 1
}

main()
