const SHA256 = /^[0-9a-f]{64}$/u
const SHA = /^[0-9a-f]{40}$/u
const CANDIDATE_REF = /^refs\/heads\/(?:[A-Za-z0-9][A-Za-z0-9._-]*)(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/u
const STRICT_SEMVER = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u

const BUNDLE_REQUIRED_REFS = Object.freeze([
  "explicit-single-refs-heads-candidate-must-match-expected-head",
  "refs/remotes/origin/main",
])

export const BUNDLE_REFERENCE_POLICY = Object.freeze({
  candidateRef: "explicit-single-refs-heads-candidate-must-match-expected-head",
  headAlias: "optional-head-mapping-must-match-the-same-expected-head",
  mainRef: "refs/remotes/origin/main",
  requiredRefs: BUNDLE_REQUIRED_REFS,
})

export class CleanPackageBoundaryError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function assertSourcePackageIdentity(packageJson, packageLock) {
  if (!isRecord(packageJson) || typeof packageJson.name !== "string" || typeof packageJson.version !== "string") {
    fail("clean-package-package-json")
  }
  if (packageJson.name !== "persona-harness" || !STRICT_SEMVER.test(packageJson.version)) {
    fail("clean-package-package-version")
  }
  if (!isRecord(packageLock) || !isRecord(packageLock.packages) || !isRecord(packageLock.packages[""])) {
    fail("clean-package-lock-shape")
  }
  const root = packageLock.packages[""]
  if (root.name !== packageJson.name) fail("clean-package-lock-name")
  if (root.version !== packageJson.version) fail("clean-package-lock-version")
  return { name: packageJson.name, version: packageJson.version }
}

export function parseBundleHeads(output) {
  if (typeof output !== "string") fail("clean-package-bundle-output")
  const entries = []
  for (const line of output.split("\n")) {
    if (line.trim() === "") continue
    const match = /^([0-9a-f]{40})\s+(.+)$/u.exec(line)
    if (match === null || match[1] === undefined || match[2] === undefined) {
      fail("clean-package-bundle-output")
    }
    entries.push({ ref: match[2], sha: match[1] })
  }
  if (entries.length === 0) fail("clean-package-bundle-output")
  return entries
}

export function assertBundleHeadBinding(heads, expected) {
  if (
    !Array.isArray(heads)
    || !isRecord(expected)
    || typeof expected.base !== "string"
    || typeof expected.candidateRef !== "string"
    || typeof expected.head !== "string"
  ) {
    fail("clean-package-bundle-shape")
  }
  if (!SHA.test(expected.base) || !SHA.test(expected.head) || !CANDIDATE_REF.test(expected.candidateRef)) {
    fail("clean-package-bundle-shape")
  }
  const byRef = new Map()
  const branchRefs = []
  for (const entry of heads) {
    if (!isRecord(entry) || typeof entry.ref !== "string" || typeof entry.sha !== "string" || !SHA.test(entry.sha) || byRef.has(entry.ref)) {
      fail("clean-package-bundle-shape")
    }
    if (entry.ref.startsWith("refs/heads/")) branchRefs.push(entry.ref)
    else if (entry.ref !== "HEAD" && entry.ref !== BUNDLE_REFERENCE_POLICY.mainRef) fail("clean-package-bundle-ref")
    byRef.set(entry.ref, entry.sha)
  }
  const candidateSha = byRef.get(expected.candidateRef)
  if (candidateSha === undefined) fail("clean-package-bundle-candidate-ref")
  if (branchRefs.length !== 1 || branchRefs[0] !== expected.candidateRef) {
    fail("clean-package-bundle-candidate-ambiguity")
  }
  if (candidateSha !== expected.head) fail("clean-package-bundle-candidate-sha")
  const headAlias = byRef.get("HEAD")
  if (headAlias !== undefined && headAlias !== expected.head) fail("clean-package-bundle-head")
  if (byRef.get(BUNDLE_REFERENCE_POLICY.mainRef) !== expected.base) fail("clean-package-bundle-main")
  return { base: expected.base, candidateRef: expected.candidateRef, head: expected.head }
}

export function assertCheckoutPackageBinding(binding) {
  if (!isRecord(binding)) fail("clean-package-checkout-shape")
  const values = [
    binding.root,
    binding.gitRoot,
    binding.npmPrefix,
    binding.packageSha256,
    binding.headPackageSha256,
    binding.lockSha256,
    binding.headLockSha256,
  ]
  if (!values.every((value) => typeof value === "string")) fail("clean-package-checkout-shape")
  if (binding.root !== binding.gitRoot) fail("clean-package-root-git")
  if (binding.root !== binding.npmPrefix) fail("clean-package-root-npm")
  if (!SHA256.test(binding.packageSha256) || !SHA256.test(binding.headPackageSha256)) {
    fail("clean-package-package-sha")
  }
  if (!SHA256.test(binding.lockSha256) || !SHA256.test(binding.headLockSha256)) {
    fail("clean-package-lock-sha")
  }
  if (binding.packageSha256 !== binding.headPackageSha256) fail("clean-package-package-drift")
  if (binding.lockSha256 !== binding.headLockSha256) fail("clean-package-lock-drift")
  return { root: binding.root }
}

export function assertPackageExecutionBinding(binding) {
  if (!isRecord(binding)) fail("clean-package-execution-shape")
  const values = [
    binding.commandCwd,
    binding.expectedLockPath,
    binding.expectedPackagePath,
    binding.gitRoot,
    binding.lockPath,
    binding.npmPrefix,
    binding.packagePath,
    binding.root,
  ]
  if (!values.every((value) => typeof value === "string")) fail("clean-package-execution-shape")
  if (binding.commandCwd !== binding.root) fail("clean-package-command-cwd")
  if (binding.gitRoot !== binding.root) fail("clean-package-root-git")
  if (binding.npmPrefix !== binding.root) fail("clean-package-root-npm")
  if (binding.packagePath !== binding.expectedPackagePath) fail("clean-package-package-path")
  if (binding.lockPath !== binding.expectedLockPath) fail("clean-package-lock-path")
  return { root: binding.root }
}

export function assertNpmExecutionPolicy(policy) {
  if (!isRecord(policy) || typeof policy.global !== "string" || typeof policy.ignoreScripts !== "string" || typeof policy.workspaces !== "string") {
    fail("clean-package-npm-shape")
  }
  if (policy.global !== "false") fail("clean-package-npm-global")
  if (policy.ignoreScripts !== "false") fail("clean-package-npm-ignore-scripts")
  if (policy.workspaces !== "false") fail("clean-package-npm-workspaces")
  return {
    global: policy.global,
    ignoreScripts: policy.ignoreScripts,
    workspaces: policy.workspaces,
  }
}

export function assertPackRecordBinding(record, identity) {
  if (!isRecord(record) || !isRecord(identity) || typeof identity.name !== "string" || typeof identity.version !== "string") {
    fail("clean-package-pack-shape")
  }
  if (record.name !== identity.name) fail("clean-package-pack-name")
  if (record.version !== identity.version) fail("clean-package-pack-version")
  if (record.filename !== `${identity.name}-${identity.version}.tgz`) fail("clean-package-pack-filename")
  return { name: identity.name, version: identity.version }
}

function fail(code) {
  throw new CleanPackageBoundaryError(code)
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
