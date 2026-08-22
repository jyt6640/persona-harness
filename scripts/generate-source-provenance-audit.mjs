import { readFileSync, writeFileSync } from "node:fs"

const [inputPath, outputPath] = process.argv.slice(2)

if (inputPath === undefined || outputPath === undefined || process.argv.length !== 4) {
  throw new Error("usage: node scripts/generate-source-provenance-audit.mjs <same-path-tsv> <output-json>")
}

const removedSubtrees = [
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
  throw new Error(`generate-source-provenance-audit: ${message}`)
}

function parseRecord(line) {
  const [blobSha, path, upstreamPath, ...extra] = line.split("\t")
  if (
    extra.length > 0 ||
    !/^[0-9a-f]{40}$/u.test(blobSha ?? "") ||
    path === undefined ||
    path.length === 0 ||
    upstreamPath !== path
  ) {
    fail("input-record-invalid")
  }

  const disposition = path.startsWith("packages/shared-skills/skills/ast-grep/")
    ? "retained-under-mit"
    : "removed-before-candidate"
  return { blobSha, disposition, path, upstreamPath }
}

const records = readFileSync(inputPath, "utf8")
  .split("\n")
  .filter((line) => line.length > 0)
  .map(parseRecord)
  .sort((left, right) => left.path.localeCompare(right.path))

if (records.length !== 143 || new Set(records.map((record) => record.path)).size !== records.length) {
  fail("input-record-set-invalid")
}
if (records.filter((record) => record.disposition === "retained-under-mit").length !== 11) {
  fail("input-retained-set-invalid")
}

const audit = {
  schemaVersion: "source-provenance-audit.1",
  auditDate: "2026-08-22",
  comparison: {
    candidateBase: "699eac5fdeda5dd17393bdd5493118b9fb8543c5",
    method: "exact-git-blob-same-path",
    candidatePathCount: 143,
    rawMatchPairCount: 154,
    crossPathLicenseOnlyPairCount: 11,
  },
  upstream: {
    repository: "https://github.com/code-yeongyu/oh-my-openagent",
    commit: "bddfeb521545489860030acf19e82ac47f6db15d",
    tree: "c63f034fd3734858118c96f0e485e8db1502dcf7",
    license: "Sustainable Use License 1.0",
  },
  exactSamePathMatches: records,
  removedSubtrees,
}

writeFileSync(outputPath, `${JSON.stringify(audit, null, 2)}\n`)
