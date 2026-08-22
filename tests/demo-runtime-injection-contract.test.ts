import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const DEMO_SCRIPTS = [
  "scripts/verify-bootstrap-demo.mjs",
  "scripts/verify-java-mvp-demo.mjs",
] as const

describe("published runtime-injection demo scripts", () => {
  it("uses the supported named plugin entrypoint after an explicit preview opt-in", () => {
    for (const scriptPath of DEMO_SCRIPTS) {
      const source = readFileSync(join(process.cwd(), scriptPath), "utf8")

      expect(source).toContain("pluginModule.PersonaHarnessPlugin")
      expect(source).toContain('"--runtime-injection-preview"')
      expect(source).not.toContain("pluginModule.default")
    }
  })
})
