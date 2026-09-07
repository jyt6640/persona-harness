import process from "node:process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { runPortableContextHook } from "./portable-context-hook.js"

const MAX_HOOK_INPUT_BYTES = 1_048_576

async function main(): Promise<void> {
  const [hostOption, host, ...extra] = process.argv.slice(2)
  if (hostOption !== undefined && (hostOption !== "--host" || (host !== "codex" && host !== "claude") || extra.length > 0)) {
    throw new Error("hook-arguments-invalid")
  }
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of process.stdin) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += bytes.length
    if (size > MAX_HOOK_INPUT_BYTES) throw new Error("hook-input-limit")
    chunks.push(bytes)
  }
  let input: unknown
  try {
    input = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)))
  } catch {
    throw new Error("hook-input-invalid")
  }
  const result = runPortableContextHook(input, process.cwd(), {
    setupScript: join(dirname(fileURLToPath(import.meta.url)), "context-setup.mjs"),
    ...(host === "codex" || host === "claude" ? { host } : {}),
  })
  if (result.status === "offered") {
    process.stdout.write(`${JSON.stringify(result.output)}\n`)
  } else if (result.status === "blocked") {
    throw new Error(result.reason)
  }
}

try {
  await main()
} catch (error) {
  const reason = error instanceof Error && /^[a-z-]{1,80}$/u.test(error.message) ? error.message : "hook-unavailable"
  process.stderr.write(`Persona Harness Context blocked: ${reason}\n`)
  process.exitCode = 1
}
