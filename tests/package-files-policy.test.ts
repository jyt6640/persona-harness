import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

type PackageJson = {
  readonly files: readonly string[]
}

type MarkdownLink = {
  readonly href: string
  readonly label: string
}

const packageRoot = process.cwd()

describe("package files policy", () => {
  it("packages public rules while retaining diff-rules only as repository source material", () => {
    const packageJson = readPackageJson(path.join(packageRoot, "package.json"))
    const ruleFiles = listRuleMarkdownFiles(path.join(packageRoot, ".persona/rules")).map((filePath) =>
      toPackagePath(path.relative(packageRoot, filePath)),
    )
    const diffRuleFiles = ruleFiles.filter((filePath) => filePath.startsWith(".persona/rules/diff-rules/"))
    const packagedRuleFiles = ruleFiles.filter((filePath) => !filePath.startsWith(".persona/rules/diff-rules/"))

    expect(ruleFiles).toHaveLength(48)
    expect(diffRuleFiles).toHaveLength(28)
    expect(packagedRuleFiles).toHaveLength(20)
    expect(packageJson.files).not.toContain(".persona/rules/diff-rules")

    for (const ruleFile of packagedRuleFiles) {
      expect(isCoveredByPackageFiles(ruleFile, packageJson.files)).toBe(true)
    }
    for (const ruleFile of diffRuleFiles) {
      expect(isCoveredByPackageFiles(ruleFile, packageJson.files)).toBe(false)
    }
  })

  it("keeps all source convention yaml files covered by packaged files", () => {
    const packageJson = readPackageJson(path.join(packageRoot, "package.json"))
    const conventionFiles = listConventionFiles(path.join(packageRoot, ".persona/conventions")).map((filePath) =>
      toPackagePath(path.relative(packageRoot, filePath)),
    )

    expect(conventionFiles).toHaveLength(8)

    for (const conventionFile of conventionFiles) {
      expect(isCoveredByPackageFiles(conventionFile, packageJson.files)).toBe(true)
    }
  })

  it("keeps the entry intent corpus and measurement scripts source-only", () => {
    const packageJson = readPackageJson(path.join(packageRoot, "package.json"))

    expect(existsSync(path.join(packageRoot, "experiments/entry-intent-corpus/corpus.json"))).toBe(true)
    expect(packageJson.files).not.toContain("experiments")
    expect(isCoveredByPackageFiles("experiments/entry-intent-corpus/corpus.json", packageJson.files)).toBe(false)
    expect(isCoveredByPackageFiles("experiments/entry-intent-corpus/measure.mjs", packageJson.files)).toBe(false)
  })

  it("keeps P3 adversarial closure fixtures source-only", () => {
    const packageJson = readPackageJson(path.join(packageRoot, "package.json"))

    expect(existsSync(path.join(packageRoot, "experiments/p3-adversarial-closure-fixtures/corpus.json"))).toBe(true)
    expect(packageJson.files).not.toContain("experiments")
    expect(isCoveredByPackageFiles("experiments/p3-adversarial-closure-fixtures/corpus.json", packageJson.files)).toBe(false)
    expect(isCoveredByPackageFiles("experiments/p3-adversarial-closure-fixtures/validate.mjs", packageJson.files)).toBe(false)
  })

  it("keeps every P3-7 init contract file source-only", () => {
    const packageJson = readPackageJson(path.join(packageRoot, "package.json"))
    const experimentRoot = path.join(packageRoot, "experiments/p3-7-ph-init-safe-upgrade-contract")
    const files = listFiles(experimentRoot).map((filePath) => toPackagePath(path.relative(packageRoot, filePath)))

    expect(files.length).toBeGreaterThan(8)
    expect(packageJson.files).not.toContain("experiments")
    for (const file of files) {
      expect(isCoveredByPackageFiles(file, packageJson.files)).toBe(false)
    }
    expect(isCoveredByPackageFiles("tests/p3-7-ph-init-safe-upgrade-contract.test.ts", packageJson.files)).toBe(false)
  })

  it("keeps report-only test-integrity detector evidence source-only", () => {
    const packageJson = readPackageJson(path.join(packageRoot, "package.json"))
    const experimentRoot = path.join(packageRoot, "experiments/report-only-test-integrity-detector")
    const files = listFiles(experimentRoot).map((filePath) => toPackagePath(path.relative(packageRoot, filePath)))

    expect(files).toHaveLength(9)
    expect(packageJson.files).not.toContain("experiments")
    for (const file of files) {
      expect(isCoveredByPackageFiles(file, packageJson.files)).toBe(false)
    }
  })

  it("keeps filesystem residue corpus source-only", () => {
    const packageJson = readPackageJson(path.join(packageRoot, "package.json"))
    const experimentRoot = path.join(packageRoot, "experiments/filesystem-residue-corpus")
    const files = listFiles(experimentRoot).map((filePath) => toPackagePath(path.relative(packageRoot, filePath)))

    expect(files.length).toBeGreaterThan(8)
    expect(packageJson.files).not.toContain("experiments")
    for (const file of files) {
      expect(isCoveredByPackageFiles(file, packageJson.files)).toBe(false)
    }
  })

  it("keeps fixture qualification authorization source-only", () => {
    const packageJson = readPackageJson(path.join(packageRoot, "package.json"))
    const experimentRoot = path.join(packageRoot, "experiments/fixture-qualification-authorization")
    const files = listFiles(experimentRoot).map((filePath) => toPackagePath(path.relative(packageRoot, filePath)))

    expect(files.length).toBeGreaterThan(8)
    expect(packageJson.files).not.toContain("experiments")
    for (const file of files) {
      expect(isCoveredByPackageFiles(file, packageJson.files)).toBe(false)
    }
  })

  it("packages the staged package verifier CLI while retaining its release contract", () => {
    const packageJson = readPackageJson(path.join(packageRoot, "package.json"))
    const sourcePaths = [
      "src/cli/staged-package-verification-assessment.ts",
      "src/cli/staged-package-verification-command.ts",
      "src/cli/staged-package-verification-core.ts",
      "src/cli/staged-package-verification-installed.ts",
      "src/cli/staged-package-verification-runner.ts",
      "src/cli/staged-package-verification-runtime.ts",
      "src/cli/staged-package-verification-types.ts",
    ]
    const packagedRuntimePaths = [
      "dist/cli/staged-package-verification-assessment.js",
      "dist/cli/staged-package-verification-command.js",
      "dist/cli/staged-package-verification-core.js",
      "dist/cli/staged-package-verification-installed.js",
      "dist/cli/staged-package-verification-runner.js",
      "dist/cli/staged-package-verification-runtime.js",
      "dist/cli/staged-package-verification-types.js",
    ]
    const packagedContract = "docs/current/release/staged-package-verification.md"

    for (const filePath of sourcePaths) {
      expect(existsSync(path.join(packageRoot, filePath))).toBe(true)
    }
    for (const filePath of packagedRuntimePaths) {
      expect(isCoveredByPackageFiles(filePath, packageJson.files)).toBe(true)
    }
    expect(existsSync(path.join(packageRoot, "scripts", "staged-package-verification.mjs"))).toBe(false)
    expect(existsSync(path.join(packageRoot, packagedContract))).toBe(true)
    expect(isCoveredByPackageFiles(packagedContract, packageJson.files)).toBe(true)
  })

  it("packages bounded doctor registry readback with the public CLI", () => {
    const packageJson = readPackageJson(path.join(packageRoot, "package.json"))
    const sourcePaths = [
      "src/cli/doctor-registry.ts",
      "src/cli/doctor-registry-readback.ts",
    ]
    const runtimePaths = [
      "dist/cli/doctor-registry.js",
      "dist/cli/doctor-registry-readback.js",
    ]

    for (const filePath of sourcePaths) {
      expect(existsSync(path.join(packageRoot, filePath))).toBe(true)
    }
    for (const filePath of runtimePaths) {
      expect(isCoveredByPackageFiles(filePath, packageJson.files)).toBe(true)
    }
  })

  it("packages the fixed-policy artifact provenance verifier but excludes its signed fixture", () => {
    const packageJson = readPackageJson(path.join(packageRoot, "package.json"))
    const packagedScripts = [
      "scripts/staged-package-artifact-provenance-core.mjs",
      "scripts/staged-package-artifact-provenance-crypto.mjs",
      "scripts/staged-package-artifact-provenance-network.mjs",
      "scripts/staged-package-artifact-provenance-policy.mjs",
      "scripts/staged-package-artifact-tarball.mjs",
      "scripts/verify-staged-package-artifact-attestation.mjs",
    ]
    const sourcePaths = [
      "src/cli/staged-package-artifact-provenance-command.ts",
      "src/cli/staged-package-artifact-provenance-types.ts",
      "src/cli/staged-package-artifact-provenance-worker.ts",
    ]
    const runtimePaths = [
      "dist/cli/staged-package-artifact-provenance-command.js",
      "dist/cli/staged-package-artifact-provenance-types.js",
      "dist/cli/staged-package-artifact-provenance-worker.js",
    ]
    const fixturePaths = [
      "tests/fixtures/staged-package-artifact/rc6/action-run.json",
      "tests/fixtures/staged-package-artifact/rc6/bundle.json",
      "tests/fixtures/staged-package-artifact/rc6/manifest.json",
      "tests/fixtures/staged-package-artifact/rc6/package.tgz",
      "tests/fixtures/staged-package-artifact/rc6/predicate.json",
    ]

    for (const filePath of [...packagedScripts, ...sourcePaths]) {
      expect(existsSync(path.join(packageRoot, filePath))).toBe(true)
    }
    for (const filePath of [...packagedScripts, ...runtimePaths]) {
      expect(isCoveredByPackageFiles(filePath, packageJson.files)).toBe(true)
    }
    for (const fixturePath of fixturePaths) {
      expect(existsSync(path.join(packageRoot, fixturePath))).toBe(true)
      expect(isCoveredByPackageFiles(fixturePath, packageJson.files)).toBe(false)
    }
  })

  it("keeps the staged artifact producer source-only while packaging its boundary record", () => {
    const packageJson = readPackageJson(path.join(packageRoot, "package.json"))
    const producerPaths = [
      "scripts/build-staged-package-artifact-attestation.mjs",
      "scripts/staged-package-artifact-attestation-core.mjs",
      "scripts/staged-package-artifact-attestation-core.d.mts",
      "scripts/staged-package-artifact-context-diagnostic-core.mjs",
      "scripts/staged-package-artifact-context-diagnostic-core.d.mts",
      "scripts/diagnose-staged-package-artifact-context.mjs",
      "scripts/staged-package-artifact-native-context-diagnostic.mjs",
      "scripts/staged-package-artifact-native-context-diagnostic.d.mts",
      "scripts/diagnose-native-staged-package-artifact-context.mjs",
    ]
    const boundaryRecord = "docs/current/release/staged-package-artifact-attestation-producer.md"

    for (const filePath of producerPaths) {
      expect(existsSync(path.join(packageRoot, filePath))).toBe(true)
      expect(isCoveredByPackageFiles(filePath, packageJson.files)).toBe(false)
    }
    expect(existsSync(path.join(packageRoot, boundaryRecord))).toBe(true)
    expect(isCoveredByPackageFiles(boundaryRecord, packageJson.files)).toBe(true)
  })

  it("keeps the project finish attestation producer source-only while packaging its boundary record", () => {
    const packageJson = readPackageJson(path.join(packageRoot, "package.json"))
    const sourceOnlyPaths = [
      ".github/workflows/persona-harness-project-finish.yml",
      ".github/workflows/persona-harness-project-finish-context-diagnostic.yml",
      ".github/workflows/project-finish-context-diagnostic-selftest.yml",
      ".github/actions/project-finish-context-diagnostic/action.yml",
      ".github/actions/project-finish-context-diagnostic/index.mjs",
      ".github/actions/project-finish-context-diagnostic/oidc-capability-bridge.cjs",
      ".github/actions/project-finish-context-diagnostic/oidc-capability-bridge-summary.cjs",
      ".github/actions/project-finish-context-diagnostic-fallback/action.yml",
      ".github/actions/project-finish-context-diagnostic-fallback/index.mjs",
      ".github/actions/project-finish-context-diagnostic-finalizer/action.yml",
      ".github/actions/project-finish-context-diagnostic-finalizer/index.mjs",
      ".github/actions/project-finish-context-diagnostic-outcome/action.yml",
      ".github/actions/project-finish-context-diagnostic-outcome/index.mjs",
      ".github/actions/project-finish-context-diagnostic-selftest/action.yml",
      ".github/actions/project-finish-context-diagnostic-selftest/index.mjs",
      ".github/actions/project-finish-context-diagnostic-selftest/native.mjs",
      ".github/actions/project-finish-context-diagnostic-selftest/selftest.mjs",
      ".github/actions/project-finish-context-diagnostic-native-selftest/action.yml",
      ".github/actions/project-finish-context-diagnostic-native-selftest/index.mjs",
      ".github/actions/project-finish-context-diagnostic-native-selftest/native-selftest.mjs",
      "scripts/build-project-finish-attestation.mjs",
      "scripts/build-project-finish-attestation.d.mts",
      "scripts/project-finish-attestation-artifact-output.mjs",
      "scripts/project-finish-attestation-artifact-output.d.mts",
      "scripts/project-finish-attestation-artifact-handoff.mjs",
      "scripts/project-finish-attestation-artifact-handoff.d.mts",
      "scripts/project-finish-attestation-producer-context.mjs",
      "scripts/project-finish-attestation-producer-context-diagnostic.mjs",
      "scripts/project-finish-attestation-producer-context-diagnostic.d.mts",
      "scripts/project-finish-attestation-oidc.mjs",
      "scripts/project-finish-attestation-producer-oidc-capability-bridge.cjs",
      "scripts/project-finish-attestation-producer-oidc-capability-bridge.d.cts",
      "scripts/diagnose-project-finish-producer-context.mjs",
      "tests/fixtures/project-finish-attestation/caller-workflow.yml",
      "tests/project-finish-attestation-producer-workflow.test.ts",
      "tests/project-finish-attestation-artifact-builder.test.ts",
      "tests/project-finish-attestation-artifact-output.test.ts",
      "tests/project-finish-attestation-artifact-handoff.test.ts",
      "tests/project-finish-attestation-producer-inputs.test.ts",
      "tests/project-finish-attestation-producer-profile.test.ts",
      "tests/project-finish-attestation-oidc.test.ts",
      "tests/project-finish-attestation-producer-context-diagnostic.test.ts",
      "tests/project-finish-attestation-producer-context-diagnostic-cli.test.ts",
      "tests/project-finish-attestation-producer-context-diagnostic-forwarding.test.ts",
      "tests/project-finish-attestation-producer-context-diagnostic-summary.test.ts",
      "tests/project-finish-attestation-producer-context-diagnostic-workflow.test.ts",
      "tests/project-finish-attestation-producer-context-diagnostic-fallback.test.ts",
    ]
    const runtimePaths = [
      "dist/cli/project-finish-attestation-inputs.js",
      "dist/cli/project-finish-attestation-producer.js",
      "dist/cli/project-finish-attestation-producer-runner.js",
      "dist/io/no-follow-file.js",
    ]
    const boundaryRecord = "docs/current/release/project-finish-attestation-producer.md"

    for (const filePath of sourceOnlyPaths) {
      expect(existsSync(path.join(packageRoot, filePath))).toBe(true)
      expect(isCoveredByPackageFiles(filePath, packageJson.files)).toBe(false)
    }
    for (const filePath of runtimePaths) {
      expect(isCoveredByPackageFiles(filePath, packageJson.files)).toBe(true)
    }
    expect(existsSync(path.join(packageRoot, boundaryRecord))).toBe(true)
    expect(isCoveredByPackageFiles(boundaryRecord, packageJson.files)).toBe(true)

    const candidateBoundaryPaths = [...sourceOnlyPaths, boundaryRecord]
    const packagedCandidateBoundaryPaths = candidateBoundaryPaths.filter((filePath) =>
      isCoveredByPackageFiles(filePath, packageJson.files),
    )
    const boundaryRecordText = readFileSync(path.join(packageRoot, boundaryRecord), "utf8")

    expect(packagedCandidateBoundaryPaths).toEqual([boundaryRecord])
    expect(boundaryRecordText).toContain("same package path set but content-different")
    expect(boundaryRecordText).toMatch(/requires fresh\s+External verification/u)
  })

  it("packages the project finish verifier worker without packaging synthetic attestation evidence", () => {
    const packageJson = readPackageJson(path.join(packageRoot, "package.json"))
    const runtimePaths = [
      "dist/cli/project-finish-attestation-assessment.js",
      "dist/cli/project-finish-attestation-evidence.js",
      "dist/cli/project-finish-attestation-policy.js",
      "dist/cli/project-finish-attestation-source.js",
      "dist/cli/project-finish-attestation-verifier-types.js",
      "dist/cli/project-finish-attestation-verifier.js",
      "dist/cli/project-finish-attestation-worker.js",
      "dist/cli/project-finish-trust-readiness.js",
      "scripts/project-finish-attestation-sigstore-error.d.mts",
      "scripts/project-finish-attestation-sigstore-error.mjs",
      "scripts/verify-project-finish-attestation.mjs",
      "scripts/node-runtime-floor.mjs",
      "scripts/node-runtime-floor.d.mts",
    ]
    const sourceOnlyPaths = [
      "tests/project-finish-attestation-consumption.test.ts",
      "tests/project-finish-attestation-source.test.ts",
      "tests/project-finish-attestation-verifier.test.ts",
      "tests/project-finish-attestation-worker.test.ts",
      "tests/helpers/project-finish-attestation-fixture.ts",
    ]

    for (const filePath of runtimePaths) {
      expect(isCoveredByPackageFiles(filePath, packageJson.files)).toBe(true)
    }
    expect(existsSync(path.join(packageRoot, "scripts/verify-project-finish-attestation.mjs"))).toBe(true)
    for (const filePath of sourceOnlyPaths) {
      expect(existsSync(path.join(packageRoot, filePath))).toBe(true)
      expect(isCoveredByPackageFiles(filePath, packageJson.files)).toBe(false)
    }
  })

  it("packages the enrolled consumer-authority retrieval path without packaging its synthetic evidence", () => {
    const packageJson = readPackageJson(path.join(packageRoot, "package.json"))
    const packagedScripts = [
      "scripts/consumer-authority-artifact-archive.mjs",
      "scripts/consumer-authority-artifact-error.mjs",
      "scripts/fetch-consumer-authority-artifact.mjs",
      "scripts/read-consumer-authority-github.mjs",
    ]
    const runtimePaths = [
      "dist/cli/authority-artifact-store.js",
      "dist/cli/authority-command.js",
      "dist/cli/authority-enrollment.js",
      "dist/cli/authority-fetch-worker.js",
      "dist/cli/authority-github-readback-worker.js",
      "dist/cli/authority-project-attestation.js",
    ]
    const sourceOnlyPaths = [
      "tests/authority-artifact-fetch.test.ts",
      "tests/authority-artifact-store.test.ts",
      "tests/authority-command.test.ts",
      "tests/authority-fetch-worker.test.ts",
      "tests/authority-github-readback.test.ts",
      "tests/authority-project-attestation.test.ts",
    ]
    const boundaryRecord = "docs/current/release/consumer-authority-beta.md"

    for (const filePath of [...packagedScripts, ...runtimePaths]) {
      expect(isCoveredByPackageFiles(filePath, packageJson.files)).toBe(true)
    }
    for (const filePath of sourceOnlyPaths) {
      expect(existsSync(path.join(packageRoot, filePath))).toBe(true)
      expect(isCoveredByPackageFiles(filePath, packageJson.files)).toBe(false)
    }
    expect(existsSync(path.join(packageRoot, boundaryRecord))).toBe(true)
    expect(isCoveredByPackageFiles(boundaryRecord, packageJson.files)).toBe(true)
  })

  it("keeps direct current README links covered by packaged files", () => {
    const packageJson = readPackageJson(path.join(packageRoot, "package.json"))
    const currentReadmePath = path.join(packageRoot, "docs/current/README.md")
    const currentReadme = readFileSync(currentReadmePath, "utf8")
    const links = extractDirectRelativeMarkdownLinks(currentReadme)

    const linkedFiles = links.map((link) => {
      const resolved = path.relative(packageRoot, path.resolve(path.dirname(currentReadmePath), link.href))
      return toPackagePath(resolved)
    })

    expect(linkedFiles).toEqual([
      "README.md",
      "docs/START-HERE.md",
      "docs/QUICK-DEMO.md",
      "docs/MEASURED-CLAIMS.md",
      "docs/releases/README.md",
      "docs/current/canonical-docs-index.md",
      "docs/releases/v0.7.0-rc.3/README.md",
      "docs/releases/v0.7.0-rc.2/README.md",
      "docs/releases/v0.7.0-rc.1/README.md",
      "docs/releases/v0.6.0/README.md",
      "docs/releases/package-index.md",
      "docs/current/release/README.md",
      "docs/current/release/v0.8.0-beta.1-release-notes.md",
      "docs/current/p3-integrity-roadmap.md",
      "docs/current/p3-2-closure-authority-acceptance-record.md",
      "docs/current/p3-3-verification-receipt-acceptance-record.md",
      "docs/current/p3-8-ci-release-integrity-acceptance-record.md",
      "docs/current/p3-9-rc3-integrity-governance-decision.md",
      "docs/current/stable-containment-execution-evidence.md",
      "docs/current/p3-4-fresh-fixed-command-verifier-acceptance-record.md",
      "docs/current/p3-5-semantic-tdd-acceptance-record.md",
      "docs/current/consumer-authority-v1-decision.md",
      "docs/current/canonical-docs-index.md",
      "docs/current/workflow-closure-state-machine-design.md",
      "docs/current/external-review-adoption-status.md",
      "docs/current/diff-rules-classification.md",
      "docs/current/role-rules-dogfooding-readiness.md",
      "docs/current/workflow-string-gate-parsing-audit.md",
      "docs/current/workflow-state-concurrency.md",
      "docs/current/role-scoped-rule-delivery.md",
      "docs/current/ralph-loop-measurement-status.md",
      "docs/current/multiagent-relay-trial-status.md",
      "docs/current/rail-entry-measurement-status.md",
      "docs/current/entry-steering-status.md",
      "docs/current/rail-entry-prompt-regression-gate.md",
      "docs/current/measurement-scorecard.md",
      "docs/current/injection-value-status.json",
      "docs/current/docs-inventory.md",
      "docs/current/release/v0.8.0-beta.1-release-notes.md",
      "docs/current/korean-cli-help-scope-authorization.md",
    ])

    for (const linkedFile of linkedFiles) {
      expect(existsSync(path.join(packageRoot, linkedFile))).toBe(true)
      expect(isCoveredByPackageFiles(linkedFile, packageJson.files)).toBe(true)
    }
  })
})

function listRuleMarkdownFiles(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        return listRuleMarkdownFiles(entryPath)
      }
      return entry.isFile() && entry.name.endsWith(".md") ? [entryPath] : []
    })
    .sort()
}

function listConventionFiles(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        return listConventionFiles(entryPath)
      }
      return entry.isFile() && /\.(ya?ml)$/iu.test(entry.name) ? [entryPath] : []
    })
    .sort()
}

function listFiles(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name)
      return entry.isDirectory() ? listFiles(entryPath) : entry.isFile() ? [entryPath] : []
    })
    .sort()
}

function readPackageJson(filePath: string): PackageJson {
  const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"))
  if (!isPackageJson(parsed)) {
    throw new TypeError(`Invalid package metadata: ${filePath}`)
  }
  return parsed
}

function extractDirectRelativeMarkdownLinks(markdown: string): readonly MarkdownLink[] {
  const links: MarkdownLink[] = []
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g

  for (const match of markdown.matchAll(linkPattern)) {
    const label = match[1]
    const href = match[2]
    if (label === undefined || href === undefined) continue
    if (href.startsWith("#") || href.includes("://")) continue
    links.push({ href, label })
  }

  return links
}

function isCoveredByPackageFiles(filePath: string, files: readonly string[]): boolean {
  return files.some((entry) => packageFileEntryCoversPath(entry, filePath))
}

function packageFileEntryCoversPath(entry: string, filePath: string): boolean {
  const normalizedEntry = toPackagePath(entry)
  const normalizedFilePath = toPackagePath(filePath)
  return normalizedFilePath === normalizedEntry || normalizedFilePath.startsWith(`${normalizedEntry}/`)
}

function toPackagePath(filePath: string): string {
  return filePath.split(path.sep).join("/")
}

function isPackageJson(value: unknown): value is PackageJson {
  return isRecord(value) && isStringArray(value["files"])
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
