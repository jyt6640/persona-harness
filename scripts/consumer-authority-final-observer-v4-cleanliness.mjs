import { lstatSync, realpathSync } from "node:fs"
import { relative, resolve, sep } from "node:path"

export const FINAL_OBSERVER_V4_CLEANLINESS_SCHEMA_VERSION = "consumer-authority-final-observer-cleanliness.1"

export const FINAL_OBSERVER_V4_STAGES = [
  "baseline",
  "source-bound-preparation",
  "credential-handoff",
  "observer-child",
  "immediately-pre-push",
]

export const FINAL_OBSERVER_V4_STAGE_RESIDUE_PROJECTION = {
  baseline: [],
  "source-bound-preparation": [
    ".persona/.ph-init-manifest.json",
    ".persona/workflow",
  ],
  "credential-handoff": [
    ".gradle",
    ".persona/.ph-init-manifest.json",
    ".persona/evidence",
    ".persona/workflow",
    "build",
    "node_modules",
  ],
  "observer-child": [
    ".gradle",
    ".persona/.ph-init-manifest.json",
    ".persona/evidence",
    ".persona/workflow",
    "build",
    "node_modules",
  ],
  "immediately-pre-push": [
    ".gradle",
    ".persona/.ph-init-manifest.json",
    ".persona/evidence",
    ".persona/workflow",
    "build",
    "node_modules",
  ],
}

const ALLOWED_RESIDUES = [
  { kind: "directory", path: ".gradle" },
  { kind: "file", path: ".persona/.ph-init-manifest.json" },
  { kind: "directory", path: ".persona/evidence" },
  { kind: "directory", path: ".persona/workflow" },
  { kind: "directory", path: "build" },
  { kind: "directory", path: "node_modules" },
]
const FORBIDDEN_PREFIXES = [".cache", ".config", ".local"]
const ALLOWED_SOURCE_BOUND_FINAL_DIFF_PATHS = [
  ".gitignore",
  ".opencode/opencode.json",
  ".persona/conventions/**",
  ".persona/harness.jsonc",
  ".persona/policies/**",
  ".persona/project-profile.jsonc",
  ".persona/rules/**",
  "AGENTS.md",
  "build.gradle",
  "build.gradle.kts",
  "gradle.properties",
  "settings.gradle",
  "settings.gradle.kts",
]
const REUSABLE_PIN_PATH = ".github/workflows/research-attestation.yml"
const SHA256 = /^sha256:[a-f0-9]{64}$/u
const SHA = /^[a-f0-9]{40,64}$/u

export class FinalObserverV4CleanlinessError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function canonicalFinalObserverV4CleanlinessPolicy() {
  return {
    allowedSourceBoundFinalDiffPaths: [...ALLOWED_SOURCE_BOUND_FINAL_DIFF_PATHS],
    allowedResidues: ALLOWED_RESIDUES.map((entry) => ({ ...entry })),
    cleanDiagnostic: "git-clean-ndx-normalized-against-the-nul-safe-status-projection",
    forbiddenConsumerPaths: [".local/**", ".config/**", ".cache/**"],
    requiredReusablePinPath: REUSABLE_PIN_PATH,
    schemaVersion: FINAL_OBSERVER_V4_CLEANLINESS_SCHEMA_VERSION,
    stageResidueProjection: cloneStageResidueProjection(),
    stages: [...FINAL_OBSERVER_V4_STAGES],
    statusEnumeration: "git-status-porcelain-v1-z-untracked-all-ignored-matching",
  }
}

export function evaluateFinalObserverV4Cleanliness(input) {
  if (
    !isRecord(input)
    || !hasExactKeys(input, ["cleanOutput", "expected", "observed", "projectRoot", "stage", "statusNul"])
    || typeof input.projectRoot !== "string"
    || typeof input.stage !== "string"
  ) {
    fail("v4-cleanliness-input")
  }
  if (!FINAL_OBSERVER_V4_STAGES.includes(input.stage)) fail("v4-cleanliness-stage")
  const root = readRoot(input.projectRoot)
  assertBinding(input.expected, input.observed, root)
  const expected = FINAL_OBSERVER_V4_STAGE_RESIDUE_PROJECTION[input.stage]
  const status = readStatus(input.statusNul)
  if (status.tracked) fail("v4-cleanliness-tracked")
  assertSameSet(expected, status.paths, "v4-cleanliness-status")
  assertSameSet(expected, readCleanDiagnostic(input.cleanOutput), "v4-cleanliness-clean")
  for (const path of expected) inspectResidue(root, path)
  return { residues: expected, stage: input.stage }
}

function assertBinding(expected, observed, root) {
  const left = readBinding(expected, root)
  const right = readBinding(observed, root)
  if (JSON.stringify(left) !== JSON.stringify(right)) fail("v4-cleanliness-source-binding")
}

function readBinding(value, root) {
  if (!isRecord(value)) fail("v4-cleanliness-source-binding")
  const keys = ["cwd", "finalDiff", "head", "parent", "remoteParent", "reusablePinDigest", "reusablePinPath", "sourceDigest", "topLevel"]
  if (!hasExactKeys(value, keys)) fail("v4-cleanliness-source-binding")
  if (
    value.cwd !== root
    || value.topLevel !== root
    || !SHA.test(value.head)
    || !SHA.test(value.parent)
    || !SHA.test(value.remoteParent)
  ) {
    fail("v4-cleanliness-source-binding")
  }
  if (!SHA256.test(value.reusablePinDigest) || !SHA256.test(value.sourceDigest)) fail("v4-cleanliness-source-binding")
  const reusablePinPath = normalizePath(value.reusablePinPath)
  if (reusablePinPath !== REUSABLE_PIN_PATH) fail("v4-cleanliness-source-binding")
  const finalDiff = readFinalDiff(value.finalDiff)
  if (
    !finalDiff.includes(reusablePinPath)
    || finalDiff.some((path) => !isAllowedFinalDiffPath(path, reusablePinPath))
  ) {
    fail("v4-cleanliness-final-diff")
  }
  return {
    cwd: value.cwd,
    finalDiff,
    head: value.head,
    parent: value.parent,
    remoteParent: value.remoteParent,
    reusablePinDigest: value.reusablePinDigest,
    reusablePinPath,
    sourceDigest: value.sourceDigest,
    topLevel: value.topLevel,
  }
}

function readStatus(value) {
  const records = readNulRecords(value, "v4-cleanliness-status")
  const paths = []
  for (const record of records) {
    if (record.startsWith("?? ") || record.startsWith("!! ")) {
      paths.push(normalizeResiduePath(record.slice(3)))
      continue
    }
    fail("v4-cleanliness-tracked")
  }
  return { paths: sortedUnique(paths, "v4-cleanliness-status"), tracked: false }
}

function readCleanDiagnostic(value) {
  if (typeof value !== "string") fail("v4-cleanliness-clean")
  if (value === "") return []
  const records = value.endsWith("\n") ? value.slice(0, -1).split("\n") : value.split("\n")
  if (records.some((record) => !record.startsWith("Would remove ") || record.length === 13)) fail("v4-cleanliness-clean")
  return sortedUnique(records.map((record) => normalizeResiduePath(record.slice(13))), "v4-cleanliness-clean")
}

function inspectResidue(root, path) {
  const allowed = ALLOWED_RESIDUES.find((entry) => path === entry.path)
  if (allowed === undefined || isForbidden(path)) fail("v4-cleanliness-residue")
  const segments = path.split("/")
  for (let index = 0; index < segments.length; index += 1) {
    const relativePath = segments.slice(0, index + 1).join("/")
    const absolutePath = resolve(root, relativePath)
    let stat
    let actual
    try {
      stat = lstatSync(absolutePath)
      actual = realpathSync(absolutePath)
    } catch {
      fail("v4-cleanliness-residue")
    }
    if (stat.isSymbolicLink() || !isContained(root, actual)) fail("v4-cleanliness-alias")
    if (index < segments.length - 1 && !stat.isDirectory()) fail("v4-cleanliness-residue")
    if (index === segments.length - 1 && ((allowed.kind === "file" && !stat.isFile()) || (allowed.kind === "directory" && !stat.isDirectory()))) {
      fail("v4-cleanliness-residue")
    }
  }
}

function readRoot(value) {
  try {
    return realpathSync(value)
  } catch {
    fail("v4-cleanliness-root")
  }
}

function readFinalDiff(value) {
  if (!Array.isArray(value)) fail("v4-cleanliness-final-diff")
  return sortedUnique(value.map(normalizePath), "v4-cleanliness-final-diff")
}

function readNulRecords(value, code) {
  if (value === "") return []
  if (typeof value !== "string" || !value.endsWith("\0")) fail(code)
  const records = value.slice(0, -1).split("\0")
  if (records.some((entry) => entry.length === 0)) fail(code)
  return records
}

function normalizePath(value) {
  if (typeof value !== "string" || value.includes("\0") || value.includes("\\") || value === "" || value.startsWith("/")) fail("v4-cleanliness-path")
  const parts = value.split("/")
  if (parts.some((part) => part === "" || part === "." || part === "..")) fail("v4-cleanliness-path")
  return parts.join("/")
}

function normalizeResiduePath(value) {
  if (typeof value !== "string") fail("v4-cleanliness-path")
  return normalizePath(value.endsWith("/") ? value.slice(0, -1) : value)
}

function sortedUnique(values, code) {
  const sorted = [...values].sort()
  if (sorted.some((value, index) => index > 0 && value === sorted[index - 1])) fail(code)
  return sorted
}

function assertSameSet(expected, actual, code) {
  if (expected.length !== actual.length || expected.some((value, index) => value !== actual[index])) fail(code)
}

function isForbidden(path) {
  return FORBIDDEN_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

function cloneStageResidueProjection() {
  return Object.fromEntries(FINAL_OBSERVER_V4_STAGES.map((stage) => [
    stage,
    [...FINAL_OBSERVER_V4_STAGE_RESIDUE_PROJECTION[stage]],
  ]))
}

function isAllowedFinalDiffPath(path, reusablePinPath) {
  if (path === reusablePinPath) return true
  return ALLOWED_SOURCE_BOUND_FINAL_DIFF_PATHS.some((allowed) => (
    allowed.endsWith("/**")
      ? path.startsWith(`${allowed.slice(0, -3)}/`)
      : path === allowed
  ))
}

function isContained(root, value) {
  const relation = relative(root, value)
  return relation === "" || (!relation.startsWith(`..${sep}`) && relation !== ".." && !relation.startsWith("/"))
}

function hasExactKeys(value, keys) {
  return Object.keys(value).length === keys.length && keys.every((key) => key in value)
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function fail(code) {
  throw new FinalObserverV4CleanlinessError(code)
}
