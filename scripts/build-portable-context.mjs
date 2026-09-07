import { builtinModules } from "node:module"
import { join } from "node:path"
import process from "node:process"
import { writeFileSync } from "node:fs"
import { rolldown } from "rolldown"

const builtins = new Set(builtinModules.flatMap((name) => [name, `node:${name}`]))
const allowedImports = new Set(["node:crypto", "node:fs", "node:os", "node:path", "node:process", "node:url"])
const root = process.cwd()
await build("portable-context-main.js", "portable-context-runtime.mjs")
await build("portable-context-setup.js", "portable-context-setup.mjs")

async function build(input, output) {
  const bundle = await rolldown({
    input: join(root, "dist/context-delivery", input),
    platform: "node",
    external: (id) => builtins.has(id),
    onLog(level, log, handler) {
      if (level === "warn") handler("error", log)
      else handler(level, log)
    },
  })
  try {
    const result = await bundle.generate({ format: "esm", sourcemap: false })
    const chunk = result.output[0]
    if (result.output.length !== 1 || chunk?.type !== "chunk" || chunk.dynamicImports.length !== 0
      || chunk.imports.some((id) => !allowedImports.has(id))) {
      throw new Error("portable-context-bundle-boundary")
    }
    writeFileSync(join(root, "dist/context-delivery", output), chunk.code, { mode: 0o644 })
  } finally {
    await bundle.close()
  }
}
