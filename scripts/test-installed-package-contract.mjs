import { spawn, spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import {
  closeSync,
  chmodSync,
  copyFileSync,
  constants,
  cpSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import {
  assertPackRecordBinding,
  assertSourcePackageIdentity,
} from "./clean-package-boundary-core.mjs"
import { readV083AcceptanceManifest } from "./consumer-authority-v083-acceptance-schema.mjs"
import {
  observerGhStageCodeForPreflight,
  observerGhStageCodeForPrivateCopy,
  isObserverGhStageCode,
} from "./consumer-authority-observer-gh-stage.mjs"
import { provisionPrivateObserverGhCopy } from "./consumer-authority-observer-gh-workflow-selector.mjs"
import { formatPackageExercisePhaseRecord } from "./clean-package-exercise-phase.mjs"
import { formatAuthorityDiscoveryExerciseResult } from "./consumer-authority-authority-discovery-exercise.mjs"
import { canonicalizePackageTarball, readPackageContentIdentity } from "./package-content-identity.mjs"

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const temporaryRoot = mkdtempSync(join(tmpdir(), "persona-installed-package-contract-"))
const consumerNpmCache = join(temporaryRoot, "npm-cache")
const contractGradleUserHome = join(temporaryRoot, "gradle-user-home")
const MODELED_CURRENT_ARTIFACT_ID = 710000001
const MODELED_CURRENT_RUN_ID = 30430000000
const MODELED_AUTHORITY_TOPOLOGY = {
  callerWorkflowPath: "research-attestation.yml",
  callerWorkflowSha: "d370eaffefb2fdb12388c4b14c0e52af0e4efb38",
  repositoryId: 1304576182,
  repositorySlug: "jyt6640/persona-harness-attestation-claim-fixture",
  reusableWorkflowSha: "73e8654ce3307a6be7fb511e0c1f67df93c7d1b3",
}
const BETA28_PRE_AUTHORITY_COMMANDS = new Map([
  ["ph bootstrap backend --strict --no-developer-mcp", { args: ["bootstrap", "backend", "--strict", "--no-developer-mcp"] }],
  ["ph plan --accept", { args: ["plan", "--accept"] }],
  ["ph bearshell ./gradlew test", { args: ["bearshell", "./gradlew", "test"] }],
  ["ph bearshell ./gradlew compileJava", { args: ["bearshell", "./gradlew", "compileJava"] }],
  ["ph bearshell ./gradlew clean", { args: ["bearshell", "./gradlew", "clean"] }],
  ["ph evidence read README.md", { args: ["evidence", "read", "README.md"] }],
  ["ph evidence read .persona/project-profile.jsonc", { args: ["evidence", "read", ".persona/project-profile.jsonc"] }],
  ["ph evidence read src/main/java/example/cooperative/GreetingService.java", {
    args: ["evidence", "read", "src/main/java/example/cooperative/GreetingService.java"],
  }],
  ["ph plan --report-filled implementation --stdin", {
    args: ["plan", "--report-filled", "implementation", "--stdin"],
    stdin: [
      "Status: filled",
      "- README ranges read: all",
      "- Project profile ranges read: all",
      "- `npx ph bearshell ./gradlew test`",
      "- `npx ph bearshell ./gradlew compileJava`",
    ].join("\n"),
  }],
  ["ph plan --report-filled review --stdin", {
    args: ["plan", "--report-filled", "review", "--stdin"],
    stdin: [
      "Status: filled",
      "- Manual QA reviewed the Java/Spring Gradle fixture.",
      "- `npx ph bearshell ./gradlew clean`",
    ].join("\n"),
  }],
])

class ObserverGhContractStageError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

class PackageExercisePhaseError extends Error {
  constructor(surface, phase, code) {
    super(code)
    this.code = code
    this.phase = phase
    this.surface = surface
  }
}

let contractOptions
try {
  contractOptions = parseContractOptions(process.argv.slice(2))
  if (contractOptions.sourceCli === undefined) await runInstalledPackageContract(contractOptions)
  else await runSourceCliContract(contractOptions)
} catch (error) {
  emitBoundedExerciseDiagnostic(error, contractOptions)
  process.exitCode = 1
} finally {
  rmSync(temporaryRoot, { force: true, recursive: true })
}

function emitBoundedExerciseDiagnostic(error, options) {
  if (options?.packageExercise !== true || !(error instanceof PackageExercisePhaseError)) return
  process.stdout.write(`${formatPackageExercisePhaseRecord(
    error.surface,
    error.phase,
    "blocked",
    error.code,
    packageExercisePhaseMarker(error.surface),
  )}\n`)
}

async function runInstalledPackageContract(options) {
  const {
    observerGh,
    packageAcceptance,
    packageExercise,
    producerIntakeOnly,
    tarball,
    tarballContentIdentity,
    tarballSha256,
  } = options
  const runPhase = createPackageExercisePhaseRunner(options, "fresh-tar")
  const packed = await runPhase("tarball-materialization", () => tarball === undefined
    ? packCurrentRepository()
    : readSuppliedTarball(tarball, tarballSha256, tarballContentIdentity))
  const { consumerDirectory, installedPackage } = await runPhase("fresh-install", () => installFreshTarball(packed.tarballPath))

  await runPhase("package-identity", () => assertInstalledPackageIdentity(installedPackage, packed.identity))
  await runPhase("package-content-identity", () => assertInstalledPackageContentIdentity(
    installedPackage,
    packed.tarballPath,
    packed.facts.packageContentIdentity,
  ))
  await runPhase("opencode-interview-observation", () => assertOpenCodeInterviewObservationContract(
    installedPackage,
    "installed package",
  ))
  await runPhase("repository-only-files", () => assertRepositoryOnlyFilesAreAbsent(installedPackage))
  await runPhase("canonical-publisher", () => assertCanonicalPackagePublisherPlan(installedPackage, "installed package"))
  await runPhase("observer-credential", () => assertObserverCredentialPreflight(installedPackage, consumerDirectory, "installed package"))
  await runPhase("producer-intake", () => assertPackagedProjectFinishProducerIntake(installedPackage, consumerDirectory))
  await runPhase("producer-action-topology", () => assertPackagedProjectFinishProducerActionTopology(installedPackage, consumerDirectory))
  if (producerIntakeOnly) {
    assertNativeProducerInputSurface(installedPackage, consumerDirectory, "installed package")
    process.stdout.write("installed-project-finish-producer-intake-contract: PASS\n")
    return
  }

  await runPhase("verifier-no-source", () => assertPackagedVerifierFailsClosedWithoutSourceCheckout(installedPackage, consumerDirectory))
  await runPhase("project-finish-verifier-no-source", () => assertPackagedProjectFinishVerifierFailsClosedWithoutSourceCheckout(installedPackage, consumerDirectory))
  await assertPackagedConsumerAuthorityBoundary(
    installedPackage,
    consumerDirectory,
    observerGh,
    packageAcceptance,
    packageExercise,
    runPhase,
  )
  await runPhase("staged-artifact-verifier", () => assertPackagedStagedArtifactVerifierWorksWithoutSourceCheckout(installedPackage, consumerDirectory))
  await runPhase("doctor-registry", () => assertDoctorRegistryReadback(
    join(consumerDirectory, "doctor-registry-fixture"),
    join(consumerDirectory, "node_modules", ".bin", "ph"),
    installedPackage,
    "installed package",
  ))
  if (!packageExercise) {
    assertPackedCooperativeFinishWorks(installedPackage, consumerDirectory)
  }
  await runPhase("evidence-read-write", () => assertPackagedEvidenceReadWriteBoundary(installedPackage, consumerDirectory))
  await runPhase("report-stdin", () => assertPackagedBoundedReportStdin(installedPackage, consumerDirectory))
  await runPhase("workflow-lifecycle", () => assertWorkflowLifecycleAbsenceBlocks(
    join(consumerDirectory, "workflow-lifecycle-absence-fixture"),
    join(consumerDirectory, "node_modules", ".bin", "ph"),
    "installed package",
  ))
  await runPhase("bootstrap-workspace-intake", () => assertBootstrapWorkspaceIntake(
    join(consumerDirectory, "workflow-lifecycle-state-intake-fixture"),
    join(consumerDirectory, "node_modules", ".bin", "ph"),
    "installed package",
  ))
  await runPhase("installed-package-test", () => assertInstalledPackageTestPasses(installedPackage))
  process.stdout.write(`installed-package-artifact: ${JSON.stringify(packed.facts)}\n`)
  process.stdout.write(packageExercise
    ? "installed-package-exercise-contract: PASS\n"
    : packageAcceptance
      ? "installed-package-acceptance-contract: PASS\n"
      : "installed-package-test-contract: PASS\n")
}

async function runSourceCliContract(options) {
  const { observerGh, packageExercise, producerIntakeOnly, sourceCli } = options
  const runPhase = createPackageExercisePhaseRunner(options, "source-built")
  const phPath = await runPhase("cli-binding", () => resolveSourceCliPath(sourceCli))
  await runPhase("opencode-interview-observation", () => assertOpenCodeInterviewObservationContract(
    repositoryRoot,
    "source CLI",
  ))

  await runPhase("producer-intake", () => assertSourceProjectFinishProducerIntake(phPath))
  await runPhase("producer-action-topology", () => assertSourceProjectFinishProducerActionTopology())
  if (producerIntakeOnly) {
    assertNativeProducerInputSurface(repositoryRoot, repositoryRoot, "source CLI")
    process.stdout.write("source-cli-project-finish-producer-intake-contract: PASS\n")
    return
  }

  await assertSourceConsumerAuthorityBoundary(phPath, observerGh, packageExercise, runPhase)
  await runPhase("doctor-registry", () => assertSourceDoctorRegistryReadback(phPath))
  if (!packageExercise) {
    assertSourceCooperativeFinishWorks(phPath)
  }
  await runPhase("evidence-read-write", () => assertSourceEvidenceReadWriteBoundary(phPath))
  await runPhase("report-stdin", () => assertSourceBoundedReportStdin(phPath))
  await runPhase("workflow-lifecycle", () => assertSourceWorkflowLifecycleAbsenceBlocks(phPath))
  await runPhase("bootstrap-workspace-intake", () => assertSourceBootstrapWorkspaceIntake(phPath))
  process.stdout.write(packageExercise
    ? "source-cli-package-exercise-contract: PASS\n"
    : "source-cli-cooperative-finish-contract: PASS\n")
}

function createPackageExercisePhaseRunner(options, surface) {
  return async (phase, operation) => {
    try {
      const result = await operation()
      if (options.packageExercise) {
        process.stdout.write(`${formatPackageExercisePhaseRecord(surface, phase, "ready", "passed", packageExercisePhaseMarker(surface))}\n`)
      }
      return result
    } catch (error) {
      if (!options.packageExercise || error instanceof PackageExercisePhaseError) throw error
      const code = error instanceof ObserverGhContractStageError && isObserverGhStageCode(error.code)
        ? error.code
        : "contract-failed"
      throw new PackageExercisePhaseError(surface, phase, code)
    }
  }
}

function packageExercisePhaseMarker(surface) {
  return surface === "source-built"
    ? "source-cli-package-exercise-phase"
    : "installed-package-exercise-phase"
}

function resolveSourceCliPath(sourceCliPath) {
  const phPath = resolve(repositoryRoot, sourceCliPath)
  if (!existsSync(phPath)) throw new Error("source CLI is missing")
  return phPath
}

async function assertOpenCodeInterviewObservationContract(packageRoot, label) {
  const scriptPath = join(packageRoot, "scripts", "opencode-interview-observation-contract.mjs")
  if (!existsSync(scriptPath)) {
    throw new Error(`${label} OpenCode interview observation contract is missing from the package`)
  }
  const contract = await import(pathToFileURL(scriptPath).href)
  const sessionID = "installed-observation-session"
  const result = contract.evaluateOpenCodeInterviewObservation({
    schemaVersion: contract.OPENCODE_INTERVIEW_OBSERVATION_SCHEMA_VERSION,
    events: [
      {
        type: "message.updated",
        properties: { info: { id: "assistant-message", sessionID, role: "assistant" } },
      },
      {
        type: "message.part.updated",
        properties: {
          part: {
            id: "assistant-text",
            sessionID,
            messageID: "assistant-message",
            type: "text",
            text: "Which people should this product help first?",
          },
        },
      },
    ],
  })
  if (
    result.status !== "passed"
    || result.code !== "ready"
    || result.ambiguousInterviewFirst !== true
    || result.responsePredicatePostModel !== true
    || result.preApprovalNoMutation !== true
  ) {
    throw new Error(`${label} OpenCode interview observation contract did not accept the assistant event path`)
  }
  const transformedOnly = contract.evaluateOpenCodeInterviewObservation({
    schemaVersion: contract.OPENCODE_INTERVIEW_OBSERVATION_SCHEMA_VERSION,
    events: [
      {
        type: "message.updated",
        properties: { info: { id: "user-message", sessionID, role: "user" } },
      },
      {
        type: "message.part.updated",
        properties: {
          part: {
            id: "user-text",
            sessionID,
            messageID: "user-message",
            type: "text",
            text: "Which people should this product help first?",
          },
        },
      },
    ],
  })
  if (
    transformedOnly.status !== "blocked"
    || transformedOnly.code !== "assistant-response-missing"
    || transformedOnly.responsePredicatePostModel !== false
    || JSON.stringify(transformedOnly).includes("Which people")
  ) {
    throw new Error(`${label} OpenCode interview observation contract accepted transformed input or leaked response data`)
  }
}

async function assertPackagedConsumerAuthorityBoundary(
  installedPackage,
  consumerDirectory,
  observerGh,
  packageAcceptance,
  packageExercise,
  runPhase,
) {
  const scripts = [
    "consumer-authority-artifact-archive.mjs",
    "consumer-authority-artifact-error.mjs",
    "fetch-consumer-authority-artifact.mjs",
    "read-consumer-authority-github.mjs",
  ]
  await runPhase("prearmed-observer", () => {
    for (const script of scripts) {
      if (!existsSync(join(installedPackage, "scripts", script))) {
        throw new Error("installed package is missing consumer authority transport")
      }
    }
    assertPrearmedObserverHandoff(installedPackage, "installed package")
  })
  await runPhase("v4-cleanliness", () => assertV4FinalObserverCleanliness(installedPackage, "installed package"))
  if (!packageAcceptance) {
    await runPhase("observer-gh-selector", () => assertWorkflowSelectedObserverGhLifecycle(
      installedPackage,
      consumerDirectory,
      "installed package",
      observerGh,
    ))
    await runPhase("attestation-parser", () => assertExternalAttestationCommandPlan(
      installedPackage,
      consumerDirectory,
      "installed package",
      observerGh,
    ))
  }
  await runPhase("artifact-transport", () => assertExternalArtifactTransportPlan(installedPackage, consumerDirectory, "installed package"))
  const authorityDiscoveryResult = await runPhase("authority-discovery", () => assertBoundAuthorityDiscovery(
    installedPackage,
    "installed package",
    "fresh-tar",
  ))
  emitAuthorityDiscoveryExerciseResult(packageExercise, authorityDiscoveryResult)
  await runPhase("authority-lifecycle", () => assertConsumerAuthorityBoundary(
    consumerDirectory,
    join(consumerDirectory, "node_modules", ".bin", "ph"),
    join(consumerDirectory, "consumer-authority-home"),
    "installed package",
  ))
}

async function assertSourceConsumerAuthorityBoundary(phPath, observerGh, packageExercise, runPhase) {
  await runPhase("canonical-publisher", () => assertCanonicalPackagePublisherPlan(repositoryRoot, "source CLI"))
  await runPhase("prearmed-observer", () => assertPrearmedObserverHandoff(repositoryRoot, "source CLI"))
  await runPhase("v4-cleanliness", () => assertV4FinalObserverCleanliness(repositoryRoot, "source CLI"))
  await runPhase("observer-gh-selector", () => assertWorkflowSelectedObserverGhLifecycle(
    repositoryRoot,
    temporaryRoot,
    "source CLI",
    observerGh,
  ))
  await runPhase("attestation-parser", () => assertExternalAttestationCommandPlan(
    repositoryRoot,
    temporaryRoot,
    "source CLI",
    observerGh,
  ))
  await runPhase("artifact-transport", () => assertExternalArtifactTransportPlan(repositoryRoot, temporaryRoot, "source CLI"))
  await runPhase("observer-credential", () => assertObserverCredentialPreflight(repositoryRoot, temporaryRoot, "source CLI"))
  const authorityDiscoveryResult = await runPhase("authority-discovery", () => assertBoundAuthorityDiscovery(
    repositoryRoot,
    "source CLI",
    "source-built",
  ))
  emitAuthorityDiscoveryExerciseResult(packageExercise, authorityDiscoveryResult)
  await runPhase("authority-lifecycle", () => assertConsumerAuthorityBoundary(
    temporaryRoot,
    phPath,
    join(temporaryRoot, "source-consumer-authority-home"),
    "source CLI",
  ))
}

function emitAuthorityDiscoveryExerciseResult(packageExercise, result) {
  if (!packageExercise) return
  process.stdout.write(`${formatAuthorityDiscoveryExerciseResult(result)}\n`)
}

async function assertObserverCredentialPreflight(packageRoot, cwd, label) {
  const scripts = [
    "consumer-authority-observer-preflight-core.mjs",
    "consumer-authority-observer-preflight-launcher.mjs",
    "consumer-authority-observer-preflight-worker.mjs",
    "preflight-consumer-authority-observer.mjs",
  ]
  for (const script of scripts) {
    if (!existsSync(join(packageRoot, "scripts", script))) {
      throw new Error(`${label} observer credential preflight is missing from the package`)
    }
  }
  const [core, launcher] = await Promise.all([
    import(pathToFileURL(join(packageRoot, "scripts", "consumer-authority-observer-preflight-core.mjs")).href),
    import(pathToFileURL(join(packageRoot, "scripts", "consumer-authority-observer-preflight-launcher.mjs")).href),
  ])
  const credential = "ghp_observer_packaged_boundary_probe"
  const requested = []
  const readiness = await core.assessGithubActionsReadiness(credential, async (url, headers) => {
    requested.push(url.toString())
    if (headers.Authorization !== `Bearer ${credential}`) throw new Error("observer credential was not bound to the fixed request")
    return url.pathname === "/user"
      ? { body: { id: 7 }, statusCode: 200 }
      : { body: { artifacts: [], total_count: 0 }, statusCode: 200 }
  })
  if (
    readiness?.state !== "ready"
    || readiness?.credential !== "usable"
    || readiness?.fixtureAuthorization !== "required"
    || readiness?.authorityEligible !== false
    || readiness?.mutationPerformed !== false
    || requested.join("\n") !== [
      "https://api.github.com/user",
      "https://api.github.com/repos/jyt6640/persona-harness-attestation-claim-fixture/actions/artifacts?name=persona-harness-observer-preflight-sentinel-v1&per_page=1",
    ].join("\n")
  ) {
    throw new Error(`${label} observer credential preflight did not retain the fixed read-only route`)
  }

  let removedHome
  const launched = launcher.runObserverCredentialPreflight({
    createHome: () => "/isolated-observer-home",
    environment: {
      GH_TOKEN: "ambient-token-must-not-cross",
      GITHUB_TOKEN: "ambient-token-must-not-cross",
      HOME: "/host-home",
      PATH: "/host-bin",
      PH_OBSERVER_PREFLIGHT_GITHUB_TOKEN: "ambient-token-must-not-cross",
      SECRET_MARKER: "host-secret-must-not-cross",
    },
    execute: (command, args, options) => {
      if (command === "gh") {
        if (
          args.join("\n") !== ["auth", "token", "--hostname", "github.com"].join("\n")
          || options.env.GH_TOKEN !== undefined
          || options.env.GITHUB_TOKEN !== undefined
          || options.env.PH_OBSERVER_PREFLIGHT_GITHUB_TOKEN !== undefined
          || options.env.SECRET_MARKER !== undefined
          || options.env.HOME !== "/host-home"
        ) {
          throw new Error("host credential retrieval environment was not isolated")
        }
        return { status: 0, stdout: `${credential}\n` }
      }
      if (
        command !== process.execPath
        || options.env.HOME !== "/isolated-observer-home"
        || options.env.PH_OBSERVER_PREFLIGHT_GITHUB_TOKEN !== credential
        || Object.keys(options.env).sort().join("\n") !== ["HOME", "LANG", "LC_ALL", "PH_OBSERVER_PREFLIGHT_GITHUB_TOKEN"].join("\n")
      ) {
        throw new Error("observer worker credential environment was not isolated")
      }
      return {
        status: 0,
        stdout: `${JSON.stringify({
          authorityEligible: false,
          consumerHome: "isolated",
          credential: "usable",
          fixtureAuthorization: "required",
          mutationPerformed: false,
          next: "fixture-authorization",
          schemaVersion: "consumer-authority-observer-preflight.1",
          state: "ready",
        })}\n`,
      }
    },
    removeHome: (home) => {
      removedHome = home
    },
  })
  if (
    launched?.state !== "ready"
    || launched?.credential !== "usable"
    || removedHome !== "/isolated-observer-home"
    || JSON.stringify(launched).includes(credential)
  ) {
    throw new Error(`${label} observer credential preflight leaked or persisted host credentials`)
  }

  const fixtureRoot = mkdtempSync(join(temporaryRoot, "observer-preflight-public-cli-"))
  const bin = join(fixtureRoot, "bin")
  const hostHome = join(fixtureRoot, "host-home")
  const marker = join(bin, "gh-ran")
  const gh = join(bin, "gh")
  mkdirSync(bin)
  writeFileSync(gh, [
    "#!/bin/sh",
    "if [ -n \"$GH_TOKEN$GITHUB_TOKEN$PH_OBSERVER_PREFLIGHT_GITHUB_TOKEN\" ]; then exit 88; fi",
    `if [ \"$HOME\" != ${JSON.stringify(hostHome)} ]; then exit 89; fi`,
    `: > ${JSON.stringify(marker)}`,
    "exit 1",
    "",
  ].join("\n"))
  chmodSync(gh, 0o755)
  const publicResult = runObserverPreflightNode(cwd, [join(packageRoot, "scripts", "preflight-consumer-authority-observer.mjs"), "--json"], {
    GH_TOKEN: "ambient-token-must-not-cross",
    GITHUB_TOKEN: "ambient-token-must-not-cross",
    HOME: hostHome,
    PATH: bin,
    PH_OBSERVER_PREFLIGHT_GITHUB_TOKEN: "ambient-token-must-not-cross",
  })
  let publicPayload
  try {
    publicPayload = JSON.parse(publicResult.stdout)
  } catch {
    throw new Error(
      `${label} public observer credential preflight did not return bounded JSON `
      + `(status=${publicResult.status ?? "unavailable"}, stdout-bytes=${Buffer.byteLength(publicResult.stdout)}, stderr-bytes=${Buffer.byteLength(publicResult.stderr)})`,
    )
  }
  if (
    publicResult.status === 0
    || !existsSync(marker)
    || publicPayload?.code !== "host-gh-auth-unavailable"
    || publicPayload?.state !== "blocked"
    || publicPayload?.mutationPerformed !== false
    || `${publicResult.stdout}${publicResult.stderr}`.includes("ambient-token-must-not-cross")
    || `${publicResult.stdout}${publicResult.stderr}`.includes(hostHome)
  ) {
    throw new Error(`${label} public observer credential preflight crossed the product boundary`)
  }
}

function assertConsumerAuthorityBoundary(cwd, phPath, home, label) {
  mkdirSync(home, { recursive: true })
  const credential = "ghp_packaged_boundary_probe"
  const unauthenticatedEnvironment = { GH_TOKEN: "", GITHUB_TOKEN: "", HOME: home }
  const help = runNode(cwd, [phPath, "authority", "--help"], unauthenticatedEnvironment)
  requireSuccess(`${label} authority help`, help)
  if (!help.stdout.includes("fetch github")) {
    throw new Error(`${label} authority help omitted the enrolled evidence route`)
  }
  const nonInteractiveEnrollment = runNode(
    cwd,
    [
      phPath,
      "authority",
      "enroll",
      "github",
      "jyt6640/persona-harness-attestation-claim-fixture",
      "--workflow",
      ".github/workflows/persona-harness.yml",
    ],
    { ...unauthenticatedEnvironment, GH_TOKEN: credential },
  )
  if (
    nonInteractiveEnrollment.status === 0
    || !nonInteractiveEnrollment.stderr.includes("interactive confirmation")
    || `${nonInteractiveEnrollment.stdout}${nonInteractiveEnrollment.stderr}`.includes(home)
    || `${nonInteractiveEnrollment.stdout}${nonInteractiveEnrollment.stderr}`.includes(credential)
  ) {
    throw new Error(`${label} authority enrollment did not preserve the interactive boundary`)
  }
  assertBoundedAuthorityAbsence(
    [
      runNode(cwd, [phPath, "authority", "status", "--json"], unauthenticatedEnvironment),
      runNode(cwd, [phPath, "authority", "fetch", "github", "--json"], unauthenticatedEnvironment),
      runNode(cwd, [phPath, "authority", "explain", "--json"], unauthenticatedEnvironment),
    ],
    home,
    label,
    credential,
    {
      githubAuthentication: "unavailable",
      next: "github-authenticate",
      state: "authentication-unavailable",
    },
  )
  const authenticatedEnvironment = {
    ...unauthenticatedEnvironment,
    GH_TOKEN: credential,
  }
  assertBoundedAuthorityAbsence(
    [
      runNode(cwd, [phPath, "authority", "status", "--json"], authenticatedEnvironment),
      runNode(cwd, [phPath, "authority", "fetch", "github", "--json"], authenticatedEnvironment),
      runNode(cwd, [phPath, "authority", "explain", "--json"], authenticatedEnvironment),
    ],
    home,
    label,
    credential,
    {
      githubAuthentication: "available",
      next: "authority-enroll-github",
      state: "enrollment-unavailable",
    },
  )
  if (existsSync(join(home, ".persona-harness"))) {
    throw new Error(`${label} authority absence created local evidence`)
  }
  assertNoCredentialPersistence(home, credential, label)
}

function assertBoundedAuthorityAbsence(results, home, label, credential, expected) {
  for (const result of results) {
    if (result.status === 0) {
      throw new Error(`${label} authority unexpectedly trusted absent enrollment`)
    }
    const payload = JSON.parse(result.stdout)
    if (
      !isRecord(payload)
      || payload["authorityEligible"] !== false
      || payload["consumptionState"] !== "not-applicable"
      || payload["enrollment"] !== "unavailable"
      || payload["githubAuthentication"] !== expected.githubAuthentication
      || payload["next"] !== expected.next
      || payload["state"] !== expected.state
      || JSON.stringify(payload).includes(home)
      || JSON.stringify(payload).includes(credential)
    ) {
      throw new Error(`${label} authority absence did not remain bounded`)
    }
  }
}

function assertNoCredentialPersistence(home, credential, label) {
  for (const path of [
    join(home, ".persona-harness", "consumer-authority-v1.json"),
    join(home, ".persona-harness", "consumer-authority-artifact-987654321.json"),
  ]) {
    if (existsSync(path) && readFileSync(path, "utf8").includes(credential)) {
      throw new Error(`${label} authority credential was persisted`)
    }
  }
}

function packCurrentRepository() {
  const identity = readSourcePackIdentity()
  assertSourcePackManifest()
  const packDirectory = join(temporaryRoot, "pack")
  mkdirSync(packDirectory)
  const result = runBoundNpm(repositoryRoot, ["pack", "--json", "--pack-destination", packDirectory])
  requireSuccess("package pack", result)
  assertSourcePackManifest()
  return { ...resolvePackResult(result.stdout, packDirectory, identity), identity }
}

function readSuppliedTarball(tarballPath, expectedSha256, expectedContentIdentity) {
  if (
    typeof tarballPath !== "string"
    || typeof expectedSha256 !== "string"
    || typeof expectedContentIdentity !== "string"
    || !/^[0-9a-f]{64}$/u.test(expectedSha256)
    || !/^[0-9a-f]{64}$/u.test(expectedContentIdentity)
  ) {
    throw new TypeError("installed package tarball contract is invalid")
  }
  const resolved = realpathSync(tarballPath)
  const stat = lstatSync(resolved)
  const bytes = readFileSync(resolved)
  let packageContentIdentity
  try {
    packageContentIdentity = readPackageContentIdentity(bytes)
  } catch {
    throw new Error("installed package tarball content identity does not match")
  }
  if (
    !stat.isFile()
    || stat.isSymbolicLink()
    || sha256(bytes) !== expectedSha256
    || packageContentIdentity.identitySha256 !== expectedContentIdentity
  ) {
    throw new Error("installed package tarball identity does not match")
  }
  const identity = readSourcePackIdentity()
  return {
    facts: {
      packageContentIdentity,
      tarballSha256: expectedSha256,
    },
    identity,
    tarballPath: resolved,
  }
}

function installFreshTarball(tarballPath) {
  const consumerDirectory = join(temporaryRoot, "consumer")
  mkdirSync(consumerDirectory)
  writeFileSync(
    join(consumerDirectory, "package.json"),
    `${JSON.stringify({ private: true }, null, 2)}\n`,
  )

  const result = runBoundNpm(consumerDirectory, [
    "install",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    tarballPath,
  ])
  requireSuccess("fresh package installation", result)
  return {
    consumerDirectory,
    installedPackage: join(consumerDirectory, "node_modules", "persona-harness"),
  }
}

function assertRepositoryOnlyFilesAreAbsent(installedPackage) {
  if (existsSync(join(installedPackage, "tests"))) {
    throw new Error("installed package unexpectedly contains repository tests")
  }
  if (existsSync(join(installedPackage, "src"))) {
    throw new Error("installed package unexpectedly contains repository source")
  }
  if (existsSync(join(installedPackage, ".git"))) {
    throw new Error("installed package unexpectedly contains repository Git metadata")
  }
  if (existsSync(join(installedPackage, "scripts", "check-mvp-scope.mjs"))) {
    throw new Error("installed package unexpectedly contains repository scope checks")
  }
  if (existsSync(join(installedPackage, "scripts", "verify-clean-package-boundary.mjs"))) {
    throw new Error("installed package unexpectedly contains the Git-bound source verifier")
  }
  for (const script of [
    "consumer-authority-observer-gh-package-record.mjs",
    "consumer-authority-observer-gh-stage.mjs",
  ]) {
    const scriptPath = join(installedPackage, "scripts", script)
    if (!existsSync(scriptPath) || lstatSync(scriptPath).isSymbolicLink()) {
      throw new Error("installed package observer stage is missing")
    }
  }
}

function assertInstalledPackageIdentity(installedPackage, identity) {
  const installed = JSON.parse(readFileSync(join(installedPackage, "package.json"), "utf8"))
  if (installed?.name !== identity.name || installed?.version !== identity.version) {
    throw new Error("installed package identity differs from tarball source")
  }
}

function assertInstalledPackageContentIdentity(installedPackage, tarballPath, expected) {
  const installedReader = join(installedPackage, "scripts", "package-content-identity.mjs")
  if (!existsSync(installedReader) || lstatSync(installedReader).isSymbolicLink()) {
    throw new Error("installed package content identity reader is missing")
  }
  const script = [
    'import { readFileSync } from "node:fs";',
    `import { readPackageContentIdentity } from ${JSON.stringify(pathToFileURL(installedReader).href)};`,
    `const identity = readPackageContentIdentity(readFileSync(${JSON.stringify(tarballPath)}));`,
    "process.stdout.write(JSON.stringify(identity));",
  ].join("\n")
  const result = runNode(installedPackage, ["--input-type=module", "--eval", script])
  if (result.status !== 0 || result.stderr !== "") {
    throw new Error("installed package content identity reader failed")
  }
  let observed
  try {
    observed = JSON.parse(result.stdout)
  } catch {
    throw new Error("installed package content identity reader output is invalid")
  }
  if (JSON.stringify(observed) !== JSON.stringify(expected)) {
    throw new Error("installed package content identity differs from tarball")
  }
}

function assertInstalledPackageTestPasses(installedPackage) {
  const result = runNpm(installedPackage, ["test"])
  requireSuccess("installed package test", result)
  if (!result.stdout.includes("Persona Harness")) {
    throw new Error("installed package test did not reach the packaged CLI help surface")
  }
}

function assertPackagedVerifierFailsClosedWithoutSourceCheckout(installedPackage, consumerDirectory) {
  const workerPath = join(installedPackage, "scripts", "verify-finish-attestation.mjs")
  if (!existsSync(workerPath)) {
    throw new Error("installed package is missing the product-owned verifier worker")
  }
  const bundlePath = join(consumerDirectory, ".persona", "evidence", "finish-attestation", "bundle.json")
  mkdirSync(dirname(bundlePath), { recursive: true })
  copyFileSync(
    join(repositoryRoot, "tests", "fixtures", "finish-attestation", "protected-main-29511625395.bundle.json"),
    bundlePath,
  )
  const modulePath = join(installedPackage, "dist", "cli", "workflow-finish-attestation.js")
  const probe = runNode(consumerDirectory, [
    "--input-type=module",
    "-e",
    `import { verifyExternalFinishAttestation } from ${JSON.stringify(modulePath)}; const result = verifyExternalFinishAttestation(process.cwd(), new Date("2026-07-16T16:00:00.000Z"), { consume: false }); if (result.authorityEligible || result.state !== "source-drift") process.exit(1);`,
  ])
  requireSuccess("installed packaged verifier fail-closed probe", probe)
}

function assertPackagedProjectFinishVerifierFailsClosedWithoutSourceCheckout(installedPackage, consumerDirectory) {
  const workerPath = join(installedPackage, "scripts", "verify-project-finish-attestation.mjs")
  const errorClassifierPath = join(
    installedPackage,
    "scripts",
    "project-finish-attestation-sigstore-error.mjs",
  )
  const modulePath = pathToFileURL(join(
    installedPackage,
    "dist",
    "cli",
    "project-finish-attestation-verifier.js",
  )).href
  const projectDir = join(consumerDirectory, "project-finish-verifier-local")
  const evidenceDirectory = join(projectDir, ".persona", "evidence", "project-finish-attestation")
  if (!existsSync(workerPath) || !existsSync(errorClassifierPath)) {
    throw new Error("installed package is missing the project finish verifier worker")
  }
  mkdirSync(evidenceDirectory, { recursive: true })
  writeFileSync(join(evidenceDirectory, "bundle.json"), '{"local":"unsigned"}\n')
  writeFileSync(join(evidenceDirectory, "predicate.json"), '{}\n')
  writeFileSync(join(evidenceDirectory, "receipt.json"), '{}\n')

  const probe = runNode(projectDir, [
    "--input-type=module",
    "-e",
    [
      "import { inspectProjectFinishAttestation } from " + JSON.stringify(modulePath) + ";",
      'import { existsSync } from "node:fs";',
      'import { join } from "node:path";',
      "const projectDir = process.cwd();",
      'const enrollment = { callerWorkflowPath: "project.yml", repositoryId: 123, repositorySlug: "example/public-project", reusableWorkflowSha: "b".repeat(40) };',
      'const result = inspectProjectFinishAttestation(projectDir, enrollment, new Date("2026-07-23T02:45:00.000Z"));',
      'const consumption = join(projectDir, ".persona", "evidence", "finish-attestation", "consumption.json");',
      'if (result.authorityEligible || result.state !== "malformed-bundle" || existsSync(consumption)) process.exit(1);',
    ].join("\n"),
  ])
  requireSuccess("installed project finish verifier no-source-fallback probe", probe)
}

function assertPackagedStagedArtifactVerifierWorksWithoutSourceCheckout(installedPackage, consumerDirectory) {
  const fixtureRoot = join(consumerDirectory, "staged-artifact-fixture")
  const packageFixtureRoot = join(repositoryRoot, "tests", "fixtures", "staged-package-artifact", "rc6")
  const corePath = join(installedPackage, "scripts", "staged-package-artifact-provenance-core.mjs")
  const workerPath = join(installedPackage, "scripts", "verify-staged-package-artifact-attestation.mjs")
  const phPath = join(consumerDirectory, "node_modules", ".bin", "ph")
  mkdirSync(fixtureRoot)
  for (const fileName of ["action-run.json", "bundle.json", "package.tgz"]) {
    copyFileSync(join(packageFixtureRoot, fileName), join(fixtureRoot, fileName))
  }
  if (!existsSync(corePath) || !existsSync(workerPath)) {
    throw new Error("installed package is missing staged artifact provenance code")
  }
  const help = runNode(consumerDirectory, [phPath, "dev", "staged-package-provenance", "--help"])
  requireSuccess("installed staged artifact verifier help", help)
  const probe = runNode(consumerDirectory, [
    "--input-type=module",
    "-e",
    [
      `import { verifyStagedPackageArtifactEvidence } from ${JSON.stringify(pathToFileURL(corePath).href)};`,
      'import { readFileSync } from "node:fs";',
      'import { join } from "node:path";',
      'const fixture = join(process.cwd(), "staged-artifact-fixture");',
      'const read = (name) => JSON.parse(readFileSync(join(fixture, name), "utf8"));',
      'const tarball = readFileSync(join(fixture, "package.tgz"));',
      'const attestation = { bundle: read("bundle.json"), repository_id: 1272008570 };',
      'const result = await verifyStagedPackageArtifactEvidence({',
      '  actionRun: read("action-run.json"),',
      '  attestation,',
      '  attestations: [attestation],',
      '  channel: "staging",',
      '  now: new Date("2026-07-17T12:00:00.000Z"),',
      '  registryIndex: { "dist-tags": { staging: "0.7.0-rc.6" } },',
      '  registryVersion: {',
      '    dist: { integrity: "sha512-Gf3g0U4YZ3fmD327ruboyPCEctMITx+0X9l7iUN9IKD82jWygwxVZS+tiYvYRSAn1udYW5Lq8QwldZ+4n7mY7Q==", shasum: "3fa7e7579e885ee9446f2e4b55bdaa13b1abf80e", tarball: "https://registry.npmjs.org/persona-harness/-/persona-harness-0.7.0-rc.6.tgz" },',
      '    gitHead: "1c8976c58102908329f63dc78286b2646bfc52dd",',
      '    name: "persona-harness",',
      '    version: "0.7.0-rc.6",',
      '  },',
      '  tarballBytes: tarball,',
      '  version: "0.7.0-rc.6",',
      '});',
      'if (result.channel !== "staging" || result.version !== "0.7.0-rc.6" || result.subjectDigest !== "sha256:37f679a0125c354d5f5c5c8ad933fe7a6e7d9e6df6ab892afdf06ed2310b7794") process.exit(1);',
    ].join("\n"),
  ])
  requireSuccess("installed staged artifact verifier exact-byte probe", probe)
}

function assertPackedCooperativeFinishWorks(installedPackage, consumerDirectory) {
  const fixtureRoot = join(consumerDirectory, "cooperative-gradle-fixture")
  const phPath = join(consumerDirectory, "node_modules", ".bin", "ph")
  const readiness = readGaPreAuthorityReadiness(installedPackage)
  assertCooperativeFinishWorks(
    fixtureRoot,
    phPath,
    "installed package",
    readiness,
    installedPackage,
  )
  assertCooperativeSourceReadRaceBlocks(
    `${fixtureRoot}-source-read-race`,
    phPath,
    "installed package",
    readiness,
  )
}

function assertPackagedEvidenceReadWriteBoundary(installedPackage, consumerDirectory) {
  assertEvidenceReadWriteBoundary(
    join(consumerDirectory, "evidence-read-write-boundary"),
    join(consumerDirectory, "node_modules", ".bin", "ph"),
    "installed package",
  )
}

async function assertPackagedBoundedReportStdin(installedPackage, consumerDirectory) {
  await assertBoundedReportStdin(
    join(consumerDirectory, "bounded-report-stdin"),
    join(consumerDirectory, "node_modules", ".bin", "ph"),
    "installed package",
  )
}

function assertPackagedProjectFinishProducerIntake(installedPackage, consumerDirectory) {
  assertProjectFinishProducerIntake(
    pathToFileURL(join(installedPackage, "dist", "cli", "project-finish-attestation-producer-runner.js")).href,
    consumerDirectory,
    "installed package",
    readPackageVersion(installedPackage),
  )
}

function assertPackagedProjectFinishProducerActionTopology(installedPackage, consumerDirectory) {
  assertProjectFinishProducerActionTopology(
    installedPackage,
    join(consumerDirectory, "project-finish-producer-action-topology"),
    "installed package",
  )
}

function assertSourceProjectFinishProducerIntake(sourceCliPath) {
  const sourceModule = resolve(repositoryRoot, "dist", "cli", "project-finish-attestation-producer-runner.js")
  if (!existsSync(sourceModule) || !existsSync(resolve(repositoryRoot, sourceCliPath))) {
    throw new Error("source project finish producer runtime is missing")
  }
  assertProjectFinishProducerIntake(
    pathToFileURL(sourceModule).href,
    join(temporaryRoot, "source-cli-project-finish-producer-intake"),
    "source CLI",
    readPackageVersion(repositoryRoot),
  )
}

function assertSourceProjectFinishProducerActionTopology() {
  assertProjectFinishProducerActionTopology(
    repositoryRoot,
    join(temporaryRoot, "source-cli-project-finish-producer-action-topology"),
    "source CLI",
  )
}

function assertProjectFinishProducerActionTopology(packageRoot, fixtureRoot, label) {
  const normalRunnerPath = join(fixtureRoot, "normal-runner")
  const replacementRunnerPath = join(fixtureRoot, "replacement-runner")
  const outside = join(fixtureRoot, "outside-caller")
  createProjectFinishProducerActionTopology(packageRoot, normalRunnerPath)
  const normalRunner = realpathSync(normalRunnerPath)

  const normal = runProjectFinishProducerActionTopology(normalRunner)
  if (normal.status !== 0) {
    throw new Error(`${label} nested github-script producer topology failed: ${boundedActionTopologyDiagnostic(normal)}`)
  }
  if (normal.stdout !== "project-finish-producer-action-topology:passed\n") {
    throw new Error(`${label} nested github-script producer topology did not materialize outer artifacts`)
  }

  mkdirSync(outside, { recursive: true })
  createProjectFinishProducerActionTopology(packageRoot, replacementRunnerPath)
  const replacementRunner = realpathSync(replacementRunnerPath)
  const hookPath = join(fixtureRoot, "project-finish-producer-action-topology-audit-hook.cjs")
  const sentinel = join(fixtureRoot, "project-finish-producer-action-topology-audit")
  writeNativeReadAuditHook(hookPath, "directory", "capture-root", [
    '    require("node:fs").renameSync(process.env.PH_ACTION_CALLER, process.env.PH_ACTION_CALLER_DRAFT)',
    '    require("node:fs").symlinkSync(process.env.PH_ACTION_OUTSIDE, process.env.PH_ACTION_CALLER)',
  ], true)
  const replacement = runProjectFinishProducerActionTopology(replacementRunner, {
    ...nativeReadAuditEnvironment(outside, sentinel),
    PH_ACTION_CALLER: join(replacementRunner, ".project-finish-caller"),
    PH_ACTION_CALLER_DRAFT: join(replacementRunner, ".project-finish-caller.draft"),
    PH_ACTION_OUTSIDE: outside,
  }, hookPath)
  if (replacement.status !== 0) {
    throw new Error(`${label} nested caller replacement failed: ${boundedActionTopologyDiagnostic(replacement)}`)
  }
  if (replacement.stdout !== "project-finish-producer-action-topology:blocked\n") {
    throw new Error(`${label} nested caller replacement did not block before artifacts`)
  }
  requireNativeAuditZero(`${label} nested caller replacement`, sentinel)
  for (const name of ["receipt.json", "predicate.json", "bundle.json"]) {
    if (
      existsSync(join(outside, name))
      || existsSync(join(replacementRunner, ".project-finish-attestation-artifacts", name))
    ) {
      throw new Error(`${label} nested caller replacement wrote an attestation artifact`)
    }
  }
}

function createProjectFinishProducerActionTopology(packageRoot, runner) {
  const caller = join(runner, ".project-finish-caller")
  const producer = join(runner, ".persona-harness-producer")
  mkdirSync(runner, { recursive: true })
  createProjectFinishProducerFixture(caller, "absent")
  for (const path of ["dist", "native", "scripts", "package.json"]) {
    cpSync(join(packageRoot, path), join(producer, path), { recursive: true })
  }
  initializeFixtureGit(producer, "project finish action producer", {
    email: "ph@example.invalid",
    message: "immutable producer",
    name: "PH Test",
  })
  requireSuccess(
    "project finish action producer origin",
    runCommand(producer, "git", ["remote", "add", "origin", "https://github.com/jyt6640/persona-harness.git"]),
  )
}

function runProjectFinishProducerActionTopology(runner, environment = {}, hookPath) {
  return runNode(dirname(runner), [
    ...(hookPath === undefined ? [] : ["--require", hookPath]),
    "--input-type=module",
    "-e",
    [
      'import { execFileSync } from "node:child_process";',
      'import { existsSync } from "node:fs";',
      'import { createRequire } from "node:module";',
      'import { join } from "node:path";',
      'const runner = process.env.PH_ACTION_RUNNER;',
      'const caller = join(runner, ".project-finish-caller");',
      'const producer = join(runner, ".persona-harness-producer");',
      'const callerSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: caller, encoding: "utf8" }).trim();',
      'const producerSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: producer, encoding: "utf8" }).trim();',
      'const token = `header.${Buffer.from(JSON.stringify({ aud: "persona-harness-project-finish-attestation", event_name: "push", iss: "https://token.actions.githubusercontent.com", job_workflow_ref: `jyt6640/persona-harness/.github/workflows/persona-harness-project-finish.yml@${producerSha}`, job_workflow_sha: producerSha, ref: "refs/heads/main", repository: "example/public-gradle-app", repository_id: "123", repository_visibility: "public", run_attempt: "1", run_id: "42", runner_environment: "github-hosted", workflow_ref: "example/public-gradle-app/.github/workflows/project-finish.yml@refs/heads/main", workflow_sha: callerSha })).toString("base64url")}.signature`;',
      'process.chdir(runner);',
      'const bridge = createRequire(join(runner, "github-script.cjs"))("./.persona-harness-producer/scripts/project-finish-attestation-producer-oidc-capability-bridge.cjs");',
      'const result = await bridge.runProjectFinishAttestationProducerWithCore({ core: { getIDToken: async () => token }, environment: { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "push", GITHUB_REF: "refs/heads/main", GITHUB_REPOSITORY: "example/public-gradle-app", GITHUB_REPOSITORY_ID: "123", GITHUB_RUN_ATTEMPT: "1", GITHUB_RUN_ID: "42", GITHUB_SHA: callerSha, GITHUB_WORKFLOW_REF: "example/public-gradle-app/.github/workflows/project-finish.yml@refs/heads/main", GITHUB_WORKFLOW_SHA: callerSha, GITHUB_WORKSPACE: runner, PERSONA_HARNESS_CALLER_VISIBILITY: "public", PERSONA_HARNESS_PRODUCER_SHA: producerSha, RUNNER_ENVIRONMENT: "github-hosted", RUNNER_OS: "Linux" } });',
      'const output = join(runner, ".project-finish-attestation-artifacts");',
      'const outside = process.env.PH_ACTION_OUTSIDE;',
      'const outcome = result.kind === "blocked" ? result.code : result.kind;',
      'const failed = outside === undefined ? result.kind !== "passed" || !existsSync(join(output, "receipt.json")) || !existsSync(join(output, "predicate.json")) || existsSync(join(caller, ".project-finish-attestation-artifacts")) : result.kind !== "blocked" || existsSync(join(output, "receipt.json")) || existsSync(join(output, "predicate.json")) || existsSync(join(outside, "receipt.json")) || existsSync(join(outside, "predicate.json"));',
      'if (failed) { process.stdout.write(`project-finish-producer-action-topology:${outcome}\\n`); process.exit(1); }',
      'process.stdout.write(`project-finish-producer-action-topology:${outside === undefined ? "passed" : "blocked"}\\n`);',
    ].join("\n"),
  ], { ...environment, PH_ACTION_RUNNER: runner })
}

function assertNativeProducerInputSurface(packageRoot, cwd, label) {
  const verifier = join(repositoryRoot, "scripts", "verify-supported-node-native-inputs.mjs")
  if (!existsSync(verifier)) throw new Error(`${label} native producer input verifier is missing`)
  const result = runNode(cwd, [verifier], { PH_SUPPORT_PACKAGE_ROOT: packageRoot })
  requireSuccess(`${label} native producer input verifier`, result)
  if (!result.stdout.includes('"nativeProjectRead":"PASS"')) {
    throw new Error(`${label} native producer input verifier did not report pass`)
  }
}

function assertProjectFinishProducerIntake(modulePath, fixtureRoot, label, packageVersion) {
  const validProject = join(fixtureRoot, "project-finish-producer-valid")
  const canonicalProfileProject = join(fixtureRoot, "project-finish-producer-canonical-profile")
  const hostileProject = join(fixtureRoot, "project-finish-producer-hostile")
  const replacementProject = join(fixtureRoot, "project-finish-producer-replacement")
  const profileParentReplacementProject = join(fixtureRoot, "project-finish-producer-profile-parent")
  const sourceReplacementProject = join(fixtureRoot, "project-finish-producer-source-replacement")
  const symlinkProject = join(fixtureRoot, "project-finish-producer-symlink")
  const producerBin = join(fixtureRoot, ".persona-harness-producer", "node_modules", ".bin")
  createProjectFinishProducerFixture(validProject, "absent")
  createProjectFinishProducerFixture(canonicalProfileProject, "canonical-profile")
  createProjectFinishProducerFixture(hostileProject, "symlink-profile")
  createProjectFinishProducerFixture(replacementProject, "replace-profile")
  createProjectFinishProducerFixture(profileParentReplacementProject, "replace-profile-parent")
  createProjectFinishProducerFixture(sourceReplacementProject, "absent")
  mkdirSync(producerBin, { recursive: true })
  symlinkSync("../outside", join(producerBin, "node"))
  symlinkSync("project-finish-producer-valid", symlinkProject)

  const probe = runNode(fixtureRoot, [
    "--input-type=module",
    "-e",
    [
      'import { execFileSync } from "node:child_process";',
      `import { runProjectFinishAttestationProducer } from ${JSON.stringify(modulePath)};`,
      'const runAt = (projectDir, runId) => {',
      '  const original = process.cwd();',
      '  process.chdir(projectDir);',
      '  try {',
      '    const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();',
      '    return runProjectFinishAttestationProducer(".", {',
      '    callerWorkflowRef: "example/public-gradle-app/.github/workflows/project-finish.yml@refs/heads/main",',
      '    callerWorkflowSha: head,',
      '    issuedAt: "2026-07-22T01:00:00.000Z",',
      '    repository: { id: 123, slug: "example/public-gradle-app", visibility: "public" },',
      '    reusableWorkflowSha: "b".repeat(40),',
      '    runAttempt: 1,',
      '    runId,',
      '    sourceHead: head,',
      `    }, ${JSON.stringify(packageVersion)});`,
      '  } finally { process.chdir(original); }',
      '};',
      'const valid = runAt("./project-finish-producer-valid", "42");',
      'const canonical = runAt("./project-finish-producer-canonical-profile", "43");',
      'const hostile = runAt("./project-finish-producer-hostile", "44");',
      'const directHead = execFileSync("git", ["rev-parse", "HEAD"], { cwd: "./project-finish-producer-valid", encoding: "utf8" }).trim();',
      `const symlinked = runProjectFinishAttestationProducer("./project-finish-producer-symlink", { callerWorkflowRef: "example/public-gradle-app/.github/workflows/project-finish.yml@refs/heads/main", callerWorkflowSha: directHead, issuedAt: "2026-07-22T01:00:00.000Z", repository: { id: 123, slug: "example/public-gradle-app", visibility: "public" }, reusableWorkflowSha: "b".repeat(40), runAttempt: 1, runId: "45", sourceHead: directHead }, ${JSON.stringify(packageVersion)});`,
      'const resultCode = (result) => result.kind === "passed" ? "passed" : result.kind === "blocked" ? result.code : "invalid";',
      'const resultVector = [valid, canonical, hostile, symlinked].map(resultCode).join(",");',
      'if (valid.kind !== "passed" || canonical.kind !== "passed" || hostile.kind !== "blocked" || symlinked.kind !== "blocked" || symlinked.code !== "workspace-root-unavailable") { process.stdout.write(`project-finish-producer-intake:${resultVector}\\n`); process.exit(1); }',
      'if (valid.value.receipt.source.root !== "." || canonical.value.receipt.source.root !== "." || hostile.value !== undefined) process.exit(1);',
      'if (JSON.stringify(hostile).includes("sk-live-aaaaaaaaaaaaaaaaaaaaaaaa")) process.exit(1);',
    ].join("\n"),
  ])
  if (probe.status !== 0) {
    throw new Error(`installed project finish producer no-follow intake probe failed: ${boundedProducerIntakeDiagnostic(probe.stdout)}`)
  }
  const profileHook = join(fixtureRoot, "project-finish-producer-profile-audit-hook.cjs")
  const profileSentinel = join(fixtureRoot, "project-finish-producer-profile-audit")
  const profileOutside = `${replacementProject}-outside-profile.jsonc`
  writeNativeReadAuditHook(profileHook, "read", "tree", [
    '    require("node:fs").renameSync(process.env.PH_PROFILE_PATH, process.env.PH_PROFILE_DRAFT)',
    '    require("node:fs").renameSync(process.env.PH_PROFILE_OUTSIDE, process.env.PH_PROFILE_PATH)',
  ])
  const replacementProbe = runNode(fixtureRoot, [
    "--require",
    profileHook,
    "--input-type=module",
    "-e",
    [
      'import { execFileSync } from "node:child_process";',
      'import { join, resolve } from "node:path";',
      `const modulePath = ${JSON.stringify(modulePath)};`,
      'const projectDir = resolve("./project-finish-producer-replacement");',
      'const { runProjectFinishAttestationProducer } = await import(modulePath);',
      'const original = process.cwd(); process.chdir(projectDir);',
      'let result;',
      `try { const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(); result = runProjectFinishAttestationProducer(".", { callerWorkflowRef: "example/public-gradle-app/.github/workflows/project-finish.yml@refs/heads/main", callerWorkflowSha: head, issuedAt: "2026-07-22T01:00:00.000Z", repository: { id: 123, slug: "example/public-gradle-app", visibility: "public" }, reusableWorkflowSha: "b".repeat(40), runAttempt: 1, runId: "45", sourceHead: head }, ${JSON.stringify(packageVersion)}); } finally { process.chdir(original); }`,
      'if (result.kind !== "blocked") process.exit(1);',
      'if ("value" in result || JSON.stringify(result).includes("sk-live-aaaaaaaaaaaaaaaaaaaaaaaa")) process.exit(1);',
    ].join("\n"),
  ], {
    ...nativeReadAuditEnvironment(profileOutside, profileSentinel),
    PH_PROFILE_DRAFT: join(replacementProject, ".persona", "project-profile.draft.jsonc"),
    PH_PROFILE_OUTSIDE: profileOutside,
    PH_PROFILE_PATH: join(replacementProject, ".persona", "project-profile.jsonc"),
  })
  requireSuccess("installed project finish producer replacement probe", replacementProbe)
  requireNativeAuditZero(`${label} project finish producer profile replacement`, profileSentinel, "read")
  const profileParentHook = join(fixtureRoot, "project-finish-producer-profile-parent-audit-hook.cjs")
  const profileParentSentinel = join(fixtureRoot, "project-finish-producer-profile-parent-audit")
  const profileParentOutside = `${profileParentReplacementProject}-outside-persona`
  writeNativeReadAuditHook(profileParentHook, "directory", "tree", [
    '    require("node:fs").renameSync(process.env.PH_PROFILE_PARENT, process.env.PH_PROFILE_PARENT_DRAFT)',
    '    require("node:fs").renameSync(process.env.PH_PROFILE_PARENT_OUTSIDE, process.env.PH_PROFILE_PARENT)',
  ])
  const profileParentReplacementProbe = runNode(fixtureRoot, [
    "--require",
    profileParentHook,
    "--input-type=module",
    "-e",
    [
      'import { execFileSync } from "node:child_process";',
      'import { resolve } from "node:path";',
      `const modulePath = ${JSON.stringify(modulePath)};`,
      'const projectDir = resolve("./project-finish-producer-profile-parent");',
      'const { runProjectFinishAttestationProducer } = await import(modulePath);',
      'const original = process.cwd(); process.chdir(projectDir);',
      'let result;',
      `try { const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(); result = runProjectFinishAttestationProducer(".", { callerWorkflowRef: "example/public-gradle-app/.github/workflows/project-finish.yml@refs/heads/main", callerWorkflowSha: head, issuedAt: "2026-07-22T01:00:00.000Z", repository: { id: 123, slug: "example/public-gradle-app", visibility: "public" }, reusableWorkflowSha: "b".repeat(40), runAttempt: 1, runId: "46", sourceHead: head }, ${JSON.stringify(packageVersion)}); } finally { process.chdir(original); }`,
      'if (result.kind !== "blocked") process.exit(1);',
      'if ("value" in result || JSON.stringify(result).includes("sk-live-aaaaaaaaaaaaaaaaaaaaaaaa")) process.exit(1);',
    ].join("\n"),
  ], {
    ...nativeReadAuditEnvironment(profileParentOutside, profileParentSentinel),
    PH_PROFILE_PARENT: join(profileParentReplacementProject, ".persona"),
    PH_PROFILE_PARENT_DRAFT: join(profileParentReplacementProject, ".persona.draft"),
    PH_PROFILE_PARENT_OUTSIDE: profileParentOutside,
  })
  requireSuccess("installed project finish producer profile parent replacement probe", profileParentReplacementProbe)
  requireNativeAuditZero(`${label} project finish producer profile parent replacement`, profileParentSentinel, "directory")
  const sourceHook = join(fixtureRoot, "project-finish-producer-source-audit-hook.cjs")
  const sourceSentinel = join(fixtureRoot, "project-finish-producer-source-audit")
  const sourceOutside = join(fixtureRoot, "project-finish-producer-outside-source")
  mkdirSync(sourceOutside)
  writeFileSync(
    join(sourceOutside, "App.java"),
    'class App { String token = "sk-live-aaaaaaaaaaaaaaaaaaaaaaaa"; }\n',
  )
  writeNativeReadAuditHook(sourceHook, "tree", "tree", [
    '    require("node:fs").renameSync(process.env.PH_SOURCE_DIRECTORY, process.env.PH_SOURCE_DRAFT)',
    '    require("node:fs").renameSync(process.env.PH_SOURCE_OUTSIDE, process.env.PH_SOURCE_DIRECTORY)',
  ])
  const sourceReplacementProbe = runNode(fixtureRoot, [
    "--require",
    sourceHook,
    "--input-type=module",
    "-e",
    [
      'import { execFileSync } from "node:child_process";',
      'import { resolve } from "node:path";',
      `const modulePath = ${JSON.stringify(modulePath)};`,
      'const projectDir = resolve("./project-finish-producer-source-replacement");',
      'const { runProjectFinishAttestationProducer } = await import(modulePath);',
      'const original = process.cwd(); process.chdir(projectDir);',
      'let result;',
      `try { const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(); result = runProjectFinishAttestationProducer(".", { callerWorkflowRef: "example/public-gradle-app/.github/workflows/project-finish.yml@refs/heads/main", callerWorkflowSha: head, issuedAt: "2026-07-22T01:00:00.000Z", repository: { id: 123, slug: "example/public-gradle-app", visibility: "public" }, reusableWorkflowSha: "b".repeat(40), runAttempt: 1, runId: "46", sourceHead: head }, ${JSON.stringify(packageVersion)}); } finally { process.chdir(original); }`,
      'if (result.kind !== "blocked") process.exit(1);',
      'if ("value" in result || JSON.stringify(result).includes("sk-live-aaaaaaaaaaaaaaaaaaaaaaaa")) process.exit(1);',
    ].join("\n"),
  ], {
    ...nativeReadAuditEnvironment(sourceOutside, sourceSentinel),
    PH_SOURCE_DIRECTORY: join(sourceReplacementProject, "src", "main", "java"),
    PH_SOURCE_DRAFT: join(sourceReplacementProject, "src", "main", "java.draft"),
    PH_SOURCE_OUTSIDE: sourceOutside,
  })
  requireSuccess("installed project finish producer source replacement probe", sourceReplacementProbe)
  requireNativeAuditZero(`${label} project finish producer source replacement`, sourceSentinel)
  for (const projectDir of [validProject, canonicalProfileProject, hostileProject, replacementProject, profileParentReplacementProject, sourceReplacementProject, symlinkProject]) {
    if (existsSync(join(projectDir, ".ci", "project-finish-attestation"))) {
      throw new Error("installed project finish producer created an artifact for a local intake probe")
    }
  }
}

function assertSourceCooperativeFinishWorks(sourceCliPath) {
  const phPath = resolve(repositoryRoot, sourceCliPath)
  if (!existsSync(phPath)) {
    throw new Error(`source CLI is missing: ${sourceCliPath}`)
  }
  const readiness = readGaPreAuthorityReadiness(repositoryRoot)
  assertCooperativeFinishWorks(
    join(temporaryRoot, "source-cli-cooperative-gradle-fixture"),
    phPath,
    "source CLI",
    readiness,
    repositoryRoot,
  )
  assertCooperativeSourceReadRaceBlocks(
    join(temporaryRoot, "source-cli-cooperative-gradle-source-read-race"),
    phPath,
    "source CLI",
    readiness,
  )
}

async function assertSourceBoundedReportStdin(sourceCliPath) {
  const phPath = resolve(repositoryRoot, sourceCliPath)
  if (!existsSync(phPath)) {
    throw new Error(`source CLI is missing: ${sourceCliPath}`)
  }
  await assertBoundedReportStdin(
    join(temporaryRoot, "source-cli-bounded-report-stdin"),
    phPath,
    "source CLI",
  )
}

async function assertBoundedReportStdin(fixtureRoot, phPath, label) {
  const workflowDirectory = join(fixtureRoot, ".persona", "workflow")
  const reportPath = join(workflowDirectory, "implementation-report.md")
  const template = "Status: template\n"
  const report = [
    "Status: filled",
    "- README ranges read: all",
    "- Project profile ranges read: all",
    "- `npx ph bearshell ./gradlew test`",
  ].join("\n")
  const writeTemplate = () => {
    mkdirSync(workflowDirectory, { recursive: true })
    writeFileSync(reportPath, template)
  }
  const assertUnchanged = (scenario) => {
    if (readFileSync(reportPath, "utf8") !== template) {
      throw new Error(`${label} ${scenario} unexpectedly wrote the workflow report`)
    }
  }

  writeTemplate()
  const success = runNode(
    fixtureRoot,
    [phPath, "plan", "--report-filled", "implementation", "--stdin"],
    {},
    report,
  )
  requireSuccess(`${label} bounded report stdin success`, success)
  if (!readFileSync(reportPath, "utf8").includes("Status: filled")) {
    throw new Error(`${label} bounded report stdin did not write the valid report`)
  }
  const repeated = runNode(
    fixtureRoot,
    [phPath, "plan", "--report-filled", "implementation", "--stdin"],
    {},
    report,
  )
  if (repeated.status === 0 || !repeated.stderr.includes("after it has left template status")) {
    throw new Error(`${label} repeated bounded report stdin did not fail closed`)
  }

  writeTemplate()
  const malformed = runNode(
    fixtureRoot,
    [phPath, "plan", "--report-filled", "implementation", "--stdin"],
    {},
    report.replace("Status: filled", "Status: template"),
  )
  if (malformed.status === 0 || !malformed.stderr.includes("must declare exactly one filled Status value")) {
    throw new Error(`${label} malformed bounded report stdin did not fail closed`)
  }
  assertUnchanged("malformed stdin")

  writeTemplate()
  const control = runNode(
    fixtureRoot,
    [phPath, "plan", "--report-filled", "implementation", "--stdin"],
    {},
    `${report}\u0000`,
  )
  if (control.status === 0 || !control.stderr.includes("contains unsupported control characters")) {
    throw new Error(`${label} control-character report stdin did not fail closed`)
  }
  assertUnchanged("control-character stdin")

  writeTemplate()
  const oversized = runNode(
    fixtureRoot,
    [phPath, "plan", "--report-filled", "implementation", "--stdin"],
    {},
    `${report}\n${"x".repeat(64 * 1024)}`,
  )
  if (oversized.status === 0 || !oversized.stderr.includes("exceeds the 65536-byte limit")) {
    throw new Error(`${label} finite oversized report stdin did not fail closed`)
  }
  assertUnchanged("finite oversized stdin")

  writeTemplate()
  const continuous = await runContinuousReportPipe(fixtureRoot, phPath)
  if (
    continuous.status === 0
    || continuous.timedOut
    || !continuous.stderr.includes("exceeds the 65536-byte limit")
    || continuous.stdout.includes("stdin-boundary-marker")
    || continuous.stderr.includes("stdin-boundary-marker")
  ) {
    throw new Error(`${label} continuous oversized report stdin did not fail closed promptly`)
  }
  assertUnchanged("continuous oversized stdin")
}

function runContinuousReportPipe(cwd, phPath) {
  const marker = "stdin-boundary-marker"
  const producerScript = [
    `const chunk = Buffer.from(${JSON.stringify(`${marker}\n`.repeat(512))});`,
    "function write() {",
    "  if (process.stdout.write(chunk)) { setImmediate(write); return; }",
    "  process.stdout.once('drain', write);",
    "}",
    "write();",
  ].join("\n")
  const startedAt = Date.now()
  const cli = spawn(process.execPath, [phPath, "plan", "--report-filled", "implementation", "--stdin"], {
    cwd,
    env: process.env,
    stdio: ["pipe", "pipe", "pipe"],
  })
  const producer = spawn(process.execPath, ["-e", producerScript], {
    cwd,
    stdio: ["ignore", "pipe", "ignore"],
  })
  cli.stdin.on("error", () => {})
  producer.stdout.on("error", () => {})

  let stdout = ""
  let stderr = ""
  cli.stdout.on("data", (chunk) => {
    if (stdout.length < 4096) {
      stdout += chunk.toString("utf8").slice(0, 4096 - stdout.length)
    }
  })
  cli.stderr.on("data", (chunk) => {
    if (stderr.length < 4096) {
      stderr += chunk.toString("utf8").slice(0, 4096 - stderr.length)
    }
  })

  return new Promise((resolve) => {
    let settled = false
    const settle = (result) => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timeout)
      producer.kill("SIGKILL")
      if (!cli.killed) {
        cli.kill("SIGKILL")
      }
      resolve({ ...result, stderr, stdout })
    }
    const timeout = setTimeout(() => {
      settle({ elapsedMs: Date.now() - startedAt, status: null, timedOut: true })
    }, 3000)
    cli.once("close", (status) => {
      settle({ elapsedMs: Date.now() - startedAt, status, timedOut: false })
    })
    producer.stdout.once("data", (chunk) => {
      if (!cli.stdin.destroyed) {
        cli.stdin.write(chunk)
        producer.stdout.pipe(cli.stdin)
      }
    })
  })
}

function assertSourceDoctorRegistryReadback(sourceCliPath) {
  const phPath = resolve(repositoryRoot, sourceCliPath)
  if (!existsSync(phPath)) {
    throw new Error(`source CLI is missing: ${sourceCliPath}`)
  }
  assertDoctorRegistryReadback(
    join(temporaryRoot, "source-cli-doctor-registry-fixture"),
    phPath,
    repositoryRoot,
    "source CLI",
  )
}

function assertDoctorRegistryReadback(fixtureRoot, phPath, packageRoot, label) {
  const installedVersion = readPackageVersion(packageRoot)
  mkdirSync(join(fixtureRoot, ".opencode"), { recursive: true })
  mkdirSync(join(fixtureRoot, ".persona"), { recursive: true })
  writeFileSync(
    join(fixtureRoot, "AGENTS.md"),
    [
      "<!-- persona-harness:agents:start schema=persona-harness.agents.v1 -->",
      "# Persona Harness Agent Instructions",
      "",
      "- Run `npx ph workflow implement` before implementation.",
      "- Run `npx ph workflow finish implement` before claiming completion.",
      "<!-- persona-harness:agents:end -->",
      "",
    ].join("\n"),
  )
  writeFileSync(
    join(fixtureRoot, ".opencode", "opencode.json"),
    `${JSON.stringify({ plugin: ["persona-harness"] }, null, 2)}\n`,
  )
  writeFileSync(
    join(fixtureRoot, ".persona", "harness.jsonc"),
    `${JSON.stringify({ enforce: { executeVerification: false } }, null, 2)}\n`,
  )

  const result = runNode(
    fixtureRoot,
    [phPath, "doctor", "--json"],
    {
      PH_DOCTOR_OPENCODE_VERSION: "1.0.0-installed-test",
      PH_DOCTOR_REGISTRY_DEPRECATED: JSON.stringify("deprecated test-only marker"),
      PH_DOCTOR_REGISTRY_DIST_TAGS: JSON.stringify({
        latest: installedVersion,
        next: "0.7.0-rc.3",
        staging: "0.7.0-rc.8",
      }),
    },
  )
  requireSuccess(`${label} doctor registry readback`, result)
  const payload = JSON.parse(result.stdout)
  if (
    !isRecord(payload)
    || !isRecord(payload.registry)
    || !isRecord(payload.authority)
    || !isRecord(payload.sigstore)
  ) {
    throw new Error(`${label} doctor registry readback did not return a bounded JSON object`)
  }
  const channels = payload.registry.channels
  if (
    !isRecord(channels)
    || channels["installed"] !== installedVersion
    || channels["latest"] !== installedVersion
    || channels["next"] !== "0.7.0-rc.3"
    || channels["staging"] !== "0.7.0-rc.8"
    || channels["legacy"] !== "retired"
    || payload.registry.deprecation !== "present"
    || payload.authority.finish !== "blocked"
    || !["blocked", "ready", "unverified"].includes(payload.sigstore.networkReadiness)
    || !["blocked", "ready"].includes(payload.sigstore.trustRootReadiness)
    || typeof payload.sigstore.state !== "string"
  ) {
    throw new Error(`${label} doctor registry readback violated the non-authoritative channel contract`)
  }
  if (
    result.stdout.includes("deprecated test-only marker")
    || result.stdout.includes(repositoryRoot)
    || result.stdout.includes(fixtureRoot)
  ) {
    throw new Error(`${label} doctor registry readback reflected an unsafe local fact`)
  }
}

function readPackageVersion(packageRoot) {
  const parsed = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"))
  if (!isRecord(parsed) || typeof parsed.version !== "string" || parsed.version.length === 0) {
    throw new Error("doctor registry package version is unavailable")
  }
  return parsed.version
}

function assertSourceWorkflowLifecycleAbsenceBlocks(sourceCliPath) {
  const phPath = resolve(repositoryRoot, sourceCliPath)
  if (!existsSync(phPath)) {
    throw new Error(`source CLI is missing: ${sourceCliPath}`)
  }
  assertWorkflowLifecycleAbsenceBlocks(
    join(temporaryRoot, "source-cli-workflow-lifecycle-absence-fixture"),
    phPath,
    "source CLI",
  )
}

function assertSourceBootstrapWorkspaceIntake(sourceCliPath) {
  const phPath = resolve(repositoryRoot, sourceCliPath)
  if (!existsSync(phPath)) {
    throw new Error(`source CLI is missing: ${sourceCliPath}`)
  }
  assertBootstrapWorkspaceIntake(
    join(temporaryRoot, "source-cli-workflow-lifecycle-state-intake-fixture"),
    phPath,
    "source CLI",
  )
}

function assertSourceEvidenceReadWriteBoundary(sourceCliPath) {
  const phPath = resolve(repositoryRoot, sourceCliPath)
  if (!existsSync(phPath)) {
    throw new Error(`source CLI is missing: ${sourceCliPath}`)
  }
  assertEvidenceReadWriteBoundary(
    join(temporaryRoot, "source-cli-evidence-read-write-boundary"),
    phPath,
    "source CLI",
  )
}

function assertBootstrapWorkspaceIntake(fixtureRoot, phPath, label) {
  assertProjectRootRaceBlocks(join(fixtureRoot, "project-root-race"), phPath, label)
  assertCapturedProjectAgentStageRaceBlocks(join(fixtureRoot, "agent-stage-race"), phPath, label)
  assertProjectRootAliasesBlock(join(fixtureRoot, "project-root-alias"), phPath, label)
  assertFreshPersonaParentRaceBlocks(join(fixtureRoot, "fresh-persona-race"), phPath, label)
  assertLifecycleStateParentAliasBlocks(join(fixtureRoot, "parent-alias"), phPath, label)
  assertLifecycleStateLeafAliasesBlock(join(fixtureRoot, "leaf-alias"), phPath, label)
  assertLifecycleStateParentRaceBlocks(join(fixtureRoot, "parent-race"), phPath, label)
  assertLifecycleStateLeafRacesBlock(join(fixtureRoot, "leaf-race"), phPath, label)
}

function assertEvidenceReadWriteBoundary(fixtureRoot, phPath, label) {
  assertEvidenceReadParentAliasBlocks(join(fixtureRoot, "parent-alias"), phPath, label)
  assertEvidenceReadParentRaceBlocks(join(fixtureRoot, "parent-race"), phPath, label)
  assertEvidenceReadSourceParentAliasBlocks(join(fixtureRoot, "source-parent-alias"), phPath, label)
  assertEvidenceReadSourceParentRaceBlocks(join(fixtureRoot, "source-parent-race"), phPath, label)
  assertEvidenceReadSourceLeafAliasBlocks(join(fixtureRoot, "source-leaf-alias"), phPath, label)
  assertEvidenceReadSourceLeafRaceBlocks(join(fixtureRoot, "source-leaf-race"), phPath, label)
  assertEvidenceReadProjectRootRaceBlocks(join(fixtureRoot, "source-root-race"), phPath, label)
}

function assertEvidenceReadSourceParentAliasBlocks(projectDir, phPath, label) {
  createLifecycleStateIntakeFixture(projectDir)
  requireSuccess(`${label} evidence read source parent alias bootstrap`, runNode(projectDir, [phPath, "bootstrap", "backend", "--strict", "--no-developer-mcp"]))
  const sourceParent = join(projectDir, "src", "main", "java")
  const outside = `${projectDir}-outside-source`
  const hookPath = join(projectDir, "evidence-read-source-parent-alias-hook.cjs")
  const auditSentinel = `${projectDir}-source-parent-alias-audit`
  rmSync(sourceParent, { force: true, recursive: true })
  mkdirSync(outside)
  writeFileSync(join(outside, "App.java"), "class ExternalApp {}\n")
  symlinkSync(outside, sourceParent)
  writeNativeReadAuditHook(hookPath, "tree")

  const result = runNode(
    projectDir,
    ["--require", hookPath, phPath, "evidence", "read", "src/main/java/App.java"],
    nativeReadAuditEnvironment(outside, auditSentinel),
  )

  requireEvidenceReadBlock(`${label} evidence read source parent alias`, result, outside)
  requireNativeAuditZero(`${label} evidence read source parent alias`, auditSentinel)
  if (!lstatSync(sourceParent).isSymbolicLink()) {
    throw new Error(`${label} evidence read source parent alias lost its containment probe`)
  }
}

function assertEvidenceReadSourceParentRaceBlocks(projectDir, phPath, label) {
  createLifecycleStateIntakeFixture(projectDir)
  requireSuccess(`${label} evidence read source race bootstrap`, runNode(projectDir, [phPath, "bootstrap", "backend", "--strict", "--no-developer-mcp"]))
  const sourceParent = join(projectDir, "src", "main", "java")
  const preserved = join(projectDir, "src", "main", "java-preserved")
  const outside = `${projectDir}-outside-source`
  const hookPath = join(projectDir, "evidence-read-source-race-hook.cjs")
  const auditSentinel = `${projectDir}-source-parent-race-audit`
  mkdirSync(outside)
  writeFileSync(join(outside, "App.java"), "class ExternalApp {}\n")
  writeNativeReadAuditHook(hookPath, "read", "tree", [
    '    require("node:fs").renameSync(process.env.PH_SOURCE_PARENT, process.env.PH_SOURCE_PRESERVED)',
    '    require("node:fs").renameSync(process.env.PH_SOURCE_OUTSIDE, process.env.PH_SOURCE_PARENT)',
  ])
  const result = runNode(projectDir, ["--require", hookPath, phPath, "evidence", "read", "src/main/java/App.java"], {
    ...nativeReadAuditEnvironment(outside, auditSentinel),
    PH_SOURCE_OUTSIDE: outside,
    PH_SOURCE_PARENT: sourceParent,
    PH_SOURCE_PRESERVED: preserved,
  })
  requireEvidenceReadBlock(`${label} evidence read source parent race`, result, outside)
  requireNativeAuditZero(`${label} evidence read source parent race`, auditSentinel)
  if (!existsSync(preserved) || !lstatSync(sourceParent).isDirectory() || !readFileSync(join(sourceParent, "App.java"), "utf8").includes("ExternalApp")) {
    throw new Error(`${label} evidence read source parent race opened external bytes`)
  }
}

function assertEvidenceReadSourceLeafAliasBlocks(projectDir, phPath, label) {
  createLifecycleStateIntakeFixture(projectDir)
  requireSuccess(`${label} evidence read source leaf alias bootstrap`, runNode(projectDir, [phPath, "bootstrap", "backend", "--strict", "--no-developer-mcp"]))
  const source = join(projectDir, "src", "main", "java", "App.java")
  const outside = `${projectDir}-outside-source.java`
  const hookPath = join(projectDir, "evidence-read-source-leaf-alias-hook.cjs")
  const auditSentinel = `${projectDir}-source-leaf-alias-audit`
  writeFileSync(outside, "class ExternalApp {}\n")
  rmSync(source)
  symlinkSync(outside, source)
  writeNativeReadAuditHook(hookPath, "tree")

  const result = runNode(
    projectDir,
    ["--require", hookPath, phPath, "evidence", "read", "src/main/java/App.java"],
    nativeReadAuditEnvironment(outside, auditSentinel),
  )

  requireEvidenceReadBlock(`${label} evidence read source leaf alias`, result, outside)
  requireNativeAuditZero(`${label} evidence read source leaf alias`, auditSentinel)
  if (!lstatSync(source).isSymbolicLink()) {
    throw new Error(`${label} evidence read source leaf alias lost its containment probe`)
  }
}

function assertEvidenceReadSourceLeafRaceBlocks(projectDir, phPath, label) {
  createLifecycleStateIntakeFixture(projectDir)
  requireSuccess(`${label} evidence read source leaf race bootstrap`, runNode(projectDir, [phPath, "bootstrap", "backend", "--strict", "--no-developer-mcp"]))
  const source = join(projectDir, "src", "main", "java", "App.java")
  const preserved = join(projectDir, "src", "main", "java", "App.draft.java")
  const outside = `${projectDir}-outside-source.java`
  const hookPath = join(projectDir, "evidence-read-source-leaf-race-hook.cjs")
  const auditSentinel = `${projectDir}-source-leaf-race-audit`
  writeFileSync(outside, "class ExternalApp {}\n")
  writeNativeReadAuditHook(hookPath, "read", "tree", [
    '    require("node:fs").renameSync(process.env.PH_SOURCE_FILE, process.env.PH_SOURCE_PRESERVED)',
    '    require("node:fs").renameSync(process.env.PH_SOURCE_OUTSIDE, process.env.PH_SOURCE_FILE)',
  ])
  const result = runNode(projectDir, ["--require", hookPath, phPath, "evidence", "read", "src/main/java/App.java"], {
    ...nativeReadAuditEnvironment(outside, auditSentinel),
    PH_SOURCE_FILE: source,
    PH_SOURCE_OUTSIDE: outside,
    PH_SOURCE_PRESERVED: preserved,
  })
  requireEvidenceReadBlock(`${label} evidence read source leaf race`, result, outside)
  requireNativeAuditZero(`${label} evidence read source leaf race`, auditSentinel)
  if (!existsSync(preserved) || !lstatSync(source).isFile() || !readFileSync(source, "utf8").includes("ExternalApp")) {
    throw new Error(`${label} evidence read source leaf race opened external bytes`)
  }
}

function assertEvidenceReadProjectRootRaceBlocks(projectDir, phPath, label) {
  createLifecycleStateIntakeFixture(projectDir)
  requireSuccess(`${label} evidence read root race bootstrap`, runNode(projectDir, [phPath, "bootstrap", "backend", "--strict", "--no-developer-mcp"]))
  const preserved = `${projectDir}-preserved`
  const outside = `${projectDir}-outside`
  const hookPath = join(projectDir, "evidence-read-project-root-race-hook.cjs")
  const auditSentinel = `${projectDir}-source-root-race-audit`
  mkdirSync(outside)
  mkdirSync(join(outside, "src", "main", "java"), { recursive: true })
  writeFileSync(join(outside, "src", "main", "java", "App.java"), "class ExternalApp {}\n")
  writeNativeReadAuditHook(hookPath, "read", "tree", [
    '    require("node:fs").renameSync(process.env.PH_SOURCE_PROJECT, process.env.PH_SOURCE_PRESERVED)',
    '    require("node:fs").renameSync(process.env.PH_SOURCE_OUTSIDE, process.env.PH_SOURCE_PROJECT)',
  ], true)
  const result = runNode(projectDir, ["--require", hookPath, phPath, "evidence", "read", "src/main/java/App.java"], {
    ...nativeReadAuditEnvironment(outside, auditSentinel),
    PH_SOURCE_OUTSIDE: outside,
    PH_SOURCE_PRESERVED: preserved,
    PH_SOURCE_PROJECT: projectDir,
  })
  requireEvidenceReadBlock(`${label} evidence read root race`, result, outside)
  requireNativeAuditZero(`${label} evidence read root race`, auditSentinel)
  if (!existsSync(preserved) || !lstatSync(projectDir).isDirectory() || !readFileSync(join(projectDir, "src", "main", "java", "App.java"), "utf8").includes("ExternalApp")) {
    throw new Error(`${label} evidence read root race opened external bytes`)
  }
}

function assertEvidenceReadParentAliasBlocks(projectDir, phPath, label) {
  createLifecycleStateIntakeFixture(projectDir)
  requireSuccess(`${label} evidence read alias bootstrap`, runNode(projectDir, [phPath, "bootstrap", "backend", "--strict", "--no-developer-mcp"]))
  const evidenceRoot = join(projectDir, ".persona", "evidence")
  const outside = join(projectDir, "outside-evidence")
  rmSync(evidenceRoot, { force: true, recursive: true })
  mkdirSync(join(outside, "phase0"), { recursive: true })
  symlinkSync(outside, evidenceRoot)

  const result = runNode(projectDir, [phPath, "evidence", "read", "README.md"])

  requireEvidenceReadBlock(`${label} evidence read parent alias`, result, outside)
  if (!lstatSync(evidenceRoot).isSymbolicLink() || readdirSync(join(outside, "phase0")).length !== 0) {
    throw new Error(`${label} evidence read parent alias wrote outside its canonical root`)
  }
}

function assertEvidenceReadParentRaceBlocks(projectDir, phPath, label) {
  createLifecycleStateIntakeFixture(projectDir)
  requireSuccess(`${label} evidence read race bootstrap`, runNode(projectDir, [phPath, "bootstrap", "backend", "--strict", "--no-developer-mcp"]))
  const evidenceRoot = join(projectDir, ".persona", "evidence")
  const preserved = join(projectDir, ".persona", "evidence-preserved")
  const outside = join(projectDir, "outside-evidence")
  const hookPath = join(projectDir, "evidence-read-race-hook.cjs")
  mkdirSync(join(evidenceRoot, "phase0"), { recursive: true })
  mkdirSync(join(outside, "phase0"), { recursive: true })
  writeFileSync(
    hookPath,
    [
      'const fs = require("node:fs")',
      'const { basename } = require("node:path")',
      'const { syncBuiltinESMExports } = require("node:module")',
      'const originalOpen = fs.openSync',
      'const originalWrite = fs.writeFileSync',
      'let swapped = false',
      'const swap = () => {',
      '  if (swapped) return',
      '  swapped = true',
      '  fs.renameSync(process.env.PH_EVIDENCE_ROOT, process.env.PH_EVIDENCE_PRESERVED)',
      '  fs.symlinkSync(process.env.PH_EVIDENCE_OUTSIDE, process.env.PH_EVIDENCE_ROOT)',
      '}',
      'fs.openSync = (...args) => {',
      '  if (typeof args[0] === "string" && basename(args[0]).startsWith(".workflow-read-")) swap()',
      '  return originalOpen(...args)',
      '}',
      'fs.writeFileSync = (...args) => {',
      '  if (typeof args[0] === "string" && basename(args[0]).startsWith(".workflow-read-")) swap()',
      '  return originalWrite(...args)',
      '}',
      'syncBuiltinESMExports()',
      '',
    ].join("\n"),
  )

  const result = runNode(
    projectDir,
    ["--require", hookPath, phPath, "evidence", "read", "README.md"],
    {
      PH_EVIDENCE_OUTSIDE: outside,
      PH_EVIDENCE_PRESERVED: preserved,
      PH_EVIDENCE_ROOT: evidenceRoot,
    },
  )

  requireEvidenceReadBlock(`${label} evidence read parent race`, result, outside)
  if (!lstatSync(evidenceRoot).isSymbolicLink() || readdirSync(join(outside, "phase0")).length !== 0) {
    throw new Error(`${label} evidence read parent race wrote outside its canonical root`)
  }
}

function assertCapturedProjectAgentStageRaceBlocks(projectDir, phPath, label) {
  createLifecycleStateIntakeFixture(projectDir)
  const canonicalProjectDir = realpathSync(projectDir)
  const preserved = join(dirname(projectDir), `${basename(projectDir)}-preserved`)
  const outside = join(dirname(projectDir), `${basename(projectDir)}-outside`)
  const hookPath = join(projectDir, "agent-stage-race-hook.cjs")
  mkdirSync(outside)
  writeFileSync(
    hookPath,
    [
      'const fs = require("node:fs")',
      'const { basename } = require("node:path")',
      'const { syncBuiltinESMExports } = require("node:module")',
      'const originalOpen = fs.openSync',
      'const originalWrite = fs.writeFileSync',
      'let swapped = false',
      'const swap = () => {',
      '  if (swapped) return',
      '  swapped = true',
      '  fs.renameSync(process.env.PH_BOOTSTRAP_AGENT_PROJECT, process.env.PH_BOOTSTRAP_AGENT_PRESERVED)',
      '  fs.symlinkSync(process.env.PH_BOOTSTRAP_AGENT_OUTSIDE, process.env.PH_BOOTSTRAP_AGENT_PROJECT)',
      '}',
      'fs.openSync = (...args) => {',
      '  if (typeof args[0] === "string" && basename(args[0]).startsWith(".AGENTS.md.")) swap()',
      '  return originalOpen(...args)',
      '}',
      'fs.writeFileSync = (...args) => {',
      '  if (typeof args[0] === "string" && basename(args[0]).startsWith(".AGENTS.md.")) swap()',
      '  return originalWrite(...args)',
      '}',
      'syncBuiltinESMExports()',
      '',
    ].join("\n"),
  )
  const rerun = runNode(
    projectDir,
    ["--require", hookPath, phPath, "bootstrap", "backend", "--strict", "--no-developer-mcp"],
    {
      PH_BOOTSTRAP_AGENT_OUTSIDE: outside,
      PH_BOOTSTRAP_AGENT_PRESERVED: preserved,
      PH_BOOTSTRAP_AGENT_PROJECT: canonicalProjectDir,
    },
  )

  requireLifecycleStateBlock(`${label} AGENTS staging race`, rerun, outside)
  if (!lstatSync(projectDir).isSymbolicLink() || readdirSync(outside).length !== 0) {
    throw new Error(`${label} AGENTS staging race wrote outside its canonical root`)
  }
}

function assertProjectRootAliasesBlock(projectDir, phPath, label) {
  for (const relativePath of [".gitignore", ".opencode/opencode.json"]) {
    const caseRoot = join(projectDir, relativePath.replaceAll("/", "-"))
    createLifecycleStateIntakeFixture(caseRoot)
    const target = join(caseRoot, relativePath)
    const outside = join(caseRoot, `outside-${relativePath.replaceAll("/", "-")}`)
    mkdirSync(dirname(target), { recursive: true })
    symlinkSync(outside, target)

    const rerun = runNode(caseRoot, [phPath, "bootstrap", "backend", "--strict", "--no-developer-mcp"])

    requireLifecycleStateBlock(`${label} root ${relativePath} alias`, rerun, outside)
    if (existsSync(outside) || !lstatSync(target).isSymbolicLink()) {
      throw new Error(`${label} root ${relativePath} alias was replaced or wrote outside`)
    }
  }

  const parentRoot = join(projectDir, "opencode-parent")
  createLifecycleStateIntakeFixture(parentRoot)
  const parent = join(parentRoot, ".opencode")
  const outside = join(parentRoot, "outside-opencode-parent")
  mkdirSync(outside)
  symlinkSync(outside, parent)

  const rerun = runNode(parentRoot, [phPath, "bootstrap", "backend", "--strict", "--no-developer-mcp"])

  requireLifecycleStateBlock(`${label} root .opencode parent alias`, rerun, outside)
  if (readdirSync(outside).length !== 0 || !lstatSync(parent).isSymbolicLink()) {
    throw new Error(`${label} root .opencode parent alias wrote outside`)
  }
}

function assertProjectRootRaceBlocks(projectDir, phPath, label) {
  createLifecycleStateIntakeFixture(projectDir)
  const canonicalProjectDir = realpathSync(projectDir)
  const preserved = join(dirname(projectDir), `${basename(projectDir)}-preserved`)
  const outside = join(dirname(projectDir), `${basename(projectDir)}-outside`)
  const hookPath = join(projectDir, "project-root-race-hook.cjs")
  mkdirSync(outside)
  writeFileSync(
    hookPath,
    [
      'const fs = require("node:fs")',
      'const { syncBuiltinESMExports } = require("node:module")',
      'const originalOpen = fs.openSync',
      'let swapped = false',
      'fs.openSync = (...args) => {',
      '  if (!swapped && args[0] === ".gitignore") {',
      '    swapped = true',
      '    fs.renameSync(process.env.PH_BOOTSTRAP_ROOT_PROJECT, process.env.PH_BOOTSTRAP_ROOT_PRESERVED)',
      '    fs.symlinkSync(process.env.PH_BOOTSTRAP_ROOT_OUTSIDE, process.env.PH_BOOTSTRAP_ROOT_PROJECT)',
      '  }',
      '  return originalOpen(...args)',
      '}',
      'syncBuiltinESMExports()',
      '',
    ].join("\n"),
  )
  const rerun = runNode(
    projectDir,
    ["--require", hookPath, phPath, "bootstrap", "backend", "--strict", "--no-developer-mcp"],
    {
      PH_BOOTSTRAP_ROOT_OUTSIDE: outside,
      PH_BOOTSTRAP_ROOT_PRESERVED: preserved,
      PH_BOOTSTRAP_ROOT_PROJECT: canonicalProjectDir,
    },
  )

  requireLifecycleStateBlock(`${label} project root race`, rerun, outside)
  if (!lstatSync(projectDir).isSymbolicLink() || readdirSync(outside).length !== 0) {
    throw new Error(`${label} project root race wrote outside its canonical root`)
  }
}

function assertFreshPersonaParentRaceBlocks(projectDir, phPath, label) {
  createLifecycleStateIntakeFixture(projectDir)
  const personaDir = join(projectDir, ".persona")
  const preserved = join(projectDir, ".persona-preserved")
  const outside = join(projectDir, "outside-fresh-persona")
  const hookPath = join(projectDir, "fresh-persona-race-hook.cjs")
  mkdirSync(outside)
  writeFileSync(
    hookPath,
    [
      'const fs = require("node:fs")',
      'const { syncBuiltinESMExports } = require("node:module")',
      'const originalRename = fs.renameSync',
      'let swapped = false',
      'fs.renameSync = (...args) => {',
      '  const result = originalRename(...args)',
      '  if (!swapped && args[1] === ".persona") {',
      '    swapped = true',
      '    originalRename(process.env.PH_BOOTSTRAP_FRESH_PERSONA_TEXT, process.env.PH_BOOTSTRAP_FRESH_PRESERVED)',
      '    fs.symlinkSync(process.env.PH_BOOTSTRAP_FRESH_OUTSIDE, process.env.PH_BOOTSTRAP_FRESH_PERSONA_TEXT)',
      '  }',
      '  return result',
      '}',
      'syncBuiltinESMExports()',
      '',
    ].join("\n"),
  )
  const rerun = runNode(
    projectDir,
    ["--require", hookPath, phPath, "bootstrap", "backend", "--strict", "--no-developer-mcp"],
    {
      PH_BOOTSTRAP_FRESH_OUTSIDE: outside,
      PH_BOOTSTRAP_FRESH_PERSONA_TEXT: personaDir,
      PH_BOOTSTRAP_FRESH_PRESERVED: preserved,
    },
  )

  requireLifecycleStateBlock(`${label} fresh persona parent race`, rerun, outside)
  if (!lstatSync(personaDir).isSymbolicLink() || readdirSync(outside).length !== 0) {
    throw new Error(`${label} fresh Persona parent race wrote outside its canonical root`)
  }
}

function assertLifecycleStateParentAliasBlocks(projectDir, phPath, label) {
  createLifecycleStateIntakeFixture(projectDir)
  requireSuccess(`${label} lifecycle state parent bootstrap`, runNode(projectDir, [phPath, "bootstrap", "backend", "--strict", "--no-developer-mcp"]))
  const workflowDir = join(projectDir, ".persona", "workflow")
  const preserved = join(projectDir, ".persona", "workflow-preserved")
  const outside = join(projectDir, "outside-workflow")
  mkdirSync(outside)
  renameSync(workflowDir, preserved)
  symlinkSync(outside, workflowDir)

  const rerun = runNode(projectDir, [phPath, "bootstrap", "backend", "--strict", "--no-developer-mcp"])

  requireLifecycleStateBlock(`${label} lifecycle state parent alias`, rerun, outside)
  if (workflowBootstrapFiles(outside).length !== 0 || !existsSync(join(preserved, "workflow-loop-state.json")) || !existsSync(join(preserved, "ralph-loop-state.json"))) {
    throw new Error(`${label} bootstrap workspace parent alias wrote outside its canonical root`)
  }
}

function assertLifecycleStateLeafAliasesBlock(projectDir, phPath, label) {
  for (const stateName of lifecycleStateFileNames()) {
    const caseRoot = join(projectDir, stateName)
    createLifecycleStateIntakeFixture(caseRoot)
    requireSuccess(`${label} lifecycle state ${stateName} bootstrap`, runNode(caseRoot, [phPath, "bootstrap", "backend", "--strict"]))
    const statePath = join(caseRoot, ".persona", "workflow", stateName)
    const outside = join(caseRoot, `outside-${stateName}`)
    unlinkSync(statePath)
    symlinkSync(outside, statePath)

    const rerun = runNode(caseRoot, [phPath, "bootstrap", "backend", "--strict"])

    requireLifecycleStateBlock(`${label} lifecycle state ${stateName} alias`, rerun, outside)
    if (existsSync(outside) || !lstatSync(statePath).isSymbolicLink()) {
      throw new Error(`${label} lifecycle state ${stateName} alias was replaced or wrote outside`)
    }
  }
}

function assertLifecycleStateParentRaceBlocks(projectDir, phPath, label) {
  createLifecycleStateIntakeFixture(projectDir)
  requireSuccess(`${label} lifecycle state race bootstrap`, runNode(projectDir, [phPath, "bootstrap", "backend", "--strict", "--no-developer-mcp"]))
  const workflowDir = join(projectDir, ".persona", "workflow")
  const preserved = join(projectDir, ".persona", "workflow-preserved")
  const outside = join(projectDir, "outside-workflow")
  const hookPath = join(projectDir, "workflow-state-race-hook.cjs")
  const canonicalWorkflowDir = realpathSync(workflowDir)
  mkdirSync(outside)
  writeFileSync(
    hookPath,
    [
      'const fs = require("node:fs")',
      'const { syncBuiltinESMExports } = require("node:module")',
      'const originalOpen = fs.openSync',
      'let swapped = false',
      'fs.openSync = (...args) => {',
      '  if (!swapped && args[0] === process.env.PH_LIFECYCLE_RACE_WORKFLOW) {',
      '    swapped = true',
      '    fs.renameSync(process.env.PH_LIFECYCLE_RACE_WORKFLOW_TEXT, process.env.PH_LIFECYCLE_RACE_PRESERVED)',
      '    fs.symlinkSync(process.env.PH_LIFECYCLE_RACE_OUTSIDE, process.env.PH_LIFECYCLE_RACE_WORKFLOW_TEXT)',
      '  }',
      '  return originalOpen(...args)',
      '}',
      'syncBuiltinESMExports()',
      '',
    ].join("\n"),
  )
  const rerun = runNode(
    projectDir,
    ["--require", hookPath, phPath, "bootstrap", "backend", "--strict", "--no-developer-mcp"],
    {
      PH_LIFECYCLE_RACE_OUTSIDE: outside,
      PH_LIFECYCLE_RACE_PRESERVED: preserved,
      PH_LIFECYCLE_RACE_WORKFLOW: canonicalWorkflowDir,
      PH_LIFECYCLE_RACE_WORKFLOW_TEXT: workflowDir,
    },
  )

  requireLifecycleStateBlock(`${label} lifecycle state parent race`, rerun, outside)
  if (!lstatSync(workflowDir).isSymbolicLink() || workflowBootstrapFiles(outside).length !== 0) {
    throw new Error(`${label} bootstrap workspace parent race did not preserve canonical containment`)
  }
}

function assertLifecycleStateLeafRacesBlock(projectDir, phPath, label) {
  for (const stateName of lifecycleStateFileNames()) {
    const caseRoot = join(projectDir, stateName)
    createLifecycleStateIntakeFixture(caseRoot)
    requireSuccess(`${label} lifecycle state ${stateName} race bootstrap`, runNode(caseRoot, [phPath, "bootstrap", "backend", "--strict"]))
    const workflowDir = join(caseRoot, ".persona", "workflow")
    const statePath = join(realpathSync(workflowDir), stateName)
    const outside = join(caseRoot, `outside-race-${stateName}`)
    const hookPath = join(caseRoot, `workflow-state-${stateName}-race-hook.cjs`)
    writeFileSync(
      hookPath,
      [
        'const fs = require("node:fs")',
        'const { syncBuiltinESMExports } = require("node:module")',
        'const originalOpen = fs.openSync',
        'let swapped = false',
        'fs.openSync = (...args) => {',
        '  if (!swapped && args[0] === process.env.PH_LIFECYCLE_RACE_STATE) {',
        '    swapped = true',
        '    fs.unlinkSync(process.env.PH_LIFECYCLE_RACE_STATE)',
        '    fs.symlinkSync(process.env.PH_LIFECYCLE_RACE_OUTSIDE, process.env.PH_LIFECYCLE_RACE_STATE)',
        '  }',
        '  return originalOpen(...args)',
        '}',
        'syncBuiltinESMExports()',
        '',
      ].join("\n"),
    )
    const rerun = runNode(
      caseRoot,
      ["--require", hookPath, phPath, "bootstrap", "backend", "--strict"],
      {
        PH_LIFECYCLE_RACE_OUTSIDE: outside,
        PH_LIFECYCLE_RACE_STATE: statePath,
      },
    )

    requireLifecycleStateBlock(`${label} lifecycle state ${stateName} race`, rerun, outside)
    if (existsSync(outside) || !lstatSync(statePath).isSymbolicLink()) {
      throw new Error(`${label} lifecycle state ${stateName} race did not preserve canonical containment`)
    }
  }
}

function createLifecycleStateIntakeFixture(projectDir) {
  mkdirSync(join(projectDir, "src", "main", "java"), { recursive: true })
  writeFileSync(join(projectDir, "README.md"), "# Lifecycle state intake fixture\n")
  writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'lifecycle-state-intake'\n")
  writeFileSync(join(projectDir, "build.gradle"), "plugins { id 'java' }\n")
  writeFileSync(join(projectDir, "src", "main", "java", "App.java"), "class App {}\n")
  writeFileSync(join(projectDir, "gradlew"), "#!/bin/sh\nprintf '%s\\n' 'BUILD SUCCESSFUL'\n")
  chmodSync(join(projectDir, "gradlew"), 0o755)
  initializeFixtureGit(projectDir, "lifecycle fixture", {
    email: "fixture@example.invalid",
    message: "lifecycle fixture",
    name: "Fixture",
  })
}

function lifecycleStateFileNames() {
  return ["workflow-loop-state.json", "ralph-loop-state.json"]
}

function lifecycleStateFiles(directory) {
  return lifecycleStateFileNames().filter((name) => existsSync(join(directory, name)))
}

function workflowBootstrapFiles(directory) {
  return [
    "plan.md",
    "roles.md",
    "implementation-report.md",
    "review-report.md",
    ...lifecycleStateFileNames(),
  ].filter((name) => existsSync(join(directory, name)))
}

function requireLifecycleStateBlock(label, result, outside) {
  if (result.status === 0 || `${result.stdout}${result.stderr}`.includes(outside)) {
    throw new Error(`${label} did not block with bounded output`)
  }
  for (const authorityDirectory of ["finish-attestation", "project-finish-attestation", "verification-receipts"]) {
    if (existsSync(join(dirname(outside), ".persona", "evidence", authorityDirectory))) {
      throw new Error(`${label} created authority evidence while blocked`)
    }
  }
}

function requireEvidenceReadBlock(label, result, outside) {
  if (result.status === 0 || `${result.stdout}${result.stderr}`.includes(outside)) {
    throw new Error(`${label} did not block with bounded output`)
  }
  for (const authorityDirectory of ["finish-attestation", "project-finish-attestation", "verification-receipts"]) {
    if (existsSync(join(dirname(outside), ".persona", "evidence", authorityDirectory))) {
      throw new Error(`${label} created authority evidence while blocked`)
    }
  }
}

function requireNativeAuditZero(label, sentinel, expectedStage) {
  if (!existsSync(sentinel)) {
    throw new Error(`${label} did not prove zero external descriptor opens`)
  }
  const result = readFileSync(sentinel, "utf8")
  const expected = expectedStage === undefined
    ? /^native-stage=(?:[a-z-]+)\nopened-external=0\n$/u
    : `native-stage=${expectedStage}\nopened-external=0\n`
  if (typeof expected === "string" ? result !== expected : !expected.test(result)) {
    throw new Error(`${label} did not prove zero external descriptor opens`)
  }
}

function nativeReadAuditEnvironment(target, sentinel) {
  const identity = lstatSync(target, { bigint: true })
  return {
    PH_NATIVE_AUDIT_DEV: identity.dev.toString(),
    PH_NATIVE_AUDIT_INO: identity.ino.toString(),
    PH_NATIVE_AUDIT_SENTINEL: sentinel,
  }
}

function writeNativeReadAuditHook(
  hookPath,
  auditCommand,
  swapAfterCommand,
  swapLines = [],
  allowNoNativeAfterSwap = false,
) {
  writeFileSync(hookPath, [
    'const fs = require("node:fs")',
    'const auditDev = BigInt(process.env.PH_NATIVE_AUDIT_DEV)',
    'const auditIno = BigInt(process.env.PH_NATIVE_AUDIT_INO)',
    'const originalOpenSync = fs.openSync',
    'const originalDlopen = process.dlopen',
    'const originalWriteFileSync = fs.writeFileSync',
    `const auditCommand = ${JSON.stringify(auditCommand)}`,
    `const swapAfterCommand = ${JSON.stringify(swapAfterCommand)}`,
    `const allowNoNativeAfterSwap = ${JSON.stringify(allowNoNativeAfterSwap)}`,
    'let auditObservedWithoutExternal = false',
    'let nativeInvoked = false',
    'let openedExternal = false',
    `let swapped = ${swapAfterCommand === undefined ? "true" : "false"}`,
    'const performSwap = () => {',
    ...swapLines,
    '  swapped = true',
    '}',
    'fs.openSync = (...args) => {',
    '  const descriptor = originalOpenSync(...args)',
    '  if (swapped) {',
    '    const identity = fs.fstatSync(descriptor, { bigint: true })',
    '    if (identity.dev === auditDev && identity.ino === auditIno) openedExternal = true',
    '  }',
    '  return descriptor',
    '}',
    'process.dlopen = function patchedNativeDlopen(nativeModule, filename, flags) {',
    '  if (arguments.length === 2) originalDlopen(nativeModule, filename)',
    '  else originalDlopen(nativeModule, filename, flags)',
    '  const loaded = nativeModule.exports',
    '  if (loaded === null || typeof loaded !== "object" || typeof loaded.run !== "function") return',
    '  const originalRun = loaded.run',
    '  loaded.run = (args, input, environment, maxBuffer, timeoutMs, rootDescriptor, parentDescriptor) => {',
    '    if (swapped && Array.isArray(args) && args[1] === auditCommand) {',
    '      nativeInvoked = true',
    '      const audited = originalRun(',
    '        [...args, "--audit", process.env.PH_NATIVE_AUDIT_DEV, process.env.PH_NATIVE_AUDIT_INO],',
    '        input,',
    '        environment,',
    '        maxBuffer,',
    '        timeoutMs,',
    '        rootDescriptor,',
    '        parentDescriptor,',
    '      )',
    '      if (Buffer.isBuffer(audited) && audited.byteLength >= 2) {',
    '        if (audited.at(-1) === 1) openedExternal = true',
    '        auditObservedWithoutExternal = audited.at(-1) === 0',
    '        return audited.subarray(0, -1)',
    '      }',
    '      return audited',
    '    }',
    '    const result = originalRun(args, input, environment, maxBuffer, timeoutMs, rootDescriptor, parentDescriptor)',
    '    if (!swapped && Array.isArray(args) && args[1] === swapAfterCommand) {',
    '      performSwap()',
    '    }',
    '    return result',
    '  }',
    '}',
    'process.once("exit", () => {',
    '  if (!openedExternal && (auditObservedWithoutExternal || (allowNoNativeAfterSwap && swapped && !nativeInvoked))) {',
    '    const stage = auditObservedWithoutExternal ? auditCommand : "not-reached"',
    '    originalWriteFileSync(process.env.PH_NATIVE_AUDIT_SENTINEL, `native-stage=${stage}\\nopened-external=0\\n`)',
    '  }',
    '})',
    '',
  ].join("\n"))
}

function assertWorkflowLifecycleAbsenceBlocks(fixtureRoot, phPath, label) {
  mkdirSync(fixtureRoot, { recursive: true })
  requireSuccess(`${label} lifecycle fixture intake`, runNode(fixtureRoot, [phPath, "intake", "--default", "backend"]))
  requireSuccess(`${label} lifecycle fixture plan`, runNode(fixtureRoot, [phPath, "plan"]))
  requireSuccess(`${label} lifecycle fixture plan acceptance`, runNode(fixtureRoot, [phPath, "plan", "--accept"]))
  mkdirSync(join(fixtureRoot, ".persona", "evidence", "phase0"), { recursive: true })
  writeFileSync(
    join(fixtureRoot, ".persona", "workflow", "implementation-report.md"),
    [
      "Status: filled",
      "- README ranges read: all",
      "- Project profile ranges read: all",
      "- `npx ph bearshell --shell './gradlew test'`",
    ].join("\n"),
  )
  writeFileSync(
    join(fixtureRoot, ".persona", "workflow", "review-report.md"),
    [
      "Status: filled",
      "- `npx ph bearshell --shell './gradlew build'`",
    ].join("\n"),
  )
  writeFileSync(
    join(fixtureRoot, ".persona", "evidence", "phase0", "verification.json"),
    `${JSON.stringify({
      command: "npx ph bearshell --shell './gradlew test'",
      status: 0,
      tool: "bearshell",
      toolOutput: "BUILD SUCCESSFUL",
    }, null, 2)}\n`,
  )

  const closure = runNode(fixtureRoot, [phPath, "workflow", "closure", "next", "--json"])
  requireSuccess(`${label} lifecycle absence closure`, closure)
  const payload = JSON.parse(closure.stdout)
  const lifecycle = isRecord(payload) && isRecord(payload.state) && isRecord(payload.state.lifecycle)
    ? payload.state.lifecycle
    : undefined
  const blockers = lifecycle !== undefined && Array.isArray(lifecycle.blockers)
    ? lifecycle.blockers.map((blocker) => isRecord(blocker) ? blocker.id : undefined)
    : []
  if (
    lifecycle === undefined
    || lifecycle.readiness !== "blocked"
    || !blockers.includes("workflow-loop-state-absent")
    || !blockers.includes("ralph-loop-state-absent")
  ) {
    throw new Error(`${label} lifecycle absence did not fail closed`)
  }
  if (closure.stdout.includes("sk-live-") || existsSync(join(fixtureRoot, ".persona", "evidence", "finish-attestation"))) {
    throw new Error(`${label} lifecycle absence probe reflected unsafe content or created authority evidence`)
  }
}

function assertCooperativeFinishWorks(fixtureRoot, phPath, label, readiness, packageRoot) {
  createCooperativeGradleFixture(fixtureRoot)
  assertUninitializedFinishBlocks(fixtureRoot, phPath, label)
  prepareRetainedDraftPlan(fixtureRoot, phPath, label)
  const consumerRoot = `${fixtureRoot}-consumer`
  requireSuccess(`${label} clean consumer worktree`, runCommand(fixtureRoot, "git", ["worktree", "add", "--detach", consumerRoot, "HEAD"]))

  try {
    runCooperativeLifecycle(
      consumerRoot,
      phPath,
      label,
      readiness,
      packageRoot,
      `${consumerRoot}-authority-home`,
    )
  } finally {
    if (existsSync(consumerRoot)) {
      requireSuccess(`${label} clean consumer removal`, runCommand(fixtureRoot, "git", ["worktree", "remove", "--force", consumerRoot]))
    }
  }
}

function assertUninitializedFinishBlocks(fixtureRoot, phPath, label) {
  const home = `${fixtureRoot}-uninitialized-authority-home`
  const result = runNode(
    fixtureRoot,
    [phPath, "workflow", "finish", "implement"],
    isolatedAuthorityEnvironment(home),
  )
  const output = `${result.stdout}${result.stderr}`
  if (
    result.status !== 1
    || !result.stderr.includes("Blocker: workflow-state-uninitialized")
    || output.includes(fixtureRoot)
    || output.includes(home)
    || existsSync(join(fixtureRoot, ".persona"))
    || existsSync(join(home, ".persona-harness"))
  ) {
    throw new Error(`${label} uninitialized public Finish did not fail closed`)
  }
}

function runCooperativeLifecycle(fixtureRoot, phPath, label, readiness, packageRoot, authorityHome) {
  const environment = isolatedAuthorityEnvironment(authorityHome)
  runCooperativeLifecyclePreparation(fixtureRoot, phPath, label, readiness, environment)

  const cooperativeFinish = runNode(fixtureRoot, [
    phPath,
    "workflow",
    "finish",
    "implement",
    "--assurance",
    "cooperative",
  ], environment)
  requireSuccess(`${label} cooperative Finish`, cooperativeFinish)
  if (!cooperativeFinish.stdout.includes("Finish status: PASS")) {
    throw new Error(`${label} cooperative Finish did not report PASS`)
  }
  const junitPath = join(
    fixtureRoot,
    "build",
    "test-results",
    "test",
    "TEST-example.cooperative.CooperativeApplicationTest.xml",
  )
  if (!existsSync(junitPath) || !readFileSync(junitPath, "utf8").includes("<testcase")) {
    throw new Error(`${label} cooperative Finish did not produce real JUnit XML`)
  }
  for (const directory of ["verification-attempts", "verification-receipts", "finish-attestation"]) {
    if (existsSync(join(fixtureRoot, ".persona", "evidence", directory))) {
      throw new Error(`${label} cooperative Finish wrote forgeable authority directory ${directory}`)
    }
  }
  assertModeledAuthorityFinishLifecycle(fixtureRoot, phPath, packageRoot, authorityHome, label)
  const closure = runNode(fixtureRoot, [phPath, "workflow", "closure", "next", "--json"], environment)
  requireSuccess(`${label} external-only closure`, closure)
  if (!closure.stdout.includes("trusted-authority-required")) {
    throw new Error(`${label} closure did not remain external-only after modeled authority consumption`)
  }
}

function runCooperativeLifecyclePreparation(fixtureRoot, phPath, label, readiness, environment = {}) {
  for (const command of readiness.commands) {
    const step = BETA28_PRE_AUTHORITY_COMMANDS.get(command)
    if (step === undefined) {
      throw new Error(`${label} beta.28 pre-authority command is unsupported`)
    }
    const result = runNode(fixtureRoot, [phPath, ...step.args], environment, step.stdin)
    requireSuccess(
      `${label} lifecycle ${command}`,
      result,
    )
    assertPublicOutputDoesNotExposeWorkspace(result, fixtureRoot, `${label} lifecycle ${command}`)
  }
  const status = runNode(fixtureRoot, [phPath, "plan", "--status"], environment)
  requireSuccess(`${label} public plan status`, status)
  assertPublicOutputDoesNotExposeWorkspace(status, fixtureRoot, `${label} public plan status`)
  if (!status.stdout.includes("Plan: .persona/workflow/plan.md")) {
    throw new Error(`${label} public plan status did not retain the relative plan reference`)
  }
  if (!status.stdout.includes("Status: accepted")) {
    throw new Error(`${label} public plan status did not accept the retained draft plan`)
  }
  assertCooperativeLifecycleState(fixtureRoot, label)
  assertAuthorityOnlyPreflight(fixtureRoot, phPath, label, readiness.expectedDefaultFinish, environment)
}

function prepareRetainedDraftPlan(fixtureRoot, phPath, label) {
  requireSuccess(
    `${label} retained source-bound profile`,
    runNode(fixtureRoot, [phPath, "intake", "--default", "backend"]),
  )
  requireSuccess(
    `${label} retained source-bound draft plan`,
    runNode(fixtureRoot, [phPath, "plan"]),
  )
  requireSuccess(
    `${label} retained source-bound bootstrap`,
    runNode(fixtureRoot, [phPath, "bootstrap", "backend", "--strict", "--no-developer-mcp"]),
  )
  const draftStatus = runNode(fixtureRoot, [phPath, "plan", "--status"])
  requireSuccess(`${label} retained source-bound plan status`, draftStatus)
  if (!draftStatus.stdout.includes("Status: draft")) {
    throw new Error(`${label} retained source-bound bootstrap did not preserve the draft approval boundary`)
  }
  requireSuccess(`${label} retained source-bound plan add`, runCommand(fixtureRoot, "git", ["add", "."]))
  requireSuccess(
    `${label} retained source-bound plan commit`,
    runCommand(fixtureRoot, "git", ["commit", "-qm", "retain draft workflow plan"]),
  )
}

function assertPublicOutputDoesNotExposeWorkspace(result, workspace, label) {
  const output = `${result.stdout}${result.stderr}`
  if (output.includes(workspace) || output.includes(realpathSync(workspace))) {
    throw new Error(`${label} exposed an absolute workspace path through public output`)
  }
}

function assertCooperativeSourceReadRaceBlocks(fixtureRoot, phPath, label, readiness) {
  createCooperativeGradleFixture(fixtureRoot)
  requireSuccess(
    `${label} cooperative source-read race bootstrap`,
    runNode(fixtureRoot, [phPath, "bootstrap", "backend", "--strict", "--no-developer-mcp"]),
  )
  const consumerRoot = `${fixtureRoot}-consumer`
  requireSuccess(
    `${label} cooperative source-read race worktree`,
    runCommand(fixtureRoot, "git", ["worktree", "add", "--detach", consumerRoot, "HEAD"]),
  )
  try {
    runCooperativeLifecyclePreparation(consumerRoot, phPath, `${label} cooperative source-read race`, readiness)
    const sourceParent = join(consumerRoot, "src", "main", "java")
    const sourceDraft = `${sourceParent}.draft`
    const outside = `${consumerRoot}-outside-source`
    const hookPath = join(fixtureRoot, "cooperative-source-read-race-hook.cjs")
    const sentinel = `${fixtureRoot}-cooperative-source-read-race-audit`
    mkdirSync(outside)
    writeFileSync(join(outside, "External.java"), "class External { String marker = \"sk-live-aaaaaaaaaaaaaaaaaaaaaaaa\"; }\n")
    writeNativeReadAuditHook(hookPath, "tree", "tree", [
      '    require("node:fs").renameSync(process.env.PH_COOPERATIVE_SOURCE_PARENT, process.env.PH_COOPERATIVE_SOURCE_DRAFT)',
      '    require("node:fs").renameSync(process.env.PH_COOPERATIVE_SOURCE_OUTSIDE, process.env.PH_COOPERATIVE_SOURCE_PARENT)',
    ])
    const result = runNode(
      consumerRoot,
      ["--require", hookPath, phPath, "workflow", "finish", "implement", "--assurance", "cooperative"],
      {
        ...nativeReadAuditEnvironment(outside, sentinel),
        PH_COOPERATIVE_SOURCE_DRAFT: sourceDraft,
        PH_COOPERATIVE_SOURCE_OUTSIDE: outside,
        PH_COOPERATIVE_SOURCE_PARENT: sourceParent,
      },
    )
    if (
      result.status === 0
      || `${result.stdout}${result.stderr}`.includes(outside)
      || `${result.stdout}${result.stderr}`.includes("sk-live-aaaaaaaaaaaaaaaaaaaaaaaa")
    ) {
      throw new Error(`${label} cooperative source-read race did not fail closed`)
    }
    requireNativeAuditZero(`${label} cooperative source-read race`, sentinel)
    for (const directory of ["finish-attestation", "project-finish-attestation", "verification-receipts"]) {
      if (existsSync(join(consumerRoot, ".persona", "evidence", directory))) {
        throw new Error(`${label} cooperative source-read race created authority evidence`)
      }
    }
  } finally {
    if (existsSync(consumerRoot)) {
      requireSuccess(`${label} cooperative source-read race removal`, runCommand(fixtureRoot, "git", ["worktree", "remove", "--force", consumerRoot]))
    }
    rmSync(fixtureRoot, { force: true, recursive: true })
    rmSync(`${fixtureRoot}-outside-source`, { force: true, recursive: true })
  }
}

function createCooperativeGradleFixture(projectDir) {
  mkdirSync(join(projectDir, "src", "main", "java", "example", "cooperative"), { recursive: true })
  mkdirSync(join(projectDir, "src", "test", "java", "example", "cooperative"), { recursive: true })
  writeFileSync(join(projectDir, "README.md"), "# Installed cooperative Gradle fixture\n")
  writeFileSync(join(projectDir, ".gitignore"), ".gradle/\nbuild/\n")
  writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'installed-cooperative-gradle'\n")
  writeFileSync(join(projectDir, "gradle.properties"), "org.gradle.daemon=false\n")
  writeFileSync(
    join(projectDir, "build.gradle"),
    [
      "plugins {",
      "  id 'java'",
      "  id 'org.springframework.boot' version '3.5.0'",
      "  id 'io.spring.dependency-management' version '1.1.7'",
      "}",
      "",
      "repositories { mavenCentral() }",
      "",
      "java {",
      "  toolchain { languageVersion = JavaLanguageVersion.of(21) }",
      "}",
      "",
      "dependencies {",
      "  implementation 'org.springframework.boot:spring-boot-starter'",
      "  testImplementation 'org.springframework.boot:spring-boot-starter-test'",
      "}",
      "",
      "tasks.named('test') { useJUnitPlatform() }",
      "",
    ].join("\n"),
  )
  requireSuccess(
    "installed fixture Gradle wrapper",
    runCommand(projectDir, "gradle", ["--no-daemon", "wrapper", "--gradle-version", "9.4.0", "--distribution-type", "bin"], {
      environment: { GRADLE_USER_HOME: contractGradleUserHome },
      timeoutMs: 120_000,
    }),
  )
  rmSync(join(projectDir, ".gradle"), { force: true, recursive: true })
  writeFileSync(
    join(projectDir, "src", "main", "java", "example", "cooperative", "CooperativeApplication.java"),
    [
      "package example.cooperative;",
      "",
      "import org.springframework.boot.autoconfigure.SpringBootApplication;",
      "",
      "@SpringBootApplication",
      "public class CooperativeApplication {",
      "  public static void main(String[] args) {",
      "    org.springframework.boot.SpringApplication.run(CooperativeApplication.class, args);",
      "  }",
      "}",
      "",
    ].join("\n"),
  )
  writeFileSync(
    join(projectDir, "src", "main", "java", "example", "cooperative", "GreetingService.java"),
    [
      "package example.cooperative;",
      "",
      "import org.springframework.stereotype.Service;",
      "",
      "@Service",
      "public class GreetingService {",
      "  public String greeting() {",
      "    return \"hello\";",
      "  }",
      "}",
      "",
    ].join("\n"),
  )
  writeFileSync(
    join(projectDir, "src", "test", "java", "example", "cooperative", "CooperativeApplicationTest.java"),
    [
      "package example.cooperative;",
      "",
      "import static org.junit.jupiter.api.Assertions.assertEquals;",
      "",
      "import org.junit.jupiter.api.Test;",
      "",
      "class CooperativeApplicationTest {",
      "  @Test",
      "  void addsTwoNumbers() {",
      "    assertEquals(4, 2 + 2);",
      "  }",
      "}",
      "",
    ].join("\n"),
  )
  warmCooperativeGradleRuntime(projectDir)
  initializeFixtureGit(projectDir, "installed fixture", {
    autoCrlf: "false",
    email: "ph@example.invalid",
    message: "installed fixture",
    name: "PH Test",
  })
}

function warmCooperativeGradleRuntime(projectDir) {
  mkdirSync(contractGradleUserHome, { recursive: true })
  requireSuccess(
    "installed fixture Gradle runtime warmup",
    runCommand(projectDir, "./gradlew", ["--no-daemon", "test"], {
      environment: { GRADLE_USER_HOME: contractGradleUserHome },
      timeoutMs: 120_000,
    }),
  )
  rmSync(join(projectDir, ".gradle"), { force: true, recursive: true })
  rmSync(join(projectDir, "build"), { force: true, recursive: true })
}

function assertCooperativeLifecycleState(projectDir, label) {
  for (const relativePath of [
    ".persona/workflow/workflow-loop-state.json",
    ".persona/workflow/ralph-loop-state.json",
  ]) {
    if (!existsSync(join(projectDir, relativePath))) {
      throw new Error(`${label} lifecycle bootstrap did not create canonical loop state`)
    }
  }
}

function assertAuthorityOnlyPreflight(projectDir, phPath, label, expected, environment = {}) {
  const defaultFinish = runNode(projectDir, [phPath, "workflow", "finish", "implement"], environment)
  const output = `${defaultFinish.stdout}${defaultFinish.stderr}`
  if (
    defaultFinish.status !== 1
    || expected.status !== "blocked"
    || expected.primaryBlocker !== "trusted-authority-required"
    || !output.includes("Blocker: trusted-authority-required")
    || expected.absentBlockers.some((blocker) => output.includes(blocker))
  ) {
    throw new Error(`${label} public pre-authority readiness did not reach only trusted authority`)
  }
  for (const directory of ["finish-attestation", "project-finish-attestation", "verification-attempts", "verification-receipts"]) {
    if (existsSync(join(projectDir, ".persona", "evidence", directory))) {
      throw new Error(`${label} authority-only preflight created authority evidence`)
    }
  }
}

function isolatedAuthorityEnvironment(home) {
  mkdirSync(home, { recursive: true })
  mkdirSync(contractGradleUserHome, { recursive: true })
  return {
    GRADLE_USER_HOME: contractGradleUserHome,
    GH_TOKEN: "",
    GITHUB_TOKEN: "",
    HOME: home,
  }
}

function assertModeledAuthorityFinishLifecycle(projectDir, phPath, packageRoot, home, label) {
  const environment = isolatedAuthorityEnvironment(home)
  const seeded = seedModeledAuthorityArtifact(projectDir, packageRoot, home, environment, label)
  const loaderPath = join(home, "modeled-project-finish-worker-loader.mjs")
  writeModeledProjectFinishWorkerLoader(loaderPath, seeded)
  const workerArgs = ["--no-warnings", "--experimental-loader", loaderPath, phPath]

  const fetchedStatus = runNode(projectDir, [...workerArgs, "authority", "status", "--json"], environment)
  requireSuccess(`${label} modeled authority status`, fetchedStatus)
  assertPublicOutputDoesNotExposeWorkspace(fetchedStatus, projectDir, `${label} modeled authority status`)
  const fetched = JSON.parse(fetchedStatus.stdout)
  if (
    !isRecord(fetched)
    || fetched.authorityEligible !== true
    || fetched.consumptionState !== "unconsumed"
    || fetched.state !== "trusted"
  ) {
    throw new Error(`${label} modeled authority fetch did not become trusted and unconsumed`)
  }

  const firstFinish = runNode(projectDir, [...workerArgs, "workflow", "finish", "implement"], environment)
  requireSuccess(`${label} modeled authority Finish`, firstFinish)
  assertPublicOutputDoesNotExposeWorkspace(firstFinish, projectDir, `${label} modeled authority Finish`)
  if (!firstFinish.stdout.includes("Finish status: PASS")) {
    throw new Error(`${label} modeled authority Finish did not consume once`)
  }
  const terminal = join(projectDir, ".persona", "evidence", "finish-attestation", "consumption.json")
  if (!existsSync(terminal)) {
    throw new Error(`${label} modeled authority Finish did not retain a terminal consumption record`)
  }

  const consumedStatus = runNode(projectDir, [...workerArgs, "authority", "explain", "--json"], environment)
  requireSuccess(`${label} modeled consumed authority status`, consumedStatus)
  assertPublicOutputDoesNotExposeWorkspace(consumedStatus, projectDir, `${label} modeled consumed authority status`)
  const consumed = JSON.parse(consumedStatus.stdout)
  if (
    !isRecord(consumed)
    || consumed.authorityEligible !== true
    || consumed.consumptionState !== "consumed"
    || consumed.state !== "trusted"
  ) {
    throw new Error(`${label} modeled authority Finish did not expose consumed state`)
  }

  const replay = runNode(projectDir, [...workerArgs, "workflow", "finish", "implement"], environment)
  const replayOutput = `${replay.stdout}${replay.stderr}`
  if (
    replay.status !== 1
    || !replay.stderr.includes("Blocker: trusted-authority-required")
    || replayOutput.includes("Finish status: PASS")
    || replayOutput.includes(projectDir)
    || replayOutput.includes(home)
  ) {
    throw new Error(`${label} modeled authority replay did not fail closed`)
  }
}

function seedModeledAuthorityArtifact(projectDir, packageRoot, home, environment, label) {
  const runtimeRoot = mkdtempSync(join(temporaryRoot, "authority-fetch-finish-runtime-"))
  const childFixturePath = join(runtimeRoot, "authority-fetch-finish-fixture.json")
  const childAuditPath = join(runtimeRoot, "authority-fetch-finish-audit")
  try {
    cpSync(join(packageRoot, "dist"), join(runtimeRoot, "dist"), { dereference: true, recursive: true })
    cpSync(join(packageRoot, "native"), join(runtimeRoot, "native"), { dereference: true, recursive: true })
    cpSync(join(packageRoot, "scripts"), join(runtimeRoot, "scripts"), { dereference: true, recursive: true })
    copyFileSync(join(packageRoot, "package.json"), join(runtimeRoot, "package.json"))
    writeAuthorityFetchChildWorker(runtimeRoot, childFixturePath, childAuditPath)
    const moduleRoot = join(runtimeRoot, "dist", "cli")
    const moduleUrl = (name) => pathToFileURL(join(moduleRoot, name)).href
    const script = [
      'import { createHash } from "node:crypto";',
      'import { writeFileSync } from "node:fs";',
      `import { runAuthorityCommand } from ${JSON.stringify(moduleUrl("authority-command.js"))};`,
      `import { authorityEnrollmentFromReadback, writeAuthorityEnrollment } from ${JSON.stringify(moduleUrl("authority-enrollment.js"))};`,
      `import { createProjectFinishAttestationProducerArtifacts } from ${JSON.stringify(moduleUrl("project-finish-attestation-producer.js"))};`,
      `import { canonicalProjectFinishAttestationBytes } from ${JSON.stringify(moduleUrl("project-finish-attestation-canonical.js"))};`,
      `import { captureWorkspaceIdentity, captureGitIdentity } from ${JSON.stringify(moduleUrl("ci-reverification-identity.js"))};`,
      `import { captureProjectFinishAttestationSourceIdentity } from ${JSON.stringify(moduleUrl("project-finish-attestation-source.js"))};`,
      `import { bindProjectFinishAttestationInputSnapshot, captureProjectFinishAttestationInputSnapshot } from ${JSON.stringify(moduleUrl("project-finish-attestation-inputs.js"))};`,
      `import { personaHarnessVersion } from ${JSON.stringify(moduleUrl("version.js"))};`,
      'const digest = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;',
      'const archive = (members) => { const local = []; const central = []; let offset = 0; for (const [name, bytes] of Object.entries(members)) { const nameBytes = Buffer.from(name, "utf8"); const header = Buffer.alloc(30); header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4); header.writeUInt32LE(bytes.byteLength, 18); header.writeUInt32LE(bytes.byteLength, 22); header.writeUInt16LE(nameBytes.byteLength, 26); local.push(header, nameBytes, bytes); const directory = Buffer.alloc(46); directory.writeUInt32LE(0x02014b50, 0); directory.writeUInt16LE(20, 4); directory.writeUInt16LE(20, 6); directory.writeUInt32LE(bytes.byteLength, 20); directory.writeUInt32LE(bytes.byteLength, 24); directory.writeUInt16LE(nameBytes.byteLength, 28); directory.writeUInt32LE(offset, 42); central.push(directory, nameBytes); offset += header.byteLength + nameBytes.byteLength + bytes.byteLength; } const directory = Buffer.concat(central); const footer = Buffer.alloc(22); footer.writeUInt32LE(0x06054b50, 0); footer.writeUInt16LE(Object.keys(members).length, 8); footer.writeUInt16LE(Object.keys(members).length, 10); footer.writeUInt32LE(directory.byteLength, 12); footer.writeUInt32LE(offset, 16); return Buffer.concat([...local, directory, footer]); };',
      'const workspace = captureWorkspaceIdentity("."); if (workspace.status !== "available") throw new Error("modeled-authority-workspace");',
      'const git = captureGitIdentity(".", workspace.value); if (!git.available || git.head === undefined) throw new Error("modeled-authority-git");',
      'const source = captureProjectFinishAttestationSourceIdentity(".", git); if (source.status !== "available") throw new Error("modeled-authority-source");',
      'const inputs = captureProjectFinishAttestationInputSnapshot("."); if (inputs.kind !== "ready") throw new Error("modeled-authority-inputs");',
      'const enrollment = authorityEnrollmentFromReadback({ callerWorkflowPath: "research-attestation.yml", repositoryId: 1304576182, repositorySlug: "jyt6640/persona-harness-attestation-claim-fixture", reusableWorkflowSha: "73e8654ce3307a6be7fb511e0c1f67df93c7d1b3" }); if (enrollment === undefined) throw new Error("modeled-authority-enrollment");',
      'const now = new Date().toISOString(); const boundSource = bindProjectFinishAttestationInputSnapshot(source.value, inputs.value);',
      'const produced = createProjectFinishAttestationProducerArtifacts({ buildArtifactDigest: `sha256:${"b".repeat(64)}`, callerWorkflowRef: `${enrollment.repositorySlug}/.github/workflows/${enrollment.callerWorkflowPath}@refs/heads/main`, callerWorkflowSha: git.head, issuedAt: now, phVersion: personaHarnessVersion(), repository: { id: enrollment.repositoryId, slug: enrollment.repositorySlug, visibility: "public" }, reusableWorkflowSha: enrollment.reusableWorkflowSha, runAttempt: 1, runId: "30450000000", source: { head: git.head, identity: boundSource, root: "." }, test: { count: 1, junitDigest: `sha256:${"c".repeat(64)}`, passed: 1, skipped: 0 } });',
      'const bundle = Buffer.from(JSON.stringify(produced.statement), "utf8"); const original = archive({ "bundle.json": bundle, "predicate.json": canonicalProjectFinishAttestationBytes(produced.predicate), "receipt.json": produced.receiptBytes });',
      `const childFixturePath = ${JSON.stringify(childFixturePath)};`,
      'writeFileSync(childFixturePath, `${JSON.stringify({ expectedInput: { callerWorkflowPath: enrollment.callerWorkflowPath, repositoryId: enrollment.repositoryId, repositorySlug: enrollment.repositorySlug, sourceHead: git.head }, output: JSON.stringify({ archive: original.toString("base64"), artifactDigest: digest(original), artifactId: 710000015, ok: true, runId: "30450000000" }), status: 0 })}\n`);',
      `const storeRoot = ${JSON.stringify(join(home, ".persona-harness"))};`,
      'if (!writeAuthorityEnrollment(enrollment, { storeRoot })) throw new Error("modeled-authority-store");',
      'const assessment = { authorityEligible: true, consumptionState: "unconsumed", decision: "trusted", diagnostics: [], receipt: produced.receipt, state: "trusted", summary: "modeled-trusted-boundary" };',
      'const result = runAuthorityCommand(["fetch", "github", "--json"], { artifactInspector: () => assessment, githubToken: "ghp_modeled_authority_fetch", projectDir: ".", storeRoot });',
      'if (result.status !== 0) throw new Error("modeled-authority-fetch");',
      'process.stdout.write(JSON.stringify({ bundleDigest: digest(bundle), statement: produced.statement }));',
    ].join("\n")
    const result = runNode(projectDir, ["--input-type=module", "-e", script], environment)
    if (result.status !== 0) {
      throw new Error(`${label} modeled authority fetch child failed: ${JSON.stringify({
        childAudit: readAuthorityFetchChildAudit(childAuditPath),
        result: boundedAuthorityFetchResult(result.stdout),
      })}`)
    }
    requireSuccess(`${label} modeled authority fetch`, result)
    if (!hasAuthorityFetchChildAudit(childAuditPath)) {
      throw new Error(`${label} modeled authority fetch did not reach the bound child worker`)
    }
    try {
      const value = JSON.parse(result.stdout)
      if (!isRecord(value) || typeof value.bundleDigest !== "string" || !isRecord(value.statement)) {
        throw new TypeError("invalid modeled authority payload")
      }
      return value
    } catch {
      throw new Error(`${label} modeled authority fetch did not produce a bounded fixture`)
    }
  } finally {
    rmSync(runtimeRoot, { force: true, recursive: true })
  }
}

function writeModeledProjectFinishWorkerLoader(loaderPath, payload) {
  const worker = [
    "export function runProjectFinishAttestationWorker() {",
    `  return ${JSON.stringify({ bundleDigest: payload.bundleDigest, ok: true, statement: payload.statement })};`,
    "}",
  ].join("\n")
  const loader = [
    "export async function resolve(specifier, context, nextResolve) {",
    '  if (specifier === "./project-finish-attestation-worker.js" && context.parentURL?.endsWith("/project-finish-attestation-verifier.js")) {',
    `    return { shortCircuit: true, url: ${JSON.stringify(`data:text/javascript,${encodeURIComponent(worker)}`)} };`,
    "  }",
    "  return nextResolve(specifier, context);",
    "}",
  ].join("\n")
  writeFileSync(loaderPath, `${loader}\n`)
}

function readGaPreAuthorityReadiness(packageRoot) {
  const manifest = readV083AcceptanceManifest(packageRoot)
  return {
    commands: manifest.preAuthorityReadiness.commands,
    expectedDefaultFinish: manifest.preAuthorityReadiness.expectedDefaultFinish,
  }
}

function assertPrearmedObserverHandoff(packageRoot, label) {
  try {
    readV083AcceptanceManifest(packageRoot)
  } catch {
    throw new Error(`${label} beta.33 observer handoff contract is invalid`)
  }
}

async function assertV4FinalObserverCleanliness(packageRoot, label) {
  const scriptPath = join(packageRoot, "scripts", "consumer-authority-final-observer-v4-cleanliness.mjs")
  if (!existsSync(scriptPath)) {
    throw new Error(`${label} v4 final observer cleanliness contract is missing from the package`)
  }
  const cleanliness = await import(pathToFileURL(scriptPath).href)
  const fixtureRoot = mkdtempSync(join(temporaryRoot, "final-observer-v4-cleanliness-"))
  const outsideRoot = mkdtempSync(join(temporaryRoot, "final-observer-v4-outside-"))
  const stages = [
    "baseline",
    "source-bound-preparation",
    "credential-handoff",
    "observer-child",
    "immediately-pre-push",
  ]
  const projection = cleanliness.FINAL_OBSERVER_V4_STAGE_RESIDUE_PROJECTION
  try {
    writeFinalObserverV4GitFixture(fixtureRoot)
    for (const stage of stages) {
      materializeFinalObserverV4Stage(fixtureRoot, stage)
      const residues = projection[stage]
      const result = cleanliness.evaluateFinalObserverV4Cleanliness(finalObserverV4Input(fixtureRoot, stage))
      if (result.stage !== stage || result.residues.join("\0") !== residues.join("\0")) {
        throw new Error(`${label} v4 final observer cleanliness did not preserve the stage projection`)
      }
    }

    const tracked = finalObserverV4Input(fixtureRoot, "immediately-pre-push")
    tracked.statusNul = " M README.md\0"
    requireV4CleanlinessBlock(cleanliness, () => cleanliness.evaluateFinalObserverV4Cleanliness(tracked), label)

    const unexpected = finalObserverV4Input(fixtureRoot, "immediately-pre-push")
    unexpected.statusNul = `${unexpected.statusNul}?? unexpected\0`
    unexpected.cleanOutput = `${unexpected.cleanOutput}Would remove unexpected\n`
    requireV4CleanlinessBlock(cleanliness, () => cleanliness.evaluateFinalObserverV4Cleanliness(unexpected), label)

    const forbidden = finalObserverV4Input(fixtureRoot, "immediately-pre-push")
    forbidden.statusNul = `!! .local/\0${forbidden.statusNul}`
    forbidden.cleanOutput = `Would remove .local/\n${forbidden.cleanOutput}`
    requireV4CleanlinessBlock(cleanliness, () => cleanliness.evaluateFinalObserverV4Cleanliness(forbidden), label)

    const drift = finalObserverV4Input(fixtureRoot, "immediately-pre-push")
    drift.observed.sourceDigest = `sha256:${"f".repeat(64)}`
    requireV4CleanlinessBlock(cleanliness, () => cleanliness.evaluateFinalObserverV4Cleanliness(drift), label)

    const finalDiff = finalObserverV4Input(fixtureRoot, "immediately-pre-push")
    finalDiff.expected.finalDiff = [".github/workflows/research-attestation.yml", "src/Main.java"]
    finalDiff.observed.finalDiff = [".github/workflows/research-attestation.yml", "src/Main.java"]
    requireV4CleanlinessBlock(cleanliness, () => cleanliness.evaluateFinalObserverV4Cleanliness(finalDiff), label)

    const workflow = join(fixtureRoot, ".persona", "workflow")
    rmSync(workflow, { force: true, recursive: true })
    symlinkSync(outsideRoot, workflow)
    requireV4CleanlinessBlock(
      cleanliness,
      () => cleanliness.evaluateFinalObserverV4Cleanliness(finalObserverV4Input(fixtureRoot, "immediately-pre-push")),
      label,
    )
  } finally {
    rmSync(fixtureRoot, { force: true, recursive: true })
    rmSync(outsideRoot, { force: true, recursive: true })
  }
}

function writeFinalObserverV4GitFixture(root) {
  mkdirSync(join(root, ".github", "workflows"), { recursive: true })
  mkdirSync(join(root, ".persona"), { recursive: true })
  writeFileSync(join(root, ".gitignore"), [
    ".gradle/",
    ".persona/evidence/",
    ".persona/workflow/",
    "build/",
    "node_modules/",
  ].join("\n") + "\n")
  writeFileSync(join(root, ".github", "workflows", "research-attestation.yml"), "name: fixture\n")
  writeFileSync(join(root, ".persona", "harness.jsonc"), "{}\n")
  writeFileSync(join(root, "README.md"), "# final observer v4 fixture\n")
  initializeFixtureGit(root, "final observer v4 fixture", {
    email: "final-observer@example.invalid",
    message: "final observer v4 fixture",
    name: "Final Observer",
  })
}

function materializeFinalObserverV4Stage(root, stage) {
  if (stage === "baseline") return
  mkdirSync(join(root, ".persona", "workflow"), { recursive: true })
  writeFileSync(join(root, ".persona", ".ph-init-manifest.json"), "{}\n")
  if (stage === "source-bound-preparation") return
  mkdirSync(join(root, ".gradle"), { recursive: true })
  mkdirSync(join(root, ".persona", "evidence"), { recursive: true })
  mkdirSync(join(root, "build"), { recursive: true })
  mkdirSync(join(root, "node_modules"), { recursive: true })
}

function finalObserverV4Input(root, stage) {
  const canonicalRoot = realpathSync(root)
  const statusNul = runCommand(root, "git", ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--ignored=matching"]).stdout
  const cleanOutput = runCommand(root, "git", ["clean", "-ndx"]).stdout
  const binding = {
    cwd: canonicalRoot,
    finalDiff: [".github/workflows/research-attestation.yml", ".persona/project-profile.jsonc"],
    head: "a".repeat(40),
    parent: "b".repeat(40),
    remoteParent: "c".repeat(40),
    reusablePinDigest: `sha256:${"c".repeat(64)}`,
    reusablePinPath: ".github/workflows/research-attestation.yml",
    sourceDigest: `sha256:${"d".repeat(64)}`,
    topLevel: canonicalRoot,
  }
  return {
    cleanOutput,
    expected: structuredClone(binding),
    observed: structuredClone(binding),
    projectRoot: root,
    stage,
    statusNul,
  }
}

function requireV4CleanlinessBlock(cleanliness, action, label) {
  try {
    action()
  } catch (error) {
    if (error instanceof cleanliness.FinalObserverV4CleanlinessError) return
    throw error
  }
  throw new Error(`${label} v4 final observer cleanliness accepted an unsafe state`)
}

async function assertCanonicalPackagePublisherPlan(packageRoot, label) {
  const scriptPath = join(packageRoot, "scripts", "canonical-package-publisher.mjs")
  if (!existsSync(scriptPath)) {
    throw new Error(`${label} canonical package publisher is missing from the package`)
  }
  const publisher = await import(pathToFileURL(scriptPath).href)
  const manifest = readV083AcceptanceManifest(packageRoot)
  let packageMetadata
  try {
    packageMetadata = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"))
  } catch {
    throw new Error(`${label} canonical package metadata is invalid`)
  }
  if (
    typeof packageMetadata?.name !== "string"
    || typeof packageMetadata?.version !== "string"
    || packageMetadata.version !== manifest.package.version
  ) {
    throw new Error(`${label} canonical package metadata does not bind the current acceptance version`)
  }
  const lockPath = join(packageRoot, "package-lock.json")
  if (existsSync(lockPath)) {
    let lockMetadata
    try {
      lockMetadata = JSON.parse(readFileSync(lockPath, "utf8"))
    } catch {
      throw new Error(`${label} canonical package lock is invalid`)
    }
    if (
      lockMetadata?.version !== packageMetadata.version
      || lockMetadata?.packages?.[""]?.name !== packageMetadata.name
      || lockMetadata?.packages?.[""]?.version !== packageMetadata.version
    ) {
      throw new Error(`${label} canonical package lock does not bind the current package version`)
    }
  }
  const tarballPath = `/private/canonical/${packageMetadata.name}-${packageMetadata.version}.tgz`
  let plan
  let argv
  try {
    plan = publisher.parseCanonicalPackagePublisherPlan(manifest.canonicalPackagePublisherPlan)
    argv = publisher.createCanonicalPublisherArgs({
      dryRun: true,
      distTag: "staging",
      tarballPath,
    })
  } catch {
    throw new Error(`${label} canonical package publisher handoff contract is invalid`)
  }
  if (
    plan.npmTrustedPublishingMinimum?.node !== "22.14.0"
    || plan.npmTrustedPublishingMinimum?.npm !== "11.5.1"
    || plan.publisherRuntime?.node !== "24.18.0"
    || plan.publisherRuntime?.npm !== "11.16.0"
    || !Array.isArray(argv)
    || argv.join("\u0000") !== [
      "publish",
      tarballPath,
      "--access",
      "public",
      "--tag",
      "staging",
      "--provenance",
      "--dry-run",
    ].join("\u0000")
  ) {
    throw new Error(`${label} canonical package publisher handoff does not bind the exact tar argv`)
  }
}

function assertExternalAttestationCommandPlan(packageRoot, cwd, label, observerGh) {
  const scriptPath = join(packageRoot, "scripts", "preflight-consumer-authority-external-attestation.mjs")
  for (const script of [
    "consumer-authority-beta31-acceptance-schema.mjs",
    "consumer-authority-beta32-acceptance-schema.mjs",
    "consumer-authority-beta33-acceptance-schema.mjs",
    "consumer-authority-beta34-acceptance-schema.mjs",
    "consumer-authority-v082-acceptance-schema.mjs",
    "consumer-authority-v083-acceptance-schema.mjs",
    "consumer-authority-v081-acceptance-schema.mjs",
    "consumer-authority-rc1-acceptance-schema.mjs",
    "consumer-authority-external-attestation-command-plan.mjs",
    "consumer-authority-observer-gh-stage.mjs",
    "consumer-authority-observer-gh-tool.mjs",
    "consumer-authority-observer-gh-workflow-selector.mjs",
    "preflight-consumer-authority-external-attestation.mjs",
  ]) {
    if (!existsSync(join(packageRoot, "scripts", script))) {
      throw new Error(`${label} external attestation command plan is missing from the package`)
    }
  }
  const tokenMarker = "ghp_external_attestation_contract_token"
  const privateRoot = mkdtempSync(join(temporaryRoot, "external-attestation-private-copy-"))
  const runnerTemp = join(privateRoot, "runner-temp")
  let result
  try {
    mkdirSync(runnerTemp)
    const privateCopy = provisionPrivateObserverGhCopy(observerGh, { runnerTemp })
    const privateStage = observerGhStageCodeForPrivateCopy(privateCopy)
    if (privateStage !== undefined || privateCopy.state !== "ready" || typeof privateCopy.path !== "string") {
      throw new ObserverGhContractStageError(privateStage ?? "observer-gh-non-tool-stage")
    }
    result = runObserverPreflightNode(cwd, [scriptPath, "--json", "--observer-gh", privateCopy.path], {
      GH_TOKEN: tokenMarker,
      GITHUB_TOKEN: tokenMarker,
      HOME: join(temporaryRoot, "external-attestation-observer-home"),
    })
  } finally {
    rmSync(privateRoot, { force: true, recursive: true })
  }
  let payload
  try {
    payload = JSON.parse(result.stdout)
  } catch {
    throw new ObserverGhContractStageError("observer-gh-non-tool-stage")
  }
  const stageCode = observerGhStageCodeForPreflight(payload)
  if (stageCode !== undefined) throw new ObserverGhContractStageError(stageCode)
  if (
    result.status !== 0
    || !isRecord(payload)
    || payload.artifactAccess !== false
    || payload.authorityEligible !== false
    || payload.code !== "gh-command-parser-accepted"
    || payload.credential !== "absent"
    || payload.exit !== "parser-accepted"
    || payload.networkAccess !== false
    || payload.schemaVersion !== "consumer-authority-external-attestation-preflight.2"
    || payload.state !== "ready"
    || `${result.stdout}${result.stderr}`.includes(tokenMarker)
    || `${result.stdout}${result.stderr}`.includes(cwd)
  ) {
    throw new ObserverGhContractStageError("observer-gh-non-tool-stage")
  }
}

async function assertWorkflowSelectedObserverGhLifecycle(packageRoot, cwd, label, observerGh) {
  const selectorPath = join(packageRoot, "scripts", "consumer-authority-observer-gh-workflow-selector.mjs")
  const stagePath = join(packageRoot, "scripts", "consumer-authority-observer-gh-stage.mjs")
  const packageRecordPath = join(packageRoot, "scripts", "consumer-authority-observer-gh-package-record.mjs")
  if (!existsSync(selectorPath) || !existsSync(stagePath) || !existsSync(packageRecordPath)) {
    throw new ObserverGhContractStageError("observer-gh-non-tool-stage")
  }
  const [selector, stage, packageRecord] = await Promise.all([
    import(pathToFileURL(selectorPath).href),
    import(pathToFileURL(stagePath).href),
    import(pathToFileURL(packageRecordPath).href),
  ])
  const root = mkdtempSync(join(temporaryRoot, "workflow-observer-gh-lifecycle-"))
  const runnerTemp = join(root, "runner-temp")
  const githubOutput = join(root, "github-output")
  const packagedGh = join(root, "package", "gh")
  try {
    mkdirSync(runnerTemp)
    mkdirSync(dirname(packagedGh), { recursive: true })
    copyFileSync(observerGh, packagedGh, constants.COPYFILE_EXCL)
    chmodSync(packagedGh, 0o700)
    writeFileSync(githubOutput, "")
    const primaryOnly = packageRecord.parseObserverGhPackageRecord(Buffer.from(
      "/usr/bin/gh\n",
      "utf8",
    ))
    const completion = "/usr/share/bash-completion/completions/gh"
    const inertSecondary = "/usr/share/doc/gh/gh"
    const records = packageRecord.parseObserverGhPackageRecord(Buffer.from(
      `/usr/bin/gh\n${completion}\n${inertSecondary}\n`,
      "utf8",
    ))
    const stats = new Map([
      ["/usr/bin/gh", workflowObserverGhFixtureStat(0o100755)],
      [completion, workflowObserverGhFixtureStat(0o100755)],
      [inertSecondary, workflowObserverGhFixtureStat(0o100644)],
      ["/opt/gh", workflowObserverGhFixtureStat(0o100755)],
      ["/bin/gh", workflowObserverGhFixtureStat(0o120777, { symlink: true })],
    ])
    const lstat = (path) => stats.get(path) ?? workflowObserverGhMissingStat()
    const selected = packageRecord.selectInstalledObserverGhCandidate(primaryOnly, {
      lstat,
    })
    const selectedWithInertSecondary = packageRecord.selectInstalledObserverGhCandidate(records, {
      lstat,
    })
    if (
      selected.candidate !== "/usr/bin/gh"
      || selected.packageRecordShape !== "canonical"
      || selectedWithInertSecondary.candidate !== "/usr/bin/gh"
      || selectedWithInertSecondary.packageRecordShape !== "canonical"
    ) {
      throw new ObserverGhContractStageError("observer-gh-non-tool-stage")
    }
    const expectedPackageRecordShapes = [
      "record-encoding",
      "record-path",
      "primary-missing",
      "primary-unsafe",
      "ancillary-unsafe",
      "executable-ambiguous",
      "lstat-failed",
      "canonical",
    ]
    if (
      !packageRecord.OBSERVER_GH_OPTIONAL_ANCILLARY_RECORDS.includes(completion)
      || packageRecord.OBSERVER_GH_PACKAGE_RECORD_SHAPES.join("\u0000") !== expectedPackageRecordShapes.join("\u0000")
    ) {
      throw new ObserverGhContractStageError("observer-gh-non-tool-stage")
    }
    if (
      packageRecord.selectInstalledObserverGhCandidate(records, {
        lstat: (path) => path === "/usr/bin/gh"
          ? workflowObserverGhFixtureStat(0o100755)
          : workflowObserverGhFixtureStat(0o100644),
      }).candidate !== "/usr/bin/gh"
      || stage.observerGhStageCodeForWorkflowSelector({
        code: "observer-gh-workflow-tool-invalid",
        packageRecordShape: "record-path",
        selectorStage: "package-record",
        state: "blocked",
      }) !== "observer-gh-selector-package-record-record-path"
    ) {
      throw new ObserverGhContractStageError("observer-gh-non-tool-stage")
    }
    const expectPackageRecordShape = (shape, operation) => {
      try {
        operation()
      } catch (error) {
        if (isRecord(error) && error.shape === shape) return
      }
      throw new ObserverGhContractStageError("observer-gh-non-tool-stage")
    }
    expectPackageRecordShape("record-encoding", () => packageRecord.parseObserverGhPackageRecord(Buffer.from("/usr/bin/gh\r\n", "utf8")))
    expectPackageRecordShape("record-path", () => packageRecord.parseObserverGhPackageRecord(Buffer.from("gh\n", "utf8")))
    expectPackageRecordShape("primary-missing", () => packageRecord.selectInstalledObserverGhCandidate([completion], { lstat }))
    expectPackageRecordShape("primary-unsafe", () => packageRecord.selectInstalledObserverGhCandidate(records, {
      lstat: (path) => path === "/usr/bin/gh" ? workflowObserverGhFixtureStat(0o100644) : lstat(path),
    }))
    expectPackageRecordShape("record-encoding", () => packageRecord.selectInstalledObserverGhCandidate(["/usr/bin/gh", "/usr/bin/gh"], { lstat }))
    expectPackageRecordShape("ancillary-unsafe", () => packageRecord.selectInstalledObserverGhCandidate(["/usr/bin/gh", completion], {
      lstat: (path) => path === completion ? workflowObserverGhFixtureStat(0o120777, { symlink: true }) : lstat(path),
    }))
    expectPackageRecordShape("ancillary-unsafe", () => packageRecord.selectInstalledObserverGhCandidate(["/usr/bin/gh", completion], {
      lstat: (path) => path === completion ? workflowObserverGhFixtureStat(0o040755, { file: false }) : lstat(path),
    }))
    expectPackageRecordShape("ancillary-unsafe", () => packageRecord.selectInstalledObserverGhCandidate(["/usr/bin/gh", completion], {
      lstat: (path) => path === completion ? workflowObserverGhMissingStat() : lstat(path),
    }))
    expectPackageRecordShape("ancillary-unsafe", () => packageRecord.selectInstalledObserverGhCandidate(["/usr/bin/gh", inertSecondary], {
      lstat: (path) => path === inertSecondary ? workflowObserverGhFixtureStat(0o040755, { file: false }) : lstat(path),
    }))
    expectPackageRecordShape("ancillary-unsafe", () => packageRecord.selectInstalledObserverGhCandidate(["/usr/bin/gh", inertSecondary], {
      lstat: (path) => path === inertSecondary ? workflowObserverGhMissingStat() : lstat(path),
    }))
    expectPackageRecordShape("ancillary-unsafe", () => packageRecord.selectInstalledObserverGhCandidate(["/usr/bin/gh", "/bin/gh"], { lstat }))
    expectPackageRecordShape("executable-ambiguous", () => packageRecord.selectInstalledObserverGhCandidate([...records, "/opt/gh"], { lstat }))
    expectPackageRecordShape("lstat-failed", () => packageRecord.selectInstalledObserverGhCandidate(records, {
      lstat: () => {
        throw Object.assign(new Error("permission denied"), { code: "EACCES" })
      },
    }))
    const strictSelectorOptions = {
      assessTool: () => ({ state: "ready" }),
      copyFile: (_source, destination, mode) => copyFileSync(packagedGh, destination, mode),
      environment: { GITHUB_OUTPUT: githubOutput, RUNNER_TEMP: runnerTemp },
      lstatPackageRecord: lstat,
      readPackageRecord: () => records,
    }
    const ready = selector.provisionWorkflowObserverGhTool({
      ...strictSelectorOptions,
    })
    if (
      stage.observerGhStageCodeForWorkflowSelector(ready) !== undefined
      || ready.code !== "observer-gh-workflow-ready"
      || ready.packageRecordShape !== "canonical"
      || ready.selectorStage !== "output-handoff"
      || ready.state !== "ready"
      || !/^path=.+persona-harness-observer-gh\/gh\n$/u.test(readFileSync(githubOutput, "utf8"))
      || JSON.stringify(ready).includes(root)
      || JSON.stringify(ready).includes(cwd)
    ) {
      throw new ObserverGhContractStageError("observer-gh-non-tool-stage")
    }
    writeFileSync(githubOutput, "")
    const blocked = selector.provisionWorkflowObserverGhTool({
      ...strictSelectorOptions,
      readPackageRecord: () => {
        throw new packageRecord.ObserverGhPackageRecordError("record-path")
      },
    })
    const expected = "observer-gh-selector-package-record-record-path"
    if (
      stage.observerGhStageCodeForWorkflowSelector(blocked) !== expected
      || blocked.code !== "observer-gh-workflow-tool-invalid"
      || blocked.packageRecordShape !== "record-path"
      || blocked.selectorStage !== "package-record"
      || blocked.state !== "blocked"
      || readFileSync(githubOutput, "utf8") !== ""
      || JSON.stringify(blocked).includes(root)
      || JSON.stringify(blocked).includes(cwd)
    ) {
      throw new ObserverGhContractStageError("observer-gh-non-tool-stage")
    }
    const privateRoot = join(runnerTemp, "persona-harness-observer-gh")
    const knownCompletionBlocks = [
      (path) => path === completion ? workflowObserverGhFixtureStat(0o120777, { symlink: true }) : lstat(path),
      (path) => path === completion ? workflowObserverGhFixtureStat(0o040755, { file: false }) : lstat(path),
      (path) => path === completion ? workflowObserverGhMissingStat() : lstat(path),
    ]
    for (const lstatPackageRecord of knownCompletionBlocks) {
      rmSync(privateRoot, { force: true, recursive: true })
      writeFileSync(githubOutput, "")
      const knownCompletionBlocked = selector.provisionWorkflowObserverGhTool({
        ...strictSelectorOptions,
        lstatPackageRecord,
      })
      if (
        stage.observerGhStageCodeForWorkflowSelector(knownCompletionBlocked) !== "observer-gh-selector-package-record-ancillary-unsafe"
        || knownCompletionBlocked.code !== "observer-gh-workflow-tool-invalid"
        || knownCompletionBlocked.packageRecordShape !== "ancillary-unsafe"
        || knownCompletionBlocked.selectorStage !== "package-record"
        || knownCompletionBlocked.state !== "blocked"
        || readFileSync(githubOutput, "utf8") !== ""
        || existsSync(privateRoot)
        || JSON.stringify(knownCompletionBlocked).includes(root)
        || JSON.stringify(knownCompletionBlocked).includes(cwd)
      ) {
        throw new ObserverGhContractStageError("observer-gh-non-tool-stage")
      }
    }
  } catch (error) {
    if (error instanceof ObserverGhContractStageError) throw error
    throw new ObserverGhContractStageError("observer-gh-selector-internal")
  } finally {
    rmSync(root, { force: true, recursive: true })
  }
}

function workflowObserverGhFixtureStat(mode, options = {}) {
  return {
    isFile: () => options.file ?? true,
    isSymbolicLink: () => options.symlink ?? false,
    mode,
  }
}

function workflowObserverGhMissingStat() {
  throw Object.assign(new Error("missing"), { code: "ENOENT" })
}

async function assertExternalArtifactTransportPlan(packageRoot, cwd, label) {
  const scriptPath = join(packageRoot, "scripts", "preflight-consumer-authority-external-artifact-transport.mjs")
  for (const script of [
    "consumer-authority-beta31-acceptance-schema.mjs",
    "consumer-authority-beta32-acceptance-schema.mjs",
    "consumer-authority-beta33-acceptance-schema.mjs",
    "consumer-authority-beta34-acceptance-schema.mjs",
    "consumer-authority-v082-acceptance-schema.mjs",
    "consumer-authority-v083-acceptance-schema.mjs",
    "consumer-authority-v081-acceptance-schema.mjs",
    "consumer-authority-rc1-acceptance-schema.mjs",
    "consumer-authority-external-artifact-transport-plan.mjs",
    "consumer-authority-external-observer-boundary.mjs",
    "preflight-consumer-authority-external-artifact-transport.mjs",
  ]) {
    if (!existsSync(join(packageRoot, "scripts", script))) {
      throw new Error(`${label} external artifact transport plan is missing from the package`)
    }
  }
  const tokenMarker = "ghp_external_artifact_transport_contract_token"
  const result = runObserverPreflightNode(cwd, [scriptPath, "--json"], {
    GH_TOKEN: tokenMarker,
    GITHUB_TOKEN: tokenMarker,
    HOME: join(temporaryRoot, "external-artifact-transport-observer-home"),
    PATH: process.env.PATH ?? "",
  })
  let payload
  try {
    payload = JSON.parse(result.stdout)
  } catch {
    throw new Error(`${label} external artifact transport plan did not emit bounded JSON`)
  }
  if (
    result.status !== 0
    || !isRecord(payload)
    || payload.artifactAccess !== false
    || payload.authorityEligible !== false
    || payload.code !== "external-artifact-transport-parser-accepted"
    || payload.credential !== "absent"
    || payload.crypto !== "not-run"
    || payload.networkAccess !== false
    || payload.schemaVersion !== "consumer-authority-external-artifact-transport-preflight.1"
    || payload.state !== "ready"
    || `${result.stdout}${result.stderr}`.includes(tokenMarker)
    || `${result.stdout}${result.stderr}`.includes(cwd)
  ) {
    throw new Error(`${label} external artifact transport plan did not remain no-token and no-artifact`)
  }

  const [boundary, transport] = await Promise.all([
    import(pathToFileURL(join(packageRoot, "scripts", "consumer-authority-external-observer-boundary.mjs")).href),
    import(pathToFileURL(join(packageRoot, "scripts", "consumer-authority-external-artifact-transport-plan.mjs")).href),
  ])
  const manifest = readV083AcceptanceManifest(packageRoot)
  const archive = authorityArtifactArchive({
    "bundle.json": Buffer.from("{\"modeled\":true}\n", "utf8"),
    "predicate.json": Buffer.from("{\"predicate\":true}\n", "utf8"),
    "receipt.json": Buffer.from("{\"receipt\":true}\n", "utf8"),
  })
  const outputRoot = mkdtempSync(join(temporaryRoot, "external-artifact-transport-output-"))
  const requests = []
  const topology = {
    callerEnrollment: {
      ...manifest.authority.binding.callerEnrollment,
      workflowSha: "a".repeat(40),
    },
    callerSource: { ref: manifest.authority.hostedFixture.ref, sourceSha: "b".repeat(40) },
    reusableSigner: {
      repositorySlug: "jyt6640/persona-harness",
      workflowPath: manifest.authority.binding.reusableSigner.workflowPath,
      workflowSha: "c".repeat(40),
    },
  }
  const prepared = await boundary.prepareExternalObserverArtifactForTest({
    artifact: {
      artifactId: 710000017,
      expectedByteLength: archive.byteLength,
      expectedSha256: `sha256:${sha256(archive)}`,
      runId: "30460000000",
    },
    attestationPlan: manifest.externalAttestationCommandPlan,
    topology,
    transportPlan: transport.canonicalExternalArtifactTransportPlan(),
  }, tokenMarker, {
    createPrivateRoot: () => outputRoot,
    request: async (url, headers) => {
      requests.push({ headers, url: url.toString() })
      if (requests.length === 1) {
        return { body: emptyAsyncIterable(), headers: { location: "https://pipelines.actions.githubusercontent.com/model" }, statusCode: 302 }
      }
      return {
        body: bufferAsyncIterable(archive),
        headers: { "content-length": String(archive.byteLength), "content-type": "application/zip" },
        statusCode: 200,
      }
    },
    timeoutMs: 1000,
  })
  try {
    if (
      requests.length !== 2
      || requests[0].headers.Authorization !== `Bearer ${tokenMarker}`
      || "Authorization" in requests[1].headers
      || !prepared.readSubject().equals(archive)
      || prepared.readBundle().toString("utf8") !== "{\"modeled\":true}\n"
      || prepared.publicResult.authorityEligible !== false
      || JSON.stringify(prepared.publicResult).includes(tokenMarker)
      || JSON.stringify(prepared.publicResult).includes(outputRoot)
    ) {
      throw new Error(`${label} external artifact transport model did not retain the safe non-authoritative handoff`)
    }
  } finally {
    prepared.cleanup()
  }
  if (existsSync(outputRoot)) {
    throw new Error(`${label} external artifact transport output was not cleaned up`)
  }
}

async function assertBoundAuthorityDiscovery(packageRoot, label, surface) {
  const moduleRoot = join(packageRoot, "dist", "cli")
  const [
    command,
    enrollmentStore,
    artifactStore,
    fetcher,
    producer,
    version,
  ] = await Promise.all([
    import(pathToFileURL(join(moduleRoot, "authority-command.js")).href),
    import(pathToFileURL(join(moduleRoot, "authority-enrollment.js")).href),
    import(pathToFileURL(join(moduleRoot, "authority-artifact-store.js")).href),
    import(pathToFileURL(join(packageRoot, "scripts", "fetch-consumer-authority-artifact.mjs")).href),
    import(pathToFileURL(join(moduleRoot, "project-finish-attestation-producer.js")).href),
    import(pathToFileURL(join(moduleRoot, "version.js")).href),
  ])
  const sourceHead = MODELED_AUTHORITY_TOPOLOGY.callerWorkflowSha
  const enrollment = enrollmentStore.authorityEnrollmentFromReadback({
    callerWorkflowPath: MODELED_AUTHORITY_TOPOLOGY.callerWorkflowPath,
    repositoryId: MODELED_AUTHORITY_TOPOLOGY.repositoryId,
    repositorySlug: MODELED_AUTHORITY_TOPOLOGY.repositorySlug,
    reusableWorkflowSha: MODELED_AUTHORITY_TOPOLOGY.reusableWorkflowSha,
  })
  if (enrollment === undefined) throw new Error(`${label} authority enrollment fixture did not parse`)
  const produced = producer.createProjectFinishAttestationProducerArtifacts({
    buildArtifactDigest: `sha256:${"b".repeat(64)}`,
    callerWorkflowRef: `${enrollment.repositorySlug}/.github/workflows/${enrollment.callerWorkflowPath}@refs/heads/main`,
    callerWorkflowSha: sourceHead,
    issuedAt: "2026-07-29T00:00:00.000Z",
    phVersion: version.personaHarnessVersion(),
    repository: { id: enrollment.repositoryId, slug: enrollment.repositorySlug, visibility: "public" },
    reusableWorkflowSha: enrollment.reusableWorkflowSha,
    runAttempt: 2,
    runId: String(MODELED_CURRENT_RUN_ID),
    source: {
      head: sourceHead,
      identity: {
        contentDigest: `sha256:${"c".repeat(64)}`,
        entryCount: 5,
        exclusions: [".git/**", ".gradle/**", "build/**", "node_modules/**", "<configured-evidence>/**"],
        gitStatusDigest: `sha256:${"d".repeat(64)}`,
        repositoryHead: sourceHead,
        schemaVersion: "source-identity.1",
        trackedEntryCount: 5,
        trackedIndexDigest: `sha256:${"e".repeat(64)}`,
        untrackedEntryCount: 0,
      },
      root: ".",
    },
    test: {
      count: 4,
      junitDigest: `sha256:${"f".repeat(64)}`,
      passed: 3,
      skipped: 1,
    },
  })
  const archive = authorityArtifactArchive({
    "bundle.json": Buffer.from(JSON.stringify(produced.statement), "utf8"),
    "predicate.json": Buffer.from(JSON.stringify(produced.predicate), "utf8"),
    "receipt.json": produced.receiptBytes,
  })
  const requestedUrls = []
  const fetched = await fetcher.fetchConsumerAuthorityArtifact({
    callerWorkflowPath: enrollment.callerWorkflowPath,
    repositoryId: enrollment.repositoryId,
    repositorySlug: enrollment.repositorySlug,
    sourceHead,
  }, {
    archive: async (url) => {
      requestedUrls.push(url)
      return archive
    },
    json: async (url) => {
      requestedUrls.push(url)
      return modeledAuthorityDiscoveryResponse(url, archive, enrollment, sourceHead)
    },
  })
  const expectedWorkflowEndpoint = `/repos/${enrollment.repositorySlug}/actions/workflows/${enrollment.callerWorkflowPath}/runs`
  if (
    !requestedUrls.some((url) => url.pathname === expectedWorkflowEndpoint)
    || requestedUrls.some((url) => decodeURIComponent(url.pathname).includes(".github/workflows/"))
    || fetched.artifactId !== MODELED_CURRENT_ARTIFACT_ID
    || fetched.runId !== String(MODELED_CURRENT_RUN_ID)
    || fetched.artifactDigest !== `sha256:${sha256(archive)}`
  ) {
    throw new Error(`${label} authority discovery did not use the enrolled workflow identifier`)
  }
  const artifact = {
    archive: fetched.archive,
    artifactId: fetched.artifactId,
    artifactDigest: fetched.artifactDigest,
    fetchedAt: "2026-07-29T00:00:00.000Z",
    repositoryId: enrollment.repositoryId,
    runId: fetched.runId,
    sourceHead,
  }
  const assessment = {
    authorityEligible: true,
    consumptionState: "unconsumed",
    decision: "trusted",
    diagnostics: [],
    receipt: produced.receipt,
    state: "trusted",
    summary: "deterministic-binding-only",
  }
  const cases = [
    { id: "run", artifact: { ...artifact, runId: "10" }, enrollment, expectedState: "binding-mismatch" },
    { id: "source", artifact: { ...artifact, sourceHead: "c".repeat(40) }, enrollment, expectedState: "binding-mismatch" },
    {
      id: "repository",
      artifact: { ...artifact, repositoryId: enrollment.repositoryId + 1 },
      enrollment,
      expectedState: "missing",
    },
    {
      id: "caller",
      artifact,
      enrollment: {
        ...enrollment,
        callerWorkflowPath: "other.yml",
      },
      expectedState: "binding-mismatch",
    },
    {
      id: "reusable",
      artifact,
      enrollment: {
        ...enrollment,
        reusableWorkflowSha: "c".repeat(40),
      },
      expectedState: "binding-mismatch",
    },
    { id: "artifact-id", artifact: { ...artifact, artifactId: 0 }, enrollment, expectedState: "binding-mismatch" },
    { id: "digest", artifact: { ...artifact, artifactDigest: `sha256:${"0".repeat(64)}` }, enrollment, expectedState: "binding-mismatch" },
    {
      id: "archive",
      artifact: {
        ...artifact,
        archive: Buffer.from("not-an-original-project-finish-artifact", "utf8"),
        artifactDigest: `sha256:${sha256(Buffer.from("not-an-original-project-finish-artifact", "utf8"))}`,
      },
      enrollment,
      expectedState: "binding-mismatch",
    },
  ]
  const successRoot = mkdtempSync(join(temporaryRoot, "persona-authority-binding-success-"))
  if (!enrollmentStore.writeAuthorityEnrollment(enrollment, { storeRoot: successRoot })) {
    throw new Error(`${label} authority enrollment setup failed`)
  }
  const success = command.runAuthorityCommand(["fetch", "github", "--json"], {
    artifactFetch: () => artifact,
    artifactInspector: () => assessment,
    projectDir: temporaryRoot,
    storeRoot: successRoot,
  })
  const successPayload = JSON.parse(success.stdout)
  const stored = artifactStore.readAuthorityArtifact(enrollment.repositoryId, { storeRoot: successRoot })
  if (
    success.status !== 0
    || successPayload?.artifact?.id !== artifact.artifactId
    || successPayload?.artifact?.runId !== artifact.runId
    || stored?.state !== "ready"
    || stored.value.artifactId !== artifact.artifactId
  ) {
    throw new Error(`${label} authority discovery did not retain the verified artifact identity`)
  }
  for (const candidate of cases) {
    const storeRoot = mkdtempSync(join(temporaryRoot, `persona-authority-binding-${candidate.id}-`))
    if (!enrollmentStore.writeAuthorityEnrollment(candidate.enrollment, { storeRoot })) {
      throw new Error(`${label} authority ${candidate.id} enrollment setup failed`)
    }
    const blocked = command.runAuthorityCommand(["fetch", "github", "--json"], {
      artifactFetch: () => candidate.artifact,
      artifactInspector: () => assessment,
      projectDir: temporaryRoot,
      storeRoot,
    })
    const result = artifactStore.readAuthorityArtifact(candidate.enrollment.repositoryId, { storeRoot })
    if (
      blocked.status === 0
      || !blocked.stdout.includes(candidate.expectedState)
      || result.state !== "missing"
      || `${blocked.stdout}${blocked.stderr}`.includes("deterministic-binding-only")
    ) {
      throw new Error(`${label} authority ${candidate.id} mismatch retained evidence or reflected fixture state`)
    }
  }
  return assertAuthorityFetchChildBoundary(packageRoot, label, surface)
}

async function assertAuthorityFetchChildBoundary(packageRoot, label, surface) {
  const runtimeRoot = mkdtempSync(join(temporaryRoot, "authority-fetch-child-runtime-"))
  const projectDir = mkdtempSync(join(temporaryRoot, "authority-fetch-child-project-"))
  const childFixturePath = join(runtimeRoot, "authority-fetch-child-fixture.json")
  const childAuditPath = join(runtimeRoot, "authority-fetch-child-audit")
  const tokenMarker = "ghp_authority_fetch_child_probe"
  try {
    cpSync(join(packageRoot, "dist"), join(runtimeRoot, "dist"), { dereference: true, recursive: true })
    cpSync(join(packageRoot, "native"), join(runtimeRoot, "native"), { dereference: true, recursive: true })
    cpSync(join(packageRoot, "scripts"), join(runtimeRoot, "scripts"), { dereference: true, recursive: true })
    copyFileSync(join(packageRoot, "package.json"), join(runtimeRoot, "package.json"))
    writeAuthorityFetchChildWorker(runtimeRoot, childFixturePath, childAuditPath)
    writeFileSync(join(projectDir, "README.md"), "# authority fetch child boundary\n")
    initializeFixtureGit(projectDir, `${label} authority fetch child`, {
      email: "authority-fetch@example.invalid",
      message: "authority fetch child fixture",
      name: "Authority Fetch",
    })

    const moduleRoot = join(runtimeRoot, "dist", "cli")
    const [
      discoveryExercise,
      artifactStore,
      command,
      enrollmentStore,
      producer,
      version,
    ] = await Promise.all([
      import(pathToFileURL(join(runtimeRoot, "scripts", "consumer-authority-authority-discovery-exercise.mjs")).href),
      import(pathToFileURL(join(moduleRoot, "authority-artifact-store.js")).href),
      import(pathToFileURL(join(moduleRoot, "authority-command.js")).href),
      import(pathToFileURL(join(moduleRoot, "authority-enrollment.js")).href),
      import(pathToFileURL(join(moduleRoot, "project-finish-attestation-producer.js")).href),
      import(pathToFileURL(join(moduleRoot, "version.js")).href),
    ])
    const sourceHead = runCommand(projectDir, "git", ["rev-parse", "HEAD"]).stdout.trim()
    const enrollment = enrollmentStore.authorityEnrollmentFromReadback({
      callerWorkflowPath: MODELED_AUTHORITY_TOPOLOGY.callerWorkflowPath,
      repositoryId: MODELED_AUTHORITY_TOPOLOGY.repositoryId,
      repositorySlug: MODELED_AUTHORITY_TOPOLOGY.repositorySlug,
      reusableWorkflowSha: MODELED_AUTHORITY_TOPOLOGY.reusableWorkflowSha,
    })
    if (enrollment === undefined) throw new Error(`${label} authority child enrollment fixture did not parse`)
    const produced = producer.createProjectFinishAttestationProducerArtifacts({
      buildArtifactDigest: `sha256:${"a".repeat(64)}`,
      callerWorkflowRef: `${enrollment.repositorySlug}/.github/workflows/${enrollment.callerWorkflowPath}@refs/heads/main`,
      callerWorkflowSha: sourceHead,
      issuedAt: "2026-08-02T00:00:00.000Z",
      phVersion: version.personaHarnessVersion(),
      repository: { id: enrollment.repositoryId, slug: enrollment.repositorySlug, visibility: "public" },
      reusableWorkflowSha: enrollment.reusableWorkflowSha,
      runAttempt: 1,
      runId: "30470000000",
      source: {
        head: sourceHead,
        identity: {
          contentDigest: `sha256:${"b".repeat(64)}`,
          entryCount: 1,
          exclusions: [".git/**", ".gradle/**", "build/**", "node_modules/**", "<configured-evidence>/**"],
          gitStatusDigest: `sha256:${"c".repeat(64)}`,
          repositoryHead: sourceHead,
          schemaVersion: "source-identity.1",
          trackedEntryCount: 1,
          trackedIndexDigest: `sha256:${"d".repeat(64)}`,
          untrackedEntryCount: 0,
        },
        root: ".",
      },
      test: {
        count: 1,
        junitDigest: `sha256:${"e".repeat(64)}`,
        passed: 1,
        skipped: 0,
      },
    })
    const archive = authorityArtifactArchive({
      "bundle.json": Buffer.from(JSON.stringify(produced.statement), "utf8"),
      "predicate.json": Buffer.from(JSON.stringify(produced.predicate), "utf8"),
      "receipt.json": produced.receiptBytes,
    })
    const assessment = {
      authorityEligible: true,
      consumptionState: "unconsumed",
      decision: "trusted",
      diagnostics: [],
      receipt: produced.receipt,
      state: "trusted",
      summary: "modeled-authority-fetch-child",
    }
    const expectedInput = {
      callerWorkflowPath: enrollment.callerWorkflowPath,
      repositoryId: enrollment.repositoryId,
      repositorySlug: enrollment.repositorySlug,
      sourceHead,
    }

    writeAuthorityFetchChildFixture(childFixturePath, {
      expectedInput,
      output: JSON.stringify({
        archive: archive.toString("base64"),
        artifactDigest: `sha256:${sha256(archive)}`,
        artifactId: 710000017,
        ok: true,
        runId: "30470000000",
      }),
      status: 0,
    })
    const successStore = mkdtempSync(join(temporaryRoot, "authority-fetch-child-success-"))
    if (!enrollmentStore.writeAuthorityEnrollment(enrollment, { storeRoot: successStore })) {
      throw new Error(`${label} authority child success enrollment did not persist`)
    }
    const success = command.runAuthorityCommand(["fetch", "github", "--json"], {
      artifactInspector: () => assessment,
      githubToken: tokenMarker,
      projectDir,
      storeRoot: successStore,
    })
    const successPayload = JSON.parse(success.stdout)
    const childAudit = readAuthorityFetchChildAudit(childAuditPath)
    const successChecks = {
      child: childAudit === "valid",
      noDiagnostic: successPayload?.diagnostic === undefined,
      noProjectReflection: !`${success.stdout}${success.stderr}`.includes(projectDir),
      noTokenReflection: !`${success.stdout}${success.stderr}`.includes(tokenMarker),
      state: successPayload?.state === "trusted",
      status: success.status === 0,
      stored: artifactStore.readAuthorityArtifact(enrollment.repositoryId, { storeRoot: successStore }).state === "ready",
      unconsumed: successPayload?.consumptionState === "unconsumed",
    }
    if (!Object.values(successChecks).every(Boolean)) {
      throw new Error(`${label} authority child success check failed: ${JSON.stringify({ ...successChecks, childAudit })}`)
    }

    for (const diagnostic of [
      "authority-fetch-invalid",
      "authority-fetch-policy",
      "authority-fetch-evidence",
      "authority-fetch-network",
    ]) {
      writeAuthorityFetchChildFixture(childFixturePath, {
        expectedInput,
        output: JSON.stringify({ code: diagnostic, ok: false }),
        status: 1,
      })
      const storeRoot = mkdtempSync(join(temporaryRoot, `authority-fetch-child-${diagnostic}-`))
      if (!enrollmentStore.writeAuthorityEnrollment(enrollment, { storeRoot })) {
        throw new Error(`${label} authority child ${diagnostic} enrollment did not persist`)
      }
      const blocked = command.runAuthorityCommand(["fetch", "github", "--json"], {
        githubToken: tokenMarker,
        projectDir,
        storeRoot,
      })
      const payload = JSON.parse(blocked.stdout)
      if (
        blocked.status !== 1
        || payload?.state !== "missing"
        || payload?.diagnostic !== diagnostic
        || artifactStore.readAuthorityArtifact(enrollment.repositoryId, { storeRoot }).state !== "missing"
        || !hasAuthorityFetchChildAudit(childAuditPath)
        || `${blocked.stdout}${blocked.stderr}`.includes(tokenMarker)
        || `${blocked.stdout}${blocked.stderr}`.includes(projectDir)
      ) {
        throw new Error(`${label} authority child ${diagnostic} did not fail closed without reflection`)
      }
    }

    writeAuthorityFetchChildFixture(childFixturePath, {
      expectedInput,
      output: JSON.stringify({
        code: "authority-fetch-network",
        error: "authority-fetch-error-marker",
        ok: false,
        path: "/private/authority-fetch-path-marker",
        token: "authority-fetch-token-marker",
        url: "https://example.invalid/authority-fetch-url-marker",
      }),
      status: 1,
    })
    const malformedStore = mkdtempSync(join(temporaryRoot, "authority-fetch-child-malformed-"))
    if (!enrollmentStore.writeAuthorityEnrollment(enrollment, { storeRoot: malformedStore })) {
      throw new Error(`${label} authority child malformed enrollment did not persist`)
    }
    const malformed = command.runAuthorityCommand(["fetch", "github", "--json"], {
      githubToken: tokenMarker,
      projectDir,
      storeRoot: malformedStore,
    })
    const malformedPayload = JSON.parse(malformed.stdout)
    if (
      malformed.status !== 1
      || malformedPayload?.state !== "missing"
      || malformedPayload?.diagnostic !== undefined
      || artifactStore.readAuthorityArtifact(enrollment.repositoryId, { storeRoot: malformedStore }).state !== "missing"
      || !hasAuthorityFetchChildAudit(childAuditPath)
      || [
        "authority-fetch-error-marker",
        "/private/authority-fetch-path-marker",
        "authority-fetch-token-marker",
        "https://example.invalid/authority-fetch-url-marker",
      ].some((marker) => `${malformed.stdout}${malformed.stderr}`.includes(marker))
      || `${malformed.stdout}${malformed.stderr}`.includes(tokenMarker)
      || `${malformed.stdout}${malformed.stderr}`.includes(projectDir)
    ) {
      throw new Error(`${label} malformed authority child output did not remain non-reflective and missing`)
    }
    return discoveryExercise.createAuthorityDiscoveryExerciseResult(surface)
  } finally {
    rmSync(runtimeRoot, { force: true, recursive: true })
    rmSync(projectDir, { force: true, recursive: true })
  }
}

function writeAuthorityFetchChildWorker(runtimeRoot, fixturePath, auditPath) {
  writeFileSync(join(runtimeRoot, "scripts", "fetch-consumer-authority-artifact.mjs"), [
    'import { isAuthorityFetchChildEnvironmentBounded } from "./authority-fetch-child-environment.mjs";',
    'import { readFileSync, writeFileSync } from "node:fs";',
    'const chunks = [];',
    'process.stdin.on("data", (chunk) => chunks.push(chunk));',
    'process.stdin.on("end", () => {',
    `  const fixture = JSON.parse(readFileSync(${JSON.stringify(fixturePath)}, "utf8"));`,
    '  const actual = Buffer.concat(chunks).toString("utf8");',
    '  const environmentIsBounded = isAuthorityFetchChildEnvironmentBounded(process.env, process.platform);',
    `  if (actual !== JSON.stringify(fixture.expectedInput)) { writeFileSync(${JSON.stringify(auditPath)}, "input"); process.exitCode = 1; return; }`,
    `  if (!environmentIsBounded) { writeFileSync(${JSON.stringify(auditPath)}, "environment"); process.exitCode = 1; return; }`,
    `  writeFileSync(${JSON.stringify(auditPath)}, "valid");`,
    '  process.stdout.write(fixture.output);',
    '  process.exitCode = fixture.status;',
    '});',
    '',
  ].join("\n"))
}

function writeAuthorityFetchChildFixture(path, fixture) {
  writeFileSync(path, `${JSON.stringify(fixture)}\n`)
}

function hasAuthorityFetchChildAudit(path) {
  return readAuthorityFetchChildAudit(path) === "valid"
}

function readAuthorityFetchChildAudit(path) {
  if (!existsSync(path)) return "absent"
  const value = readFileSync(path, "utf8")
  return ["environment", "input", "valid"].includes(value) ? value : "invalid"
}

function boundedAuthorityFetchResult(value) {
  try {
    const parsed = JSON.parse(value)
    if (!isRecord(parsed)) return "invalid"
    const state = typeof parsed.state === "string" ? parsed.state : "invalid"
    const diagnostic = [
      "authority-fetch-evidence",
      "authority-fetch-invalid",
      "authority-fetch-network",
      "authority-fetch-policy",
    ].includes(parsed.diagnostic)
      ? parsed.diagnostic
      : undefined
    return diagnostic === undefined ? { state } : { diagnostic, state }
  } catch {
    return "invalid"
  }
}

function modeledAuthorityDiscoveryResponse(url, archive, enrollment, sourceHead) {
  if (url.pathname === `/repositories/${enrollment.repositoryId}`) {
    return {
      full_name: enrollment.repositorySlug,
      id: enrollment.repositoryId,
      private: false,
      visibility: "public",
    }
  }
  if (url.pathname.endsWith("/runs")) {
    return {
      total_count: 1,
      workflow_runs: [{
        conclusion: "success",
        event: "push",
        head_branch: "main",
        head_repository: { full_name: enrollment.repositorySlug, id: enrollment.repositoryId },
        head_sha: sourceHead,
        id: MODELED_CURRENT_RUN_ID,
        repository: { full_name: enrollment.repositorySlug, id: enrollment.repositoryId },
        status: "completed",
      }],
    }
  }
  if (url.pathname.endsWith("/artifacts")) {
    return {
      artifacts: [{
        digest: `sha256:${sha256(archive)}`,
        expired: false,
        id: MODELED_CURRENT_ARTIFACT_ID,
        name: "project-finish-attestation",
        size_in_bytes: archive.byteLength,
        workflow_run: {
          head_branch: "main",
          head_repository_id: enrollment.repositoryId,
          head_sha: sourceHead,
          id: MODELED_CURRENT_RUN_ID,
          repository_id: enrollment.repositoryId,
        },
      }],
      total_count: 1,
    }
  }
  throw new Error("modeled authority discovery requested an unexpected endpoint")
}

function authorityArtifactArchive(members) {
  const localParts = []
  const centralParts = []
  let offset = 0
  for (const [name, bytes] of Object.entries(members)) {
    const encodedName = Buffer.from(name, "utf8")
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt32LE(bytes.byteLength, 18)
    local.writeUInt32LE(bytes.byteLength, 22)
    local.writeUInt16LE(encodedName.byteLength, 26)
    localParts.push(local, encodedName, bytes)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt32LE(bytes.byteLength, 20)
    central.writeUInt32LE(bytes.byteLength, 24)
    central.writeUInt16LE(encodedName.byteLength, 28)
    central.writeUInt32LE(offset, 42)
    centralParts.push(central, encodedName)
    offset += local.byteLength + encodedName.byteLength + bytes.byteLength
  }
  const directory = Buffer.concat(centralParts)
  const footer = Buffer.alloc(22)
  footer.writeUInt32LE(0x06054b50, 0)
  footer.writeUInt16LE(Object.keys(members).length, 8)
  footer.writeUInt16LE(Object.keys(members).length, 10)
  footer.writeUInt32LE(directory.byteLength, 12)
  footer.writeUInt32LE(offset, 16)
  return Buffer.concat([...localParts, directory, footer])
}

function sameStrings(value, expected) {
  return Array.isArray(value)
    && value.length === expected.length
    && value.every((entry, index) => entry === expected[index])
}

function createProjectFinishProducerFixture(projectDir, profileMode) {
  mkdirSync(join(projectDir, "src", "main", "java"), { recursive: true })
  writeFileSync(join(projectDir, "build.gradle"), "plugins { id 'java' }\n")
  writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'project-finish-producer'\n")
  writeFileSync(join(projectDir, "src", "main", "java", "App.java"), "class App {}\n")
  writeFileSync(
    join(projectDir, "gradlew"),
    [
      "#!/bin/sh",
      "case \"$*\" in",
      "  *cleanTest*)",
      "    mkdir -p build/test-results/test",
      "    printf '%s\\n' '<testsuite tests=\"1\" failures=\"0\" errors=\"0\" skipped=\"0\"><testcase name=\"works\"/></testsuite>' > build/test-results/test/TEST-producer.xml",
      "    printf '%s\\n' '> Task :cleanTest' '> Task :test' 'BUILD SUCCESSFUL'",
      "    ;;",
      "  *)",
      "    printf '%s\\n' '> Task :build' 'BUILD SUCCESSFUL'",
      "    ;;",
      "esac",
      "",
    ].join("\n"),
  )
  chmodSync(join(projectDir, "gradlew"), 0o755)
  if (profileMode === "symlink-profile") {
    const profileDirectory = join(projectDir, ".persona")
    const outside = join(projectDir, "outside-profile.jsonc")
    mkdirSync(profileDirectory)
    writeFileSync(outside, '{"marker":"sk-live-aaaaaaaaaaaaaaaaaaaaaaaa"}\n')
    symlinkSync(outside, join(profileDirectory, "project-profile.jsonc"))
  }
  if (profileMode === "replace-profile") {
    const profileDirectory = join(projectDir, ".persona")
    mkdirSync(profileDirectory)
    writeFileSync(
      join(profileDirectory, "project-profile.jsonc"),
      `${JSON.stringify({ ...cooperativeProfile(), status: "draft" })}\n`,
    )
    writeFileSync(
      `${projectDir}-outside-profile.jsonc`,
      `${JSON.stringify({ marker: "sk-live-aaaaaaaaaaaaaaaaaaaaaaaa", ...cooperativeProfile() })}\n`,
    )
  }
  if (profileMode === "canonical-profile") {
    const profileDirectory = join(projectDir, ".persona")
    mkdirSync(profileDirectory)
    writeFileSync(join(profileDirectory, "project-profile.jsonc"), `${JSON.stringify(cooperativeProfile())}\n`)
  }
  if (profileMode === "replace-profile-parent") {
    const profileDirectory = join(projectDir, ".persona")
    const outside = `${projectDir}-outside-persona`
    mkdirSync(profileDirectory)
    mkdirSync(outside)
    writeFileSync(
      join(profileDirectory, "project-profile.jsonc"),
      `${JSON.stringify(cooperativeProfile())}\n`,
    )
    writeFileSync(
      join(outside, "project-profile.jsonc"),
      `${JSON.stringify({ marker: "sk-live-aaaaaaaaaaaaaaaaaaaaaaaa", ...cooperativeProfile() })}\n`,
    )
  }
  initializeFixtureGit(projectDir, "installed producer fixture", {
    email: "ph@example.invalid",
    message: "producer fixture",
    name: "PH Test",
  })
}

function initializeFixtureGit(projectDir, label, { autoCrlf, email, message, name }) {
  requireSuccess(`${label} Git init`, runCommand(projectDir, "git", ["init", "-q"]))
  requireSuccess(`${label} Git disable automatic gc`, runCommand(projectDir, "git", ["config", "gc.auto", "0"]))
  requireSuccess(`${label} Git disable automatic maintenance`, runCommand(projectDir, "git", ["config", "maintenance.auto", "false"]))
  requireSuccess(`${label} Git email`, runCommand(projectDir, "git", ["config", "user.email", email]))
  requireSuccess(`${label} Git name`, runCommand(projectDir, "git", ["config", "user.name", name]))
  if (autoCrlf !== undefined) {
    requireSuccess(`${label} Git autocrlf`, runCommand(projectDir, "git", ["config", "core.autocrlf", autoCrlf]))
  }
  requireSuccess(`${label} Git add`, runCommand(projectDir, "git", ["add", "."]))
  requireSuccess(`${label} Git commit`, runCommand(projectDir, "git", ["commit", "-qm", message]))
  requireFixtureGitConfig(projectDir, label, "gc.auto", "0")
  requireFixtureGitConfig(projectDir, label, "maintenance.auto", "false")
}

function requireFixtureGitConfig(projectDir, label, key, expected) {
  const result = runCommand(projectDir, "git", ["config", "--get", key])
  if (result.status !== 0 || result.stdout !== `${expected}\n`) {
    throw new Error(`${label} Git fixture lifecycle configuration failed`)
  }
}

function cooperativeProfile() {
  return {
    defaults: { buildTool: "gradle", framework: "spring", language: "java" },
    questions: [
      { answer: "ko", id: "user-language" },
      { answer: "team", id: "project-context" },
      { answer: "production-service", id: "project-goal" },
      { answer: "long-lived", id: "project-scale" },
      { answer: "rest-api", id: "application-type" },
      { answer: "memory", id: "storage" },
      { answer: "none", id: "persistence-technology" },
      { answer: "none", id: "migration-style" },
      { answer: "domain-first", id: "package-style" },
      { answer: "clean-architecture-light", id: "architecture-style" },
      { answer: "strict", id: "boundary-strictness" },
    ],
    schema: "persona.project-profile.v1",
    scope: { mvp: "java-spring-clean-code", role: "backend" },
    status: "ready",
  }
}

function runNpm(cwd, args) {
  const result = spawnSync("npm", args, {
    cwd,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 4 * 1024 * 1024,
  })
  if (result.error) {
    throw new Error("npm process could not start")
  }
  return {
    status: result.status,
    stdout: result.stdout ?? "",
  }
}

function runBoundNpm(cwd, args) {
  const result = spawnSync("npm", args, {
    cwd,
    encoding: "utf8",
    env: boundNpmEnvironment(),
    maxBuffer: 4 * 1024 * 1024,
  })
  if (result.error) {
    throw new Error("bound npm process could not start")
  }
  return {
    status: result.status,
    stdout: result.stdout ?? "",
  }
}

function boundNpmEnvironment() {
  const home = join(temporaryRoot, "bound-npm-home")
  const userConfig = join(temporaryRoot, "bound-npm-userconfig")
  const globalConfig = join(temporaryRoot, "bound-npm-globalconfig")
  if (!existsSync(home)) mkdirSync(home)
  if (!existsSync(consumerNpmCache)) mkdirSync(consumerNpmCache)
  if (!existsSync(userConfig)) writeFileSync(userConfig, "")
  if (!existsSync(globalConfig)) writeFileSync(globalConfig, "")
  return {
    HOME: home,
    NPM_CONFIG_AUDIT: "false",
    NPM_CONFIG_CACHE: consumerNpmCache,
    NPM_CONFIG_FUND: "false",
    NPM_CONFIG_GLOBALCONFIG: globalConfig,
    NPM_CONFIG_IGNORE_SCRIPTS: "false",
    NPM_CONFIG_INCLUDE_WORKSPACE_ROOT: "false",
    NPM_CONFIG_UPDATE_NOTIFIER: "false",
    NPM_CONFIG_USERCONFIG: userConfig,
    NPM_CONFIG_WORKSPACES: "false",
    PATH: process.env.PATH ?? "",
    TMPDIR: temporaryRoot,
    USER: "persona",
  }
}

function runCommand(cwd, command, args, options = {}) {
  const environment = command === "git" ? boundedGitEnvironment() : process.env
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...environment, ...(options.environment ?? {}) },
    maxBuffer: 16 * 1024 * 1024,
    ...(options.timeoutMs === undefined ? {} : { killSignal: "SIGTERM", timeout: options.timeoutMs }),
  })
  if (result.error) {
    if (result.error.code === "ETIMEDOUT") {
      return {
        status: 124,
        stdout: result.stdout ?? "",
      }
    }
    throw new Error(`${command} process could not start`)
  }
  return {
    status: result.status,
    stdout: result.stdout ?? "",
  }
}

function runNode(cwd, args, environment = {}, input) {
  const result = spawnSync(process.execPath, args, {
    cwd,
    encoding: "utf8",
    env: { ...boundedGitEnvironment(), ...environment },
    input,
    maxBuffer: 4 * 1024 * 1024,
  })
  if (result.error) {
    throw new Error("node process could not start")
  }
  return {
    status: result.status,
    stderr: result.stderr ?? "",
    stdout: result.stdout ?? "",
  }
}

function boundedGitEnvironment() {
  const home = join(temporaryRoot, "bound-git-home")
  const globalConfig = join(temporaryRoot, "bound-git-globalconfig")
  if (!existsSync(home)) mkdirSync(home)
  if (!existsSync(globalConfig)) writeFileSync(globalConfig, "")
  const inherited = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
  )
  return {
    ...inherited,
    GIT_CONFIG_GLOBAL: globalConfig,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_TERMINAL_PROMPT: "0",
  }
}

function runObserverPreflightNode(cwd, args, environment) {
  const result = spawnSync(process.execPath, args, {
    cwd,
    encoding: "utf8",
    env: environment,
    maxBuffer: 4 * 1024 * 1024,
  })
  if (result.error) {
    throw new Error("observer preflight node process could not start")
  }
  return {
    status: result.status,
    stderr: result.stderr ?? "",
    stdout: result.stdout ?? "",
  }
}

function requireSuccess(label, result) {
  if (result.status !== 0) {
    throw new Error(`${label} failed`)
  }
}

function boundedProducerIntakeDiagnostic(output) {
  const match = /^project-finish-producer-intake:([a-z-]+(?:,[a-z-]+){3})$/mu.exec(output)
  const allowed = new Set([
    "passed",
    "project-finish-producer-binding",
    "project-finish-producer-profile",
    "source-identity-symlink",
    "source-read-runtime-unavailable",
    "workspace-root-unavailable",
  ])
  if (match === null || !match[1].split(",").every((code) => allowed.has(code))) {
    return "unavailable"
  }
  return `project-finish-producer-intake:${match[1]}`
}

function boundedActionTopologyDiagnostic(result) {
  const text = `${result.stdout}${result.stderr}`
  for (const code of [
    "project-finish-producer-workspace",
    "project-finish-producer-checkout",
    "project-finish-producer-context",
    "project-finish-producer-profile",
    "workspace-root-unavailable",
    "source-read-runtime-unavailable",
  ]) {
    if (text.includes(code)) return code
  }
  const outcome = /^project-finish-producer-action-topology:([a-z-]+)$/mu.exec(text)?.[1]
  if (outcome !== undefined) return outcome
  return `exit-${String(result.status)}`
}

function resolvePackResult(output, packDirectory, identity) {
  const parsed = JSON.parse(output)
  if (!Array.isArray(parsed) || parsed.length !== 1 || !isRecord(parsed[0]) || typeof parsed[0].filename !== "string") {
    throw new TypeError("npm pack did not return exactly one tarball")
  }

  const record = parsed[0]
  assertPackRecordBinding(record, identity)
  const filename = record.filename
  const candidate = isAbsolute(filename)
    ? filename
    : join(packDirectory, basename(filename))
  const relativeCandidate = relative(packDirectory, candidate)
  if (relativeCandidate === "" || relativeCandidate.startsWith(`..${sep}`) || isAbsolute(relativeCandidate)) {
    throw new TypeError("npm pack returned a tarball outside the pack directory")
  }
  if (!existsSync(candidate)) {
    throw new TypeError("npm pack tarball is missing")
  }
  if (!Array.isArray(record.files)) {
    throw new TypeError("npm pack omitted the package path set")
  }
  const paths = record.files.map((file) => {
    if (!isRecord(file) || typeof file.path !== "string" || file.path.length === 0) {
      throw new TypeError("npm pack returned an invalid package path")
    }
    return file.path
  }).sort()
  const canonical = canonicalizePackageTarball(readFileSync(candidate))
  const canonicalDirectory = join(packDirectory, "canonical")
  mkdirSync(canonicalDirectory, { mode: 0o700 })
  const canonicalPath = join(canonicalDirectory, `${identity.name}-${identity.version}.tgz`)
  writeCanonicalTarball(canonicalPath, canonical.bytes)
  return {
    facts: {
      filename: basename(canonicalPath),
      fileCount: paths.length,
      integrity: typeof record.integrity === "string" ? record.integrity : "unavailable",
      packagePathSetSha256: sha256(Buffer.from(`${paths.join("\n")}\n`, "utf8")),
      packageContentIdentity: canonical.identity,
      shasum: typeof record.shasum === "string" ? record.shasum : "unavailable",
      size: canonical.bytes.byteLength,
      tarballSha256: sha256(canonical.bytes),
      version: identity.version,
    },
    tarballPath: canonicalPath,
  }
}

function writeCanonicalTarball(path, bytes) {
  let descriptor
  try {
    descriptor = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
    let offset = 0
    while (offset < bytes.byteLength) {
      const written = writeSync(descriptor, bytes, offset, bytes.byteLength - offset)
      if (written <= 0) throw new Error("write")
      offset += written
    }
  } catch {
    throw new Error("installed package canonical tarball write failed")
  } finally {
    if (descriptor !== undefined) closeSync(descriptor)
  }
  const stat = lstatSync(path)
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== bytes.byteLength) {
    throw new Error("installed package canonical tarball write failed")
  }
}

function readSourcePackIdentity() {
  return assertSourcePackageIdentity(
    JSON.parse(readFileSync(join(repositoryRoot, "package.json"), "utf8")),
    JSON.parse(readFileSync(join(repositoryRoot, "package-lock.json"), "utf8")),
  )
}

function assertSourcePackManifest() {
  const packageBytes = readFileSync(join(repositoryRoot, "package.json"))
  const lockBytes = readFileSync(join(repositoryRoot, "package-lock.json"))
  const headPackage = runCommand(repositoryRoot, "git", ["show", "HEAD:package.json"])
  const headLock = runCommand(repositoryRoot, "git", ["show", "HEAD:package-lock.json"])
  requireSuccess("source package manifest Git binding", headPackage)
  requireSuccess("source package lock Git binding", headLock)
  if (
    sha256(packageBytes) !== sha256(Buffer.from(headPackage.stdout, "utf8"))
    || sha256(lockBytes) !== sha256(Buffer.from(headLock.stdout, "utf8"))
  ) {
    throw new Error("source package manifest differs from HEAD")
  }
}

async function* bufferAsyncIterable(bytes) {
  yield bytes
}

async function* emptyAsyncIterable() {
  // A redirect response must not supply artifact bytes to the next request.
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex")
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseContractOptions(args) {
  let observerGh
  let packageAcceptance = false
  let packageExercise = false
  let producerIntakeOnly = false
  let sourceCli
  let tarball
  let tarballContentIdentity
  let tarballSha256
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === "--producer-intake-only" && !producerIntakeOnly) {
      producerIntakeOnly = true
      continue
    }
    if (argument === "--package-acceptance" && !packageAcceptance) {
      packageAcceptance = true
      continue
    }
    if (argument === "--package-exercise" && !packageExercise) {
      packageExercise = true
      continue
    }
    if (argument === "--observer-gh" && observerGh === undefined && typeof args[index + 1] === "string" && args[index + 1].startsWith("/") && !args[index + 1].includes("\0")) {
      observerGh = args[index + 1]
      index += 1
      continue
    }
    if (argument === "--source-cli" && sourceCli === undefined && typeof args[index + 1] === "string" && args[index + 1].trim() !== "") {
      sourceCli = args[index + 1]
      index += 1
      continue
    }
    if (argument === "--tarball" && tarball === undefined && typeof args[index + 1] === "string" && args[index + 1].trim() !== "") {
      tarball = args[index + 1]
      index += 1
      continue
    }
    if (argument === "--tarball-sha256" && tarballSha256 === undefined && typeof args[index + 1] === "string" && /^[0-9a-f]{64}$/u.test(args[index + 1])) {
      tarballSha256 = args[index + 1]
      index += 1
      continue
    }
    if (argument === "--tarball-content-identity" && tarballContentIdentity === undefined && typeof args[index + 1] === "string" && /^[0-9a-f]{64}$/u.test(args[index + 1])) {
      tarballContentIdentity = args[index + 1]
      index += 1
      continue
    }
    throw new TypeError("usage: node scripts/test-installed-package-contract.mjs (--observer-gh /absolute/gh | --package-acceptance) [--package-exercise] [--producer-intake-only] [--source-cli dist/cli/index.js] [--tarball /absolute/package.tgz --tarball-sha256 <sha256> --tarball-content-identity <sha256>]")
  }
  if (sourceCli !== undefined && tarball !== undefined) {
    throw new TypeError("source CLI and tarball modes are exclusive")
  }
  if (
    (tarball === undefined) !== (tarballSha256 === undefined)
    || (tarball === undefined) !== (tarballContentIdentity === undefined)
  ) {
    throw new TypeError("tarball identity is required")
  }
  if (packageExercise && producerIntakeOnly) {
    throw new TypeError("package exercise and producer intake only are exclusive")
  }
  if (
    packageAcceptance
    && (observerGh !== undefined || packageExercise || producerIntakeOnly || sourceCli !== undefined)
  ) {
    throw new TypeError("package acceptance cannot claim CI observer proof")
  }
  if (!producerIntakeOnly && !packageAcceptance && observerGh === undefined) {
    throw new TypeError("explicit observer gh path is required")
  }
  return {
    observerGh,
    packageAcceptance,
    packageExercise,
    producerIntakeOnly,
    sourceCli,
    tarball,
    tarballContentIdentity,
    tarballSha256,
  }
}
