import {
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { execFileSync } from "node:child_process"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"

import {
  projectFinishAttestationBuilderRoots,
  runProjectFinishAttestationBuilder,
  readProjectFinishAttestationProducerContextFromToken,
} from "../scripts/build-project-finish-attestation.mjs"
import {
  runProjectFinishAttestationProducerWithCore,
} from "../scripts/project-finish-attestation-producer-oidc-capability-bridge.cjs"
import {
  stageProjectFinishProducerRuntime,
  type ProjectFinishProducerRuntimeStaging,
} from "./helpers/project-finish-producer-runtime-staging.js"

const temporaryDirectories: string[] = []
const AUDIENCE = "persona-harness-project-finish-attestation"
const CALLER_SHA = "a".repeat(40)
const PRODUCER_SHA = "b".repeat(40)
const AUTHENTIC_CALLER_SHA = "7a4b8ab207711b48a3fbf166157bb15b5f9260d0"
const AUTHENTIC_PRODUCER_SHA = "a41e8977325895279ad2d379f94954451281c231"
const AUTHENTIC_REPOSITORY = "jyt6640/persona-harness-attestation-claim-fixture"
const AUTHENTIC_REPOSITORY_ID = "1304576182"
let stagedProducerRuntime: ProjectFinishProducerRuntimeStaging | undefined

beforeAll(() => {
  stagedProducerRuntime = stageProjectFinishProducerRuntime()
})

afterAll(() => {
  stagedProducerRuntime?.cleanup()
  stagedProducerRuntime = undefined
})

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true })
  }
})

describe.sequential("project finish producer OIDC capability bridge", () => {
  it("blocks a raw-env-free builder before it can create receipt or predicate bytes", async () => {
    const workspace = createWorkspace()
    const roots = projectFinishAttestationBuilderRoots(producerEnvironment(workspace))
    const result = await runProjectFinishAttestationBuilder({
      callerRoot: roots.callerRoot,
      environment: producerEnvironment(workspace),
      oidcToken: undefined,
      runnerRoot: roots.runnerRoot,
    })

    expect(result).toEqual({ code: "project-finish-producer-oidc", kind: "blocked" })
    expect(existsSync(join(workspace, ".project-finish-attestation-artifacts", "receipt.json"))).toBe(false)
    expect(existsSync(join(workspace, ".project-finish-attestation-artifacts", "predicate.json"))).toBe(false)
    expect(readDiagnostic(workspace)).toEqual({
      code: "project-finish-producer-oidc",
      schemaVersion: "project-finish-attestation-producer-diagnostic.1",
    })
  })

  it("does not write a failure diagnostic or authority artifact through a runner output alias", async () => {
    const workspace = createWorkspace()
    const outside = join(workspace, "outside")
    mkdirSync(outside)
    symlinkSync("outside", join(workspace, ".project-finish-attestation-failure"))
    const roots = projectFinishAttestationBuilderRoots(producerEnvironment(workspace))

    const result = await runProjectFinishAttestationBuilder({
      callerRoot: roots.callerRoot,
      environment: producerEnvironment(workspace),
      oidcToken: undefined,
      runnerRoot: roots.runnerRoot,
    })

    expect(result).toEqual({ code: "project-finish-producer-oidc", kind: "blocked" })
    expect(existsSync(join(outside, "failure-diagnostic.json"))).toBe(false)
    expect(existsSync(join(workspace, ".project-finish-attestation-artifacts", "receipt.json"))).toBe(false)
    expect(existsSync(join(workspace, ".project-finish-attestation-artifacts", "predicate.json"))).toBe(false)
  })

  it("uses only the fixed audience and keeps an unavailable core token bounded", async () => {
    const workspace = createWorkspace()
    const marker = "PH_SECRET_TOKEN=producer-oidc-bridge"
    const calls: string[] = []
    const result = await runProjectFinishAttestationProducerWithCore({
      core: {
        getIDToken: async (audience: string) => {
          calls.push(audience)
          throw new Error(marker)
        },
      },
      environment: producerEnvironment(workspace),
    })

    expect(calls).toEqual([AUDIENCE])
    expect(result).toEqual({ code: "project-finish-producer-oidc", kind: "blocked" })
    expect(JSON.stringify(result)).not.toContain(marker)
    expect(existsSync(join(workspace, ".project-finish-attestation-artifacts", "receipt.json"))).toBe(false)
    expect(existsSync(join(workspace, ".project-finish-attestation-artifacts", "predicate.json"))).toBe(false)
  })

  it("does not acquire a token when the fixed producer module cannot load", async () => {
    const fixture = createWorkspace()
    const bridgePath = join(fixture, "project-finish-attestation-producer-oidc-capability-bridge.cjs")
    copyFileSync(
      join(process.cwd(), "scripts", "project-finish-attestation-producer-oidc-capability-bridge.cjs"),
      bridgePath,
    )
    const bridge = await import(pathToFileURL(bridgePath).href)
    let calls = 0
    const result = await bridge.runProjectFinishAttestationProducerWithCore({
      core: {
        getIDToken: async () => {
          calls += 1
          return oidcToken(claims())
        },
      },
    })

    expect(calls).toBe(0)
    expect(result).toEqual({ code: "project-finish-producer-oidc", kind: "blocked" })
  })

  it("advances a canonical token past the former OIDC boundary without writing receipt artifacts", async () => {
    const workspace = createWorkspace()
    const result = await runProjectFinishAttestationProducerWithCore({
      core: {
        getIDToken: async () => oidcToken(claims()),
      },
      environment: producerEnvironment(workspace),
    })

    expect(result).toEqual({ code: "project-finish-producer-checkout", kind: "blocked" })
    expect(readDiagnostic(workspace)).toEqual({
      code: "project-finish-producer-checkout",
      schemaVersion: "project-finish-attestation-producer-diagnostic.1",
    })
    expect(existsSync(join(workspace, ".project-finish-attestation-artifacts", "receipt.json"))).toBe(false)
    expect(existsSync(join(workspace, ".project-finish-attestation-artifacts", "predicate.json"))).toBe(false)
  })

  it("runs the real github-script outer workspace against its nested caller checkout", async () => {
    const fixture = createReusableActionTopology()
    const result = await withRunnerCwd(fixture, async () => {
      const runner = await import(pathToFileURL(
        join(fixture.producerRoot, "dist", "cli", "project-finish-attestation-producer-runner.js"),
      ).href)
      const identity = (path: string) => {
        const stat = lstatSync(path, { bigint: true })
        return { dev: stat.dev.toString(), ino: stat.ino.toString() }
      }
      expect(runner.captureProjectFinishAttestationCallerRootCapability(
        fixture.caller,
        identity(fixture.caller),
        identity(fixture.runner),
      ).rootContext.anchor).toBe("direct-child")
      return runActionTopology(fixture)
    })

    expect(result).toEqual({ kind: "passed" })
    expect(runtime().startedWithoutDist).toBe(true)
    expect(existsSync(join(fixture.producerRoot, "src"))).toBe(false)
    expect(existsSync(join(fixture.runner, ".project-finish-attestation-artifacts", "receipt.json"))).toBe(true)
    expect(existsSync(join(fixture.runner, ".project-finish-attestation-artifacts", "predicate.json"))).toBe(true)
    expect(existsSync(join(fixture.caller, ".project-finish-attestation-artifacts"))).toBe(false)
  })

  it("disables detached maintenance in nested topology Git fixtures", () => {
    const fixture = createReusableActionTopology()

    expect(readGitConfig(fixture.caller, "gc.auto")).toBe("0")
    expect(readGitConfig(fixture.caller, "maintenance.auto")).toBe("false")
    expect(readGitConfig(fixture.producerRoot, "gc.auto")).toBe("0")
    expect(readGitConfig(fixture.producerRoot, "maintenance.auto")).toBe("false")
  })

  it("does not infer the nested caller root from the github-script current directory", async () => {
    const fixture = createReusableActionTopology()
    const result = await withRunnerCwd(fixture, () => runProjectFinishAttestationBuilder({
      environment: actionEnvironment(fixture),
      oidcToken: oidcToken(actionClaims(fixture)),
      producerRoot: fixture.producerRoot,
    }))

    expect(result).toEqual({ code: "project-finish-producer-workspace", kind: "blocked" })
    expect(existsSync(join(fixture.runner, ".project-finish-attestation-artifacts"))).toBe(false)
  })

  it.each([
    ["caller root alias", "caller" as const],
    ["runner root alias", "runner" as const],
  ])("blocks a nested %s before receipt or predicate output", async (_label, target) => {
    const fixture = createReusableActionTopology()
    const bridge = target === "runner" ? actionBridge(fixture) : undefined

    const result = await withRunnerCwd(fixture, async () => {
      const path = target === "caller" ? fixture.caller : fixture.runner
      const draft = `${path}.draft`
      renameSync(path, draft)
      symlinkSync(fixture.outside, path)
      try {
        return await (bridge === undefined
          ? runActionTopology(fixture)
          : runActionBridge(fixture, bridge))
      } finally {
        unlinkSync(path)
        renameSync(draft, path)
      }
    })

    expect(result).toEqual(expect.objectContaining({ kind: "blocked" }))
    expect(existsSync(join(fixture.outside, "receipt.json"))).toBe(false)
    expect(existsSync(join(fixture.outside, "predicate.json"))).toBe(false)
  })

  it("keeps invalid audience or issuer tokens blocked and accepts the authentic distinct caller and producer shape", () => {
    const workspace = createWorkspace()
    const invalid = readProjectFinishAttestationProducerContextFromToken(
      oidcToken({ ...claims(), aud: "caller-controlled" }),
      producerEnvironment(workspace),
    )
    const wrongIssuer = readProjectFinishAttestationProducerContextFromToken(
      oidcToken({ ...claims(), iss: "https://untrusted.example" }),
      producerEnvironment(workspace),
    )
    const valid = readProjectFinishAttestationProducerContextFromToken(
      oidcToken(claims()),
      producerEnvironment(workspace),
    )

    expect(invalid).toEqual({ code: "project-finish-producer-oidc", kind: "blocked" })
    expect(wrongIssuer).toEqual({ code: "project-finish-producer-oidc", kind: "blocked" })
    expect(valid).toMatchObject({
      kind: "ready",
      value: {
        callerWorkflowSha: CALLER_SHA,
        reusableWorkflowSha: PRODUCER_SHA,
        sourceHead: CALLER_SHA,
      },
    })
  })

  it("accepts the authentic pinned caller shape only with explicitly forwarded public visibility", () => {
    const workspace = createWorkspace()
    const result = readProjectFinishAttestationProducerContextFromToken(
      oidcToken(authenticClaims()),
      authenticProducerEnvironment(workspace),
    )

    expect(result).toMatchObject({
      kind: "ready",
      value: {
        callerWorkflowSha: AUTHENTIC_CALLER_SHA,
        reusableWorkflowSha: AUTHENTIC_PRODUCER_SHA,
        sourceHead: AUTHENTIC_CALLER_SHA,
      },
    })
  })

  it("blocks hostile caller visibility before it can create a receipt or predicate", async () => {
    const workspace = createWorkspace()
    const marker = "PH_CONTEXT_SECRET=sk-live-aaaaaaaaaaaaaaaaaaaaaaaa"
    const result = await runProjectFinishAttestationProducerWithCore({
      core: {
        getIDToken: async () => oidcToken(authenticClaims()),
      },
      environment: {
        ...authenticProducerEnvironment(workspace),
        GITHUB_REPOSITORY_VISIBILITY: "public",
        PERSONA_HARNESS_CALLER_VISIBILITY: marker,
      },
    })

    expect(result).toEqual({ code: "project-finish-producer-context", kind: "blocked" })
    expect(JSON.stringify(result)).not.toContain(marker)
    expect(existsSync(join(workspace, ".project-finish-attestation-artifacts", "receipt.json"))).toBe(false)
    expect(existsSync(join(workspace, ".project-finish-attestation-artifacts", "predicate.json"))).toBe(false)
  })

  it("does not route hostile aliases or raw OIDC request fields into the bridge", () => {
    const bridge = readFileSync(
      join(process.cwd(), "scripts", "project-finish-attestation-producer-oidc-capability-bridge.cjs"),
      "utf8",
    )

    expect(bridge).toContain("PRODUCER_ENVIRONMENT_KEYS")
    expect(bridge).not.toContain("ACTIONS_ID_TOKEN_REQUEST_")
    expect(bridge).not.toContain('"GITHUB_REPOSITORY_VISIBILITY"')
    expect(bridge).toContain('"PERSONA_HARNESS_CALLER_VISIBILITY"')
    expect(bridge).not.toContain("process.env.PATH")
    expect(bridge).not.toContain("core.setOutput")
  })
})

function producerEnvironment(workspace: string): NodeJS.ProcessEnv {
  return {
    GITHUB_ACTIONS: "true",
    GITHUB_EVENT_NAME: "push",
    GITHUB_REF: "refs/heads/main",
    GITHUB_REPOSITORY: "example/public-gradle-app",
    GITHUB_REPOSITORY_ID: "123",
    GITHUB_RUN_ATTEMPT: "1",
    GITHUB_RUN_ID: "42",
    GITHUB_SHA: CALLER_SHA,
    GITHUB_WORKFLOW_REF: "example/public-gradle-app/.github/workflows/project-finish.yml@refs/heads/main",
    GITHUB_WORKFLOW_SHA: CALLER_SHA,
    GITHUB_WORKSPACE: workspace,
    PERSONA_HARNESS_CALLER_VISIBILITY: "public",
    PERSONA_HARNESS_PRODUCER_SHA: PRODUCER_SHA,
    RUNNER_ENVIRONMENT: "github-hosted",
    RUNNER_OS: "Linux",
  }
}

function claims(): Record<string, string> {
  return {
    aud: AUDIENCE,
    event_name: "push",
    iss: "https://token.actions.githubusercontent.com",
    job_workflow_ref: `jyt6640/persona-harness/.github/workflows/persona-harness-project-finish.yml@${PRODUCER_SHA}`,
    job_workflow_sha: PRODUCER_SHA,
    ref: "refs/heads/main",
    repository: "example/public-gradle-app",
    repository_id: "123",
    repository_visibility: "public",
    run_attempt: "1",
    run_id: "42",
    runner_environment: "github-hosted",
    workflow_ref: "example/public-gradle-app/.github/workflows/project-finish.yml@refs/heads/main",
    workflow_sha: CALLER_SHA,
  }
}

function authenticClaims(): Record<string, string> {
  return {
    aud: AUDIENCE,
    event_name: "push",
    iss: "https://token.actions.githubusercontent.com",
    job_workflow_ref:
      `jyt6640/persona-harness/.github/workflows/persona-harness-project-finish.yml@${AUTHENTIC_PRODUCER_SHA}`,
    job_workflow_sha: AUTHENTIC_PRODUCER_SHA,
    ref: "refs/heads/main",
    repository: AUTHENTIC_REPOSITORY,
    repository_id: AUTHENTIC_REPOSITORY_ID,
    repository_visibility: "public",
    run_attempt: "1",
    run_id: "29884375298",
    runner_environment: "github-hosted",
    workflow_ref: `${AUTHENTIC_REPOSITORY}/.github/workflows/research-attestation.yml@refs/heads/main`,
    workflow_sha: AUTHENTIC_CALLER_SHA,
  }
}

function authenticProducerEnvironment(workspace: string): NodeJS.ProcessEnv {
  return {
    GITHUB_ACTIONS: "true",
    GITHUB_EVENT_NAME: "push",
    GITHUB_REF: "refs/heads/main",
    GITHUB_REPOSITORY: AUTHENTIC_REPOSITORY,
    GITHUB_REPOSITORY_ID: AUTHENTIC_REPOSITORY_ID,
    GITHUB_RUN_ATTEMPT: "1",
    GITHUB_RUN_ID: "29884375298",
    GITHUB_SHA: AUTHENTIC_CALLER_SHA,
    GITHUB_WORKFLOW_REF: `${AUTHENTIC_REPOSITORY}/.github/workflows/research-attestation.yml@refs/heads/main`,
    GITHUB_WORKFLOW_SHA: AUTHENTIC_CALLER_SHA,
    GITHUB_WORKSPACE: workspace,
    PERSONA_HARNESS_CALLER_VISIBILITY: "public",
    PERSONA_HARNESS_PRODUCER_SHA: AUTHENTIC_PRODUCER_SHA,
    RUNNER_ENVIRONMENT: "github-hosted",
    RUNNER_OS: "Linux",
  }
}

function oidcToken(payload: Record<string, string>): string {
  return `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`
}

function readDiagnostic(workspace: string): unknown {
  return JSON.parse(readFileSync(
    join(workspace, ".project-finish-attestation-failure", "failure-diagnostic.json"),
    "utf8",
  ))
}

function createWorkspace(): string {
  const directory = mkdtempSync(join(tmpdir(), "project-finish-producer-oidc-bridge-"))
  temporaryDirectories.push(directory)
  const workspace = realpathSync(directory)
  mkdirSync(join(workspace, ".project-finish-caller"))
  return workspace
}

function createReusableActionTopology() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-producer-action-topology-")))
  const runner = join(root, "runner")
  const caller = join(runner, ".project-finish-caller")
  const producerRoot = join(runner, ".persona-harness-producer")
  const outside = join(root, "outside")
  temporaryDirectories.push(root)
  mkdirSync(runner)
  mkdirSync(outside)
  createNestedCaller(caller)
  copyProducerRuntime(producerRoot)
  const producerSha = initializeProducerCheckout(producerRoot)
  const callerSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: caller, encoding: "utf8" }).trim()
  return { caller, callerSha, outside, producerRoot, producerSha, runner }
}

async function withRunnerCwd<T>(
  fixture: ReturnType<typeof createReusableActionTopology>,
  action: () => Promise<T>,
): Promise<T> {
  const original = process.cwd()
  process.chdir(fixture.runner)
  try {
    return await action()
  } finally {
    process.chdir(original)
  }
}

async function runActionTopology(fixture: ReturnType<typeof createReusableActionTopology>) {
  const bridge = actionBridge(fixture)
  return runActionBridge(fixture, bridge)
}

async function runActionBridge(
  fixture: ReturnType<typeof createReusableActionTopology>,
  bridge: typeof import("../scripts/project-finish-attestation-producer-oidc-capability-bridge.cjs"),
) {
  return bridge.runProjectFinishAttestationProducerWithCore({
    core: { getIDToken: async () => oidcToken(actionClaims(fixture)) },
    environment: actionEnvironment(fixture),
  })
}

function actionBridge(fixture: ReturnType<typeof createReusableActionTopology>) {
  return createRequire(join(fixture.runner, "github-script.cjs"))(
    "./.persona-harness-producer/scripts/project-finish-attestation-producer-oidc-capability-bridge.cjs",
  ) as typeof import("../scripts/project-finish-attestation-producer-oidc-capability-bridge.cjs")
}

function createNestedCaller(caller: string): void {
  mkdirSync(join(caller, "src", "main", "java"), { recursive: true })
  writeFileSync(join(caller, "build.gradle"), "plugins { id 'java' }\n")
  writeFileSync(join(caller, "settings.gradle"), "rootProject.name = 'nested-caller'\n")
  writeFileSync(join(caller, "src", "main", "java", "App.java"), "class App {}\n")
  writeFileSync(
    join(caller, "gradlew"),
    [
      "#!/bin/sh",
      "case \"$*\" in",
      "  *cleanTest*)",
      "    mkdir -p build/test-results/test",
      "    printf '%s\\n' '<testsuite tests=\"1\" failures=\"0\" errors=\"0\" skipped=\"0\"><testcase name=\"works\"/></testsuite>' > build/test-results/test/TEST-action.xml",
      "    printf '%s\\n' '> Task :cleanTest' '> Task :test' 'BUILD SUCCESSFUL'",
      "    ;;",
      "  *)",
      "    printf '%s\\n' '> Task :build' 'BUILD SUCCESSFUL'",
      "    ;;",
      "esac",
      "",
    ].join("\n"),
  )
  chmodSync(join(caller, "gradlew"), 0o755)
  initializeTopologyGitFixture(caller, "nested caller")
}

function copyProducerRuntime(producerRoot: string): void {
  for (const path of ["dist", "native", "scripts", "package.json"] as const) {
    cpSync(join(runtime().root, path), join(producerRoot, path), { recursive: true })
  }
}

function runtime(): ProjectFinishProducerRuntimeStaging {
  if (stagedProducerRuntime === undefined) {
    throw new Error("project-finish-producer-runtime-unavailable")
  }
  return stagedProducerRuntime
}

function initializeProducerCheckout(producerRoot: string): string {
  const sha = initializeTopologyGitFixture(producerRoot, "immutable producer")
  execFileSync("git", ["remote", "add", "origin", "https://github.com/jyt6640/persona-harness.git"], { cwd: producerRoot })
  return sha
}

function initializeTopologyGitFixture(directory: string, message: string): string {
  execFileSync("git", ["init", "-q"], { cwd: directory })
  execFileSync("git", ["config", "gc.auto", "0"], { cwd: directory })
  execFileSync("git", ["config", "maintenance.auto", "false"], { cwd: directory })
  execFileSync("git", ["config", "user.email", "ph@example.invalid"], { cwd: directory })
  execFileSync("git", ["config", "user.name", "PH Test"], { cwd: directory })
  execFileSync("git", ["add", "."], { cwd: directory })
  execFileSync("git", ["commit", "-qm", message], { cwd: directory })
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: directory, encoding: "utf8" }).trim()
}

function readGitConfig(directory: string, key: "gc.auto" | "maintenance.auto"): string {
  return execFileSync("git", ["config", "--get", key], { cwd: directory, encoding: "utf8" }).trim()
}

function actionEnvironment(fixture: ReturnType<typeof createReusableActionTopology>): NodeJS.ProcessEnv {
  return {
    GITHUB_ACTIONS: "true",
    GITHUB_EVENT_NAME: "push",
    GITHUB_REF: "refs/heads/main",
    GITHUB_REPOSITORY: "example/public-gradle-app",
    GITHUB_REPOSITORY_ID: "123",
    GITHUB_RUN_ATTEMPT: "1",
    GITHUB_RUN_ID: "42",
    GITHUB_SHA: fixture.callerSha,
    GITHUB_WORKFLOW_REF: "example/public-gradle-app/.github/workflows/project-finish.yml@refs/heads/main",
    GITHUB_WORKFLOW_SHA: fixture.callerSha,
    GITHUB_WORKSPACE: fixture.runner,
    PERSONA_HARNESS_CALLER_VISIBILITY: "public",
    PERSONA_HARNESS_PRODUCER_SHA: fixture.producerSha,
    RUNNER_ENVIRONMENT: "github-hosted",
    RUNNER_OS: "Linux",
  }
}

function actionClaims(fixture: ReturnType<typeof createReusableActionTopology>): Record<string, string> {
  return {
    aud: AUDIENCE,
    event_name: "push",
    iss: "https://token.actions.githubusercontent.com",
    job_workflow_ref: `jyt6640/persona-harness/.github/workflows/persona-harness-project-finish.yml@${fixture.producerSha}`,
    job_workflow_sha: fixture.producerSha,
    ref: "refs/heads/main",
    repository: "example/public-gradle-app",
    repository_id: "123",
    repository_visibility: "public",
    run_attempt: "1",
    run_id: "42",
    runner_environment: "github-hosted",
    workflow_ref: "example/public-gradle-app/.github/workflows/project-finish.yml@refs/heads/main",
    workflow_sha: fixture.callerSha,
  }
}
