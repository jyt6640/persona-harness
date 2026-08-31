import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  HOST_SKILL_LAYOUTS,
  buildHostSkillAdapterTargets,
} from "../src/cli/host-skill-materializer.js"
import { InitManifestError } from "../src/cli/init-manifest.js"
import { listPersonaSharedSkills } from "../src/runtime/persona-shared-skill-catalog.js"

describe("host skill materializer", () => {
  it("renders one regular adapter per canonical skill and supported project layout", () => {
    const targets = buildHostSkillAdapterTargets(process.cwd())
    const skills = listPersonaSharedSkills()

    expect(targets).toHaveLength(skills.length * HOST_SKILL_LAYOUTS.length)
    for (const layout of HOST_SKILL_LAYOUTS) {
      const path = join(layout.root, `${layout.namePrefix}-deep-interview`, "SKILL.md").replace(/\\/g, "/")
      const target = targets.find((candidate) => candidate.relativePath === path)

      expect(target).toBeDefined()
      expect(target?.nextBytes.toString("utf8")).toContain(`name: ${layout.namePrefix}-deep-interview`)
      expect(target?.nextBytes.toString("utf8")).toContain("persona-harness/canonical-skill: deep-interview")
      expect(target?.nextBytes.toString("utf8")).toContain("# Product Deep Interview")
    }
  })

  it("keeps only the OpenCode-native adapter eligible for OpenCode automatic discovery", () => {
    const targets = buildHostSkillAdapterTargets(process.cwd())

    for (const layout of HOST_SKILL_LAYOUTS) {
      const path = join(layout.root, `${layout.namePrefix}-grill-me`, "SKILL.md").replace(/\\/g, "/")
      const source = targets.find((candidate) => candidate.relativePath === path)?.nextBytes.toString("utf8")

      expect(source).toContain(`opencode/autoinvoke: \"${layout.openCodeAutoinvoke ? "true" : "false"}\"`)
    }
  })

  it("fails closed with an init boundary error when the package source is unavailable", () => {
    expect(() => buildHostSkillAdapterTargets(join(tmpdir(), "persona-missing-host-skills")))
      .toThrow(InitManifestError)
  })
})
