import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const auditPath = resolve(repositoryRoot, "docs/evidence-reviews/2026-08-22-source-provenance-audit.json")
const noticePath = resolve(repositoryRoot, "NOTICE")
const sbomPath = resolve(repositoryRoot, "docs/evidence-reviews/2026-08-22-source-sbom.cdx.json")
const expectedRemovedSubtrees = [
  "packages/shared-skills/skills/advanced",
  "packages/shared-skills/skills/debugging",
  "packages/shared-skills/skills/git-master",
  "packages/shared-skills/skills/init-deep",
  "packages/shared-skills/skills/remove-ai-slops",
  "packages/shared-skills/skills/review-work",
  "packages/shared-skills/skills/start-work",
  "packages/shared-skills/skills/ultraresearch",
  "packages/shared-skills/skills/ulw-plan",
  "packages/shared-skills/skills/lsp-setup/references",
  "packages/shared-skills/skills/lsp-setup/scripts",
  "packages/shared-skills/skills/visual-qa/references",
  "packages/shared-skills/skills/visual-qa/scripts",
  "packages/shared-skills/skills/programming/references/go",
  "packages/shared-skills/skills/programming/references/python",
  "packages/shared-skills/skills/programming/references/rust",
  "packages/shared-skills/skills/programming/references/rust-ub",
  "packages/shared-skills/skills/programming/references/typescript",
  "packages/shared-skills/skills/programming/scripts/go",
  "packages/shared-skills/skills/programming/scripts/python",
  "packages/shared-skills/skills/programming/scripts/rust",
  "packages/shared-skills/skills/programming/scripts/typescript",
  "packages/shared-skills/skills/programming/agents",
  "packages/shared-skills/skills/frontend/ATTRIBUTION.md",
  "packages/shared-skills/skills/frontend/LICENSE-Apache-2.0.txt",
  "packages/shared-skills/skills/frontend/references",
  "packages/shared-skills/skills/frontend/scripts",
]

function fail(message) {
  throw new Error(`source-provenance-audit: ${message}`)
}

function readAudit() {
  if (!existsSync(auditPath)) {
    fail("audit-missing")
  }

  let parsed
  try {
    parsed = JSON.parse(readFileSync(auditPath, "utf8"))
  } catch {
    fail("audit-malformed")
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    fail("audit-shape-invalid")
  }
  return parsed
}

function requireRecord(record) {
  if (record === null || typeof record !== "object" || Array.isArray(record)) {
    fail("record-shape-invalid")
  }
  const { blobSha, disposition, path, upstreamPath } = record
  if (typeof blobSha !== "string" || !/^[0-9a-f]{40}$/u.test(blobSha)) {
    fail("record-blob-invalid")
  }
  if (typeof disposition !== "string" || !["removed-before-candidate", "retained-under-mit"].includes(disposition)) {
    fail("record-disposition-invalid")
  }
  if (typeof path !== "string" || path.length === 0 || path.startsWith("/") || path.split("/").includes("..")) {
    fail("record-path-invalid")
  }
  if (typeof upstreamPath !== "string" || upstreamPath !== path) {
    fail("record-upstream-path-invalid")
  }
  return { blobSha, disposition, path }
}

function requireStringArray(value, code) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.length === 0)) {
    fail(code)
  }
  return value
}

function readJson(path, missingCode, malformedCode) {
  if (!existsSync(path)) {
    fail(missingCode)
  }

  try {
    return JSON.parse(readFileSync(path, "utf8"))
  } catch {
    fail(malformedCode)
  }
}

function requireObject(value, code) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(code)
  }
  return value
}

const audit = readAudit()
if (audit.schemaVersion !== "source-provenance-audit.1") {
  fail("schema-unsupported")
}
if (audit.upstream === null || typeof audit.upstream !== "object" || Array.isArray(audit.upstream)) {
  fail("upstream-shape-invalid")
}
if (
  audit.upstream.repository !== "https://github.com/code-yeongyu/oh-my-openagent" ||
  audit.upstream.commit !== "bddfeb521545489860030acf19e82ac47f6db15d" ||
  audit.upstream.tree !== "c63f034fd3734858118c96f0e485e8db1502dcf7" ||
  audit.upstream.license !== "Sustainable Use License 1.0"
) {
  fail("upstream-binding-invalid")
}
if (audit.auditDate !== "2026-08-22") {
  fail("audit-date-invalid")
}
const comparison = requireObject(audit.comparison, "comparison-shape-invalid")
if (
  comparison.candidateBase !== "699eac5fdeda5dd17393bdd5493118b9fb8543c5" ||
  comparison.method !== "exact-git-blob-same-path" ||
  comparison.candidatePathCount !== 143 ||
  comparison.rawMatchPairCount !== 154 ||
  comparison.crossPathLicenseOnlyPairCount !== 11
) {
  fail("comparison-binding-invalid")
}
if (!Array.isArray(audit.exactSamePathMatches)) {
  fail("records-missing")
}

const records = audit.exactSamePathMatches.map(requireRecord)
if (records.length !== 143) {
  fail("record-count-invalid")
}
const uniquePaths = new Set(records.map((record) => record.path))
if (uniquePaths.size !== records.length) {
  fail("record-path-duplicate")
}

const removed = records.filter((record) => record.disposition === "removed-before-candidate")
const retained = records.filter((record) => record.disposition === "retained-under-mit")
if (removed.length !== 132 || retained.length !== 11) {
  fail("record-disposition-count-invalid")
}

for (const record of removed) {
  if (existsSync(resolve(repositoryRoot, record.path))) {
    fail(`removed-path-present:${record.path}`)
  }
}

for (const record of retained) {
  if (!record.path.startsWith("packages/shared-skills/skills/ast-grep/")) {
    fail("retained-path-unapproved")
  }
  if (!existsSync(resolve(repositoryRoot, record.path))) {
    fail(`retained-path-missing:${record.path}`)
  }
}

const removedSubtrees = requireStringArray(audit.removedSubtrees, "removed-subtrees-invalid")
if (JSON.stringify(removedSubtrees) !== JSON.stringify(expectedRemovedSubtrees)) {
  fail("removed-subtrees-binding-invalid")
}
for (const removedSubtree of removedSubtrees) {
  if (removedSubtree.startsWith("/") || removedSubtree.split("/").includes("..")) {
    fail("removed-subtree-path-invalid")
  }
  if (existsSync(resolve(repositoryRoot, removedSubtree))) {
    fail(`removed-subtree-present:${removedSubtree}`)
  }
}

const sourceMarker = readFileSync(resolve(repositoryRoot, "packages/shared-skills/skills/ast-grep/SOURCE"), "utf8")
const license = readFileSync(resolve(repositoryRoot, "packages/shared-skills/skills/ast-grep/LICENSE"), "utf8")
if (!sourceMarker.includes("https://github.com/code-yeongyu/ast-grep-skill @ 3148c69")) {
  fail("ast-grep-source-marker-invalid")
}
if (!license.startsWith("MIT License\n")) {
  fail("ast-grep-license-invalid")
}

const notice = readFileSync(noticePath, "utf8")
if (
  !notice.includes("ast-grep-skill") ||
  !notice.includes("https://github.com/code-yeongyu/ast-grep-skill") ||
  !notice.includes("3148c69c370a51afb661b9f37879c0bd7cf0cc3b") ||
  !notice.includes("MIT License")
) {
  fail("notice-binding-invalid")
}

const packageJson = readJson(resolve(repositoryRoot, "package.json"), "package-json-missing", "package-json-malformed")
const packageMetadata = requireObject(packageJson, "package-json-shape-invalid")
if (
  !Array.isArray(packageMetadata.files) ||
  ![
    "NOTICE",
    "packages/shared-skills/skills/ast-grep/LICENSE",
    "packages/shared-skills/skills/ast-grep/SOURCE",
  ].every((path) => packageMetadata.files.includes(path))
) {
  fail("package-notice-source-marker-unshipped")
}
const sbom = requireObject(readJson(sbomPath, "sbom-missing", "sbom-malformed"), "sbom-shape-invalid")
if (sbom.bomFormat !== "CycloneDX" || sbom.specVersion !== "1.5") {
  fail("sbom-format-invalid")
}
const metadata = requireObject(sbom.metadata, "sbom-metadata-invalid")
const rootComponent = requireObject(metadata.component, "sbom-root-component-invalid")
if (
  rootComponent.name !== packageMetadata.name ||
  rootComponent.version !== packageMetadata.version ||
  rootComponent.type !== "application"
) {
  fail("sbom-root-component-binding-invalid")
}
if (!Array.isArray(sbom.components) || sbom.components.length !== 1) {
  fail("sbom-components-invalid")
}
const astGrepComponent = requireObject(sbom.components[0], "sbom-ast-grep-component-invalid")
if (
  astGrepComponent.name !== "ast-grep-skill" ||
  astGrepComponent.version !== "0.43.0" ||
  astGrepComponent.type !== "file" ||
  !Array.isArray(astGrepComponent.licenses) ||
  astGrepComponent.licenses.length !== 1 ||
  requireObject(astGrepComponent.licenses[0], "sbom-license-entry-invalid").license === undefined ||
  requireObject(requireObject(astGrepComponent.licenses[0], "sbom-license-entry-invalid").license, "sbom-license-invalid").id !== "MIT"
) {
  fail("sbom-ast-grep-binding-invalid")
}

process.stdout.write(`Source provenance audit: PASS (${removed.length} removed, ${retained.length} MIT-retained)\n`)
