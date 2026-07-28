import { readFileSync } from "node:fs"
import { join } from "node:path"
import process from "node:process"

import { describe, expect, it } from "vitest"

const repositoryRoot = process.cwd()

describe("installed package native descriptor audit contract", () => {
  it("preserves addon loader arity and requires reached profile leaf and parent audit stages", () => {
    // Given: the packaged Linux Node20 contract uses a preload hook around the native addon.
    const contract = readFileSync(join(repositoryRoot, "scripts", "test-installed-package-contract.mjs"), "utf8")

    // When: the contract installs its native audit hook and exercises profile replacements.
    // Then: the loader keeps its two-argument call shape and profiles plus both races require their reached native stage.
    expect(contract).toContain("process.dlopen = function patchedNativeDlopen(nativeModule, filename, flags) {")
    expect(contract).toContain("if (arguments.length === 2) originalDlopen(nativeModule, filename)")
    expect(contract).toContain("else originalDlopen(nativeModule, filename, flags)")
    expect(contract).toContain("native-stage=${stage}")
    expect(contract).toContain("--producer-intake-only")
    expect(contract).toContain("project-finish-producer-canonical-profile")
    expect(contract).toContain('assertNativeProducerInputSurface(installedPackage, consumerDirectory, "installed package")')
    expect(contract).toContain('assertNativeProducerInputSurface(repositoryRoot, repositoryRoot, "source CLI")')
    expect(contract).toContain("project-finish-producer-profile-parent")
    expect(contract).toContain('project finish producer profile replacement`, profileSentinel, "read"')
    expect(contract).toContain('writeNativeReadAuditHook(profileParentHook, "directory", "tree"')
    expect(contract).toContain('project finish producer profile parent replacement`, profileParentSentinel, "directory"')
    expect(contract).toContain("auditObservedWithoutExternal = audited.at(-1) === 0")
  })
})
