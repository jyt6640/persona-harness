import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

type AuditRecord = {
  readonly blobSha: string
  readonly disposition: "removed-before-candidate" | "retained-under-mit"
  readonly path: string
  readonly upstreamPath: string
}

type SourceProvenanceAudit = {
  readonly comparison: {
    readonly candidateBase: string
    readonly candidatePathCount: number
    readonly crossPathLicenseOnlyPairCount: number
    readonly method: string
    readonly rawMatchPairCount: number
  }
  readonly exactSamePathMatches: readonly AuditRecord[]
  readonly schemaVersion: string
  readonly upstream: {
    readonly commit: string
    readonly license: string
    readonly repository: string
    readonly tree: string
  }
}

type SourceSbom = {
  readonly bomFormat: string
  readonly components: readonly {
    readonly licenses: readonly { readonly license: { readonly id: string } }[]
    readonly name: string
    readonly type: string
    readonly version: string
  }[]
  readonly metadata: {
    readonly component: {
      readonly "bom-ref": string
      readonly name: string
      readonly type: string
      readonly version: string
    }
  }
  readonly specVersion: string
}

type RootPackage = {
  readonly files: readonly string[]
  readonly name: string
  readonly version: string
}

type SharedSkillsPackage = {
  readonly files: readonly string[]
}

const repositoryRoot = process.cwd()

describe("source provenance audit", () => {
  it("removes unlicensed OMO-origin matches while retaining only explicit MIT ast-grep material", () => {
    const audit = JSON.parse(
      readFileSync(join(repositoryRoot, "docs/evidence-reviews/2026-08-22-source-provenance-audit.json"), "utf8"),
    ) as SourceProvenanceAudit

    expect(audit.schemaVersion).toBe("source-provenance-audit.1")
    expect(audit.comparison).toEqual({
      candidateBase: "699eac5fdeda5dd17393bdd5493118b9fb8543c5",
      method: "exact-git-blob-same-path",
      candidatePathCount: 143,
      rawMatchPairCount: 154,
      crossPathLicenseOnlyPairCount: 11,
    })
    expect(audit.upstream).toEqual({
      repository: "https://github.com/code-yeongyu/oh-my-openagent",
      commit: "bddfeb521545489860030acf19e82ac47f6db15d",
      tree: "c63f034fd3734858118c96f0e485e8db1502dcf7",
      license: "Sustainable Use License 1.0",
    })
    expect(audit.exactSamePathMatches).toHaveLength(143)
    expect(audit.exactSamePathMatches.filter((record) => record.disposition === "removed-before-candidate")).toHaveLength(132)
    expect(audit.exactSamePathMatches.filter((record) => record.disposition === "retained-under-mit")).toHaveLength(11)
    expect(existsSync(join(repositoryRoot, "NOTICE"))).toBe(true)

    const sbom = JSON.parse(
      readFileSync(join(repositoryRoot, "docs/evidence-reviews/2026-08-22-source-sbom.cdx.json"), "utf8"),
    ) as SourceSbom

    expect(sbom.bomFormat).toBe("CycloneDX")
    expect(sbom.specVersion).toBe("1.5")
    const rootPackage = JSON.parse(readFileSync(join(repositoryRoot, "package.json"), "utf8")) as RootPackage
    expect(sbom.metadata.component).toMatchObject({
      "bom-ref": `pkg:npm/${rootPackage.name}@${rootPackage.version}`,
      name: rootPackage.name,
      type: "application",
      version: rootPackage.version,
    })
    expect(sbom.components).toEqual([
      expect.objectContaining({
        name: "ast-grep-skill",
        type: "file",
        version: "0.43.0",
        licenses: [{ license: { id: "MIT" } }],
      }),
    ])
    expect(rootPackage.files).toEqual(expect.arrayContaining([
      "NOTICE",
      "packages/shared-skills/skills/ast-grep/LICENSE",
      "packages/shared-skills/skills/ast-grep/SOURCE",
    ]))
    const sharedSkillsPackage = JSON.parse(
      readFileSync(join(repositoryRoot, "packages/shared-skills/package.json"), "utf8"),
    ) as SharedSkillsPackage
    expect(sharedSkillsPackage.files).toEqual(expect.arrayContaining([
      "skills/ast-grep/LICENSE",
      "skills/ast-grep/SOURCE",
    ]))

    const result = spawnSync(process.execPath, ["scripts/check-source-provenance-audit.mjs"], {
      cwd: repositoryRoot,
      encoding: "utf8",
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Source provenance audit: PASS (132 removed, 11 MIT-retained)")
  })
})
