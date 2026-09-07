import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { readFileSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import process from "node:process"

const [cliPath, projectDir] = process.argv.slice(2)
assert.ok(cliPath && projectDir, "installed-scope-arguments")
const profileRoot = join(dirname(projectDir), "scope-state")
const env = { ...process.env, PH_HOME: profileRoot }

function invoke(args, input) {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd: projectDir, env, encoding: "utf8", input,
    timeout: 10_000, maxBuffer: 512 * 1024,
  })
  assert.equal(result.error, undefined, "installed-scope-process")
  assert.equal(result.status, 0, `installed-scope-command: ${result.stderr}`)
  return JSON.parse(result.stdout)
}

assert.deepEqual(invoke(["context", "scope"]), { status: "unbound" })
assert.deepEqual(invoke(["philosophy", "propose", "--stdin"], JSON.stringify({
  schemaVersion: "personalization-candidate.v1", candidateId: "installed-scope", topic: "query-style",
  rule: "Use explicit project queries.", scope: { kind: "project", key: "installed-checkout" },
  provenance: { kind: "user", reference: "synthetic-installed-fixture" },
  rationale: "Keep query intent reviewable.", outcome: "Tests exercise declared queries.",
  tradeoffs: "More explicit query definitions.", counterexample: "Reconsider for trivial lookups.",
})), { status: "activated" })
const profile = readFileSync(join(profileRoot, "profile.json"))
const config = readFileSync(join(projectDir, ".persona", "harness.jsonc"))
assert.deepEqual(invoke(["context", "scope", "bind", "--project", "installed-checkout"]), {
  status: "bound", projectKey: "installed-checkout",
})
const preview = invoke(["context", "preview", "src/main/java/example/CustomerService.java", "--json", "--topic", "query-style"])
assert.equal(preview.envelope.status, "resolved")
assert.deepEqual(preview.envelope.selected.map((rule) => rule.id), ["rule-installed-scope"])
assert.deepEqual(invoke(["context", "scope", "unbind", "--project", "installed-checkout"]), { status: "unbound" })
assert.deepEqual(invoke(["context", "scope"]), { status: "unbound" })
assert.deepEqual(readFileSync(join(profileRoot, "profile.json")), profile)
assert.deepEqual(readFileSync(join(projectDir, ".persona", "harness.jsonc")), config)
const taskSession = "a".repeat(64)
const task = ["context", "task", "--session", taskSession]
assert.deepEqual(invoke(task), { status: "unbound" })
assert.deepEqual(invoke(["philosophy", "propose", "--stdin"], JSON.stringify({
  schemaVersion: "personalization-candidate.v1", candidateId: "installed-task", topic: "query-style",
  rule: "Use explicit task queries.", scope: { kind: "task", key: "installed-task" },
  provenance: { kind: "user", reference: "synthetic-task-resume" },
  rationale: "Keep query intent reviewable.", outcome: "Tests exercise task queries.",
  tradeoffs: "More explicit query definitions.", counterexample: "Reconsider for a new task.",
})), { status: "activated" })
const taskProfile = readFileSync(join(profileRoot, "profile.json"))
assert.deepEqual(invoke([...task, "resume", "--task", "installed-task"]), { status: "bound", taskKey: "installed-task" })
const taskPreview = invoke([...task, "preview", "src/main/java/example/CustomerService.java", "--json", "--topic", "query-style"])
assert.deepEqual(taskPreview.envelope.selected.map((rule) => rule.id), ["rule-installed-task"])
assert.deepEqual(invoke(["context", "task", "--session", "b".repeat(64)]), { status: "unbound" })
assert.deepEqual(invoke([...task, "end", "--task", "installed-task"]), { status: "unbound" })
assert.deepEqual(readFileSync(join(profileRoot, "profile.json")), taskProfile)
assert.deepEqual(readFileSync(join(projectDir, ".persona", "harness.jsonc")), config)
const profileLock = join(profileRoot, "profile.json.lock")
writeFileSync(profileLock, "", { flag: "wx", mode: 0o600 })
try {
  const locked = spawnSync(process.execPath, [cliPath, "philosophy", "rollback", "rule-installed-task"], {
    cwd: projectDir, env, encoding: "utf8", timeout: 10_000,
  })
  assert.equal(locked.status, 1, "installed-profile-lock-rejected")
  assert.equal(locked.stdout, "", "installed-profile-lock-no-success")
  assert.equal(locked.stderr, "personalization-store-busy\n")
  assert.deepEqual(readFileSync(join(profileRoot, "profile.json")), taskProfile)
} finally {
  unlinkSync(profileLock)
}
const configPath = join(projectDir, ".persona", "harness.jsonc")
const externalConfig = join(dirname(projectDir), "external-harness.jsonc")
writeFileSync(externalConfig, config)
unlinkSync(configPath)
symlinkSync(externalConfig, configPath, "file")
try {
  const linkedPreview = spawnSync(process.execPath, [cliPath, "context", "preview", "src/main/java/example/CustomerService.java", "--json"], {
    cwd: projectDir, env, encoding: "utf8", timeout: 10_000,
  })
  assert.equal(linkedPreview.status, 1, "installed-config-symlink-rejected")
  assert.equal(linkedPreview.stdout, "", "installed-config-symlink-no-context")
  assert.equal(linkedPreview.stderr, "context-config-unavailable\n")
  assert.deepEqual(readFileSync(externalConfig), config)
} finally {
  unlinkSync(configPath)
  writeFileSync(configPath, config)
}
process.stdout.write("installed-context-scope: PASS\n")
