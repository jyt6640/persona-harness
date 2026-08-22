import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

describe("cooperative finish demo", () => {
  it("defines one checkout-only exact-package Gradle/JUnit BLOCK-to-PASS contract", () => {
    const scriptPath = join(process.cwd(), "scripts", "verify-cooperative-finish-demo.mjs")

    expect(existsSync(scriptPath)).toBe(true)

    const source = readFileSync(scriptPath, "utf8")
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
      readonly scripts: Record<string, string>
    }

    expect(packageJson.scripts["demo:cooperative-finish"]).toBeUndefined()
    expect(source).toContain('"workflow", "finish", "implement"')
    expect(source).toContain('"--assurance", "cooperative"')
    expect(source).toContain('"./gradlew", ["--no-daemon", "test"]')
    expect(source).toContain("TEST-example.cooperative.CooperativeApplicationTest.xml")
  })

  it("runs the exact contract inside the required repository verification job", () => {
    const workflow = readFileSync(join(process.cwd(), ".github", "workflows", "ci.yml"), "utf8")

    expect(workflow).toContain("uses: actions/setup-java@b6effb05e454b25005698d916606bdc6ffcbf961")
    expect(workflow).toContain("distribution: temurin")
    expect(workflow).toContain('java-version: "21"')
    expect(workflow).toContain("uses: gradle/actions/setup-gradle@9c971963bec38e04b3d30dcc455b5382be2fdbfb")
    expect(workflow).toContain('gradle-version: "9.4.0"')
    expect(workflow).toContain("node scripts/verify-cooperative-finish-demo.mjs")
  })

  it("documents the full cooperative boundary separately from the default-off quick demo", () => {
    const quickDemo = readFileSync(join(process.cwd(), "docs", "QUICK-DEMO.md"), "utf8")
    const packagingReadiness = readFileSync(
      join(process.cwd(), "docs", "current", "java-backend-mvp-packaging-readiness.md"),
      "utf8",
    )

    expect(quickDemo).toContain("## Full Cooperative Verification Demo")
    expect(quickDemo).toContain("node scripts/verify-cooperative-finish-demo.mjs")
    expect(quickDemo).toContain("JDK 21")
    expect(quickDemo).toContain("Gradle 9.4.0")
    expect(quickDemo).toContain("does not grant trusted external authority")
    expect(packagingReadiness).toContain("node scripts/verify-cooperative-finish-demo.mjs")
    expect(packagingReadiness).toContain("--runtime-injection-preview")
  })
})
