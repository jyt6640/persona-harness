import { realpathSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { validate } from "./validator.mjs"

const ROOT = join(fileURLToPath(new URL("..", import.meta.url)))

function options(argv) {
  const result = { root: ROOT, version: "base" }
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--root") result.root = argv[index + 1]
    if (argv[index] === "--version") result.version = argv[index + 1]
  }
  return result
}

function main() {
  const selected = options(process.argv.slice(2))
  const version = selected.version === "successor" ? "successor" : "base"
  const result = validate(selected.root, version)
  process.stdout.write(`${JSON.stringify(result)}\n`)
  if (result.status !== "pass") process.exitCode = 1
}

function isMainModule() {
  if (process.argv[1] === undefined) return false
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
  } catch {
    return false
  }
}

if (isMainModule()) main()
