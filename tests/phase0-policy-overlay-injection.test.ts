import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { initializeWorkflowPlan } from "../src/cli/plan.js"
import { createBackendProfile, createDefaultBackendAnswers, PROFILE_PATH } from "../src/cli/intake-profile.js"
import { createInjectionBlock } from "../src/runtime/injection.js"

const tempProjects: string[] = []

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-policy-injection-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

function writePolicyOverlay(projectDir: string, overlay: unknown): void {
  mkdirSync(join(projectDir, ".persona", "policies", "company"), { recursive: true })
  mkdirSync(join(projectDir, ".persona", "policies", "personal"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "policies", "overlay.jsonc"), `${JSON.stringify(overlay, null, 2)}\n`)
}

function writeBackendPolicies(projectDir: string): void {
  writeFileSync(
    join(projectDir, ".persona", "policies", "company", "backend.md"),
    [
      "# Backend Company Policy",
      "",
      "- Use company package conventions.",
      "- Keep repository ports in domain.",
      "- Ignore extra company bullet beyond limit.",
      "",
    ].join("\n"),
  )
  writeFileSync(
    join(projectDir, ".persona", "policies", "personal", "backend.md"),
    [
      "# Backend Personal Philosophy",
      "",
      "- Domain models should own state decisions.",
      "- Application Services must not own id sequence state.",
      "",
    ].join("\n"),
  )
}

function writeDefaultProfile(projectDir: string): void {
  mkdirSync(join(projectDir, ".persona"), { recursive: true })
  const profile = createBackendProfile(
    createDefaultBackendAnswers(),
    "Default backend profile for policy overlay planning tests.",
  )
  writeFileSync(join(projectDir, PROFILE_PATH), `${JSON.stringify(profile, null, 2)}\n`)
}

function supportedOverlay(maxBulletsPerSource = 2): unknown {
  return {
    schema: "persona.policy-overlay.v1",
    enabled: true,
    scope: {
      role: "backend",
      mvp: "java-spring-clean-code",
      productized: false,
    },
    priority: ["company", "personal", "clean-code-baseline"],
    sources: {
      company: ".persona/policies/company/backend.md",
      personal: ".persona/policies/personal/backend.md",
    },
    limits: {
      maxBulletsPerSource,
    },
  }
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("Phase 0 policy overlay injection", () => {
  it("adds company then personal policy overlay summary to Java backend injection", () => {
    const projectDir = createTempProject()
    writePolicyOverlay(projectDir, supportedOverlay())
    writeBackendPolicies(projectDir)

    const injection = createInjectionBlock("src/main/java/com/example/coupon/application/CouponService.java", projectDir)

    expect(injection.block).toContain("Policy/philosophy overlay:")
    expect(injection.block).toContain("Priority: company > personal > Clean Code baseline")
    expect(injection.block).toContain("Company policy:")
    expect(injection.block).toContain("- Use company package conventions.")
    expect(injection.block).toContain("- Keep repository ports in domain.")
    expect(injection.block).not.toContain("- Ignore extra company bullet beyond limit.")
    expect(injection.block).toContain("Personal philosophy:")
    expect(injection.block).toContain("- Domain models should own state decisions.")
    expect(injection.block).toContain("- Application Services must not own id sequence state.")
    expect(injection.selectedPolicyOverlay).toEqual({
      enabled: true,
      sources: ["company", "personal"],
      diagnostics: [],
    })
  })

  it("adds policy overlay summary to workflow plan drafts as planning context", () => {
    const projectDir = createTempProject()
    writeFileSync(join(projectDir, "README.md"), "# Coupon API\n")
    writeDefaultProfile(projectDir)
    writePolicyOverlay(projectDir, supportedOverlay(1))
    writeBackendPolicies(projectDir)

    initializeWorkflowPlan({ projectDir })

    const plan = readFileSync(join(projectDir, ".persona", "workflow", "plan.md"), "utf8")
    expect(plan).toContain("Policy/philosophy overlay:")
    expect(plan).toContain("- Use company package conventions.")
    expect(plan).toContain("- Domain models should own state decisions.")
    expect(plan).not.toContain("- Keep repository ports in domain.")
  })

  it("does not inject policy overlay into frontend targets", () => {
    const projectDir = createTempProject()
    writePolicyOverlay(projectDir, supportedOverlay())
    writeBackendPolicies(projectDir)

    const injection = createInjectionBlock("src/components/App.tsx", projectDir)

    expect(injection.fileRole).toBe("frontend")
    expect(injection.block).not.toContain("정책/철학 오버레이:")
    expect(injection.selectedPolicyOverlay).toEqual({
      enabled: false,
      sources: [],
      diagnostics: [],
    })
  })

  it("falls back without crashing when overlay jsonc is malformed", () => {
    const projectDir = createTempProject()
    mkdirSync(join(projectDir, ".persona", "policies"), { recursive: true })
    writeFileSync(join(projectDir, ".persona", "policies", "overlay.jsonc"), "{ broken jsonc")

    const injection = createInjectionBlock("src/main/java/com/example/coupon/application/CouponService.java", projectDir)

    expect(injection.block).not.toContain("정책/철학 오버레이:")
    expect(injection.selectedPolicyOverlay.diagnostics).toContain("malformed overlay.jsonc")
  })

  it("does not inject unsupported overlay scopes", () => {
    const projectDir = createTempProject()
    writePolicyOverlay(projectDir, {
      schema: "persona.policy-overlay.v1",
      enabled: true,
      scope: {
        role: "frontend",
        mvp: "react",
        productized: false,
      },
      sources: {
        company: ".persona/policies/company/backend.md",
      },
    })
    writeBackendPolicies(projectDir)

    const injection = createInjectionBlock("src/main/java/com/example/coupon/application/CouponService.java", projectDir)

    expect(injection.block).not.toContain("정책/철학 오버레이:")
    expect(injection.selectedPolicyOverlay.diagnostics).toContain("unsupported policy overlay scope")
  })
})
