import { realpathSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { profileDigest } from "./init-source.js"
import { parseOpencodeConfigBytes } from "./init-source.js"
import {
  createInitManifest,
  INIT_MANIFEST_RELATIVE_PATH,
  InitManifestError,
  parseInitManifestBytes,
  sha256Bytes,
  type InitManifest,
} from "./init-manifest.js"
import { verifyInitOwnership } from "./init-ownership.js"
import { commitInitPlan } from "./init-transaction.js"
import { readSnapshot, sameSnapshot, type FileSnapshot } from "./init-transaction-io.js"
import {
  activePersonaHarnessPluginIndex,
  isVersionedNpmPackageVersion,
  OPENCODE_CONFIG_PATH,
  PERSONA_HARNESS_PACKAGE_NAME,
  personaAutoUpdateState,
  readOpenCodePluginEntries,
  serializeOpenCodePluginEntries,
  withPersonaAutoUpdate,
  withPluginSpecifier,
  type OpenCodePluginEntry,
} from "./opencode-plugin-config.js"
import { packageBinding } from "./init-source.js"
import type { CliRunResult } from "./bearshell.js"

const PROJECT_AUTO_UPDATE_SCHEMA = "project-auto-update.1"
const STABLE_VERSION_PATTERN = /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/u

type ProjectAutoUpdateBlockReason =
  | "configuration-invalid"
  | "not-enabled"
  | "ownership-unavailable"
  | "registry-invalid"
  | "registry-unavailable"
  | "stale-plugin"
  | "unconfigured"
  | "write-failed"

export type ProjectAutoUpdateRegistryResult =
  | { readonly kind: "available"; readonly version: string }
  | { readonly kind: "unavailable" }

export type ProjectAutoUpdateResult =
  | { readonly kind: "blocked"; readonly reason: ProjectAutoUpdateBlockReason }
  | { readonly kind: "current" }
  | { readonly kind: "updated"; readonly version: string }

export type ProjectAutoUpdateOptions = {
  readonly installedVersion: string
  readonly projectDir: string
  readonly readLatestVersion: () => Promise<ProjectAutoUpdateRegistryResult>
}

export type ProjectAutoUpdateStatus = {
  readonly configuredVersion?: string
  readonly state: "disabled" | "enabled" | "invalid" | "unconfigured"
}

type OwnedProjectAutoUpdate = {
  readonly config: Record<string, unknown>
  readonly configSnapshot: FileSnapshot
  readonly entries: readonly OpenCodePluginEntry[]
  readonly manifest: InitManifest
  readonly manifestSnapshot: FileSnapshot
  readonly projectDir: string
}

type OwnedProjectAutoUpdateResult =
  | { readonly kind: "blocked"; readonly reason: "configuration-invalid" | "ownership-unavailable" }
  | { readonly kind: "ready"; readonly value: OwnedProjectAutoUpdate }

type UpdateCommand =
  | { readonly kind: "disable" }
  | { readonly kind: "enable" }
  | { readonly kind: "status"; readonly json: boolean }
  | { readonly kind: "invalid"; readonly message: string }

function defaultPackageRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")
}

function stableVersion(value: string): boolean {
  return STABLE_VERSION_PATTERN.test(value)
}

function configuredVersion(entry: OpenCodePluginEntry): string | undefined {
  const prefix = `${PERSONA_HARNESS_PACKAGE_NAME}@`
  const specifier = entry.specifier.trim()
  if (!specifier.startsWith(prefix)) {
    return undefined
  }
  const version = specifier.slice(prefix.length)
  return isVersionedNpmPackageVersion(version) ? version : undefined
}

function compareVersionComponent(left: string, right: string): number {
  if (left.length !== right.length) {
    return left.length < right.length ? -1 : 1
  }
  return left === right ? 0 : left < right ? -1 : 1
}

function compareStableVersions(left: string, right: string): number {
  const leftParts = left.split(".")
  const rightParts = right.split(".")
  for (let index = 0; index < 3; index += 1) {
    const comparison = compareVersionComponent(leftParts[index] ?? "", rightParts[index] ?? "")
    if (comparison !== 0) {
      return comparison
    }
  }
  return 0
}

function readStatusFromConfig(config: Record<string, unknown>): ProjectAutoUpdateStatus {
  const entries = readOpenCodePluginEntries(config.plugin)
  if (entries === undefined) {
    return { state: "invalid" }
  }
  const activeIndex = activePersonaHarnessPluginIndex(entries)
  if (activeIndex === undefined) {
    return { state: "unconfigured" }
  }
  const active = entries[activeIndex]
  if (active === undefined) {
    return { state: "invalid" }
  }
  const version = configuredVersion(active)
  if (version === undefined || !stableVersion(version)) {
    return { state: "invalid" }
  }
  const autoUpdate = personaAutoUpdateState(active)
  switch (autoUpdate) {
    case "enabled":
      return { configuredVersion: version, state: "enabled" }
    case "disabled":
      return { configuredVersion: version, state: "disabled" }
    case "invalid":
      return { configuredVersion: version, state: "invalid" }
    default:
      return assertNever(autoUpdate)
  }
}

export function readProjectAutoUpdateStatus(projectDir: string): ProjectAutoUpdateStatus {
  try {
    const snapshot = readSnapshot(resolve(projectDir), OPENCODE_CONFIG_PATH)
    if (snapshot.bytes === null) {
      return { state: "unconfigured" }
    }
    return readStatusFromConfig(parseOpencodeConfigBytes(snapshot.bytes))
  } catch {
    return { state: "invalid" }
  }
}

function readOwnedProjectAutoUpdate(projectDir: string): OwnedProjectAutoUpdateResult {
  try {
    const resolvedProjectDir = resolve(projectDir)
    const configSnapshot = readSnapshot(resolvedProjectDir, OPENCODE_CONFIG_PATH)
    const manifestSnapshot = readSnapshot(resolvedProjectDir, INIT_MANIFEST_RELATIVE_PATH)
    if (configSnapshot.bytes === null || manifestSnapshot.bytes === null) {
      return { kind: "blocked", reason: "ownership-unavailable" }
    }
    const config = parseOpencodeConfigBytes(configSnapshot.bytes)
    const entries = readOpenCodePluginEntries(config.plugin)
    if (entries === undefined) {
      return { kind: "blocked", reason: "configuration-invalid" }
    }
    const manifest = parseInitManifestBytes(manifestSnapshot.bytes)
    const verified = verifyInitOwnership(manifest, {
      ownedFileCheck: { kind: "exact" },
      profileBinding: { kind: "exact", digest: profileDigest(resolvedProjectDir) },
      projectRealPath: realpathSync(resolvedProjectDir),
      readOwnedFile: (relativePath) => readSnapshot(resolvedProjectDir, relativePath).bytes ?? undefined,
    })
    if (!verified.ownedFiles.has(OPENCODE_CONFIG_PATH)) {
      return { kind: "blocked", reason: "ownership-unavailable" }
    }
    return {
      kind: "ready",
      value: {
        config,
        configSnapshot,
        entries,
        manifest,
        manifestSnapshot,
        projectDir: resolvedProjectDir,
      },
    }
  } catch {
    return { kind: "blocked", reason: "ownership-unavailable" }
  }
}

function commitPluginEntries(
  prepared: OwnedProjectAutoUpdate,
  entries: readonly OpenCodePluginEntry[],
): "changed" | "no-op" | "failed" {
  const nextConfig = { ...prepared.config, plugin: serializeOpenCodePluginEntries(entries) }
  const nextBytes = Buffer.from(`${JSON.stringify(nextConfig, null, 2)}\n`, "utf8")
  if (prepared.configSnapshot.bytes === null || nextBytes.equals(prepared.configSnapshot.bytes)) {
    return "no-op"
  }
  const nextManifest = createInitManifest(
    prepared.manifest.package,
    prepared.manifest.project,
    prepared.manifest.files.map((entry) => entry.path === OPENCODE_CONFIG_PATH
      ? { ...entry, digest: sha256Bytes(nextBytes) }
      : entry),
  )
  try {
    const transaction = commitInitPlan(
      prepared.projectDir,
      [{ nextBytes, relativePath: OPENCODE_CONFIG_PATH }],
      nextManifest,
      prepared.manifest,
      {
        onBeforeCommit: () => {
          if (!sameSnapshot(prepared.configSnapshot) || !sameSnapshot(prepared.manifestSnapshot)) {
            throw new InitManifestError("Project update target changed before commit; no files were changed.")
          }
        },
      },
    )
    return transaction.decision === "apply" ? "changed" : transaction.decision === "no-op" ? "no-op" : "failed"
  } catch {
    return "failed"
  }
}

function activeOwnedPlugin(prepared: OwnedProjectAutoUpdate):
  | { readonly kind: "blocked"; readonly reason: "configuration-invalid" | "unconfigured" }
  | { readonly kind: "ready"; readonly entry: OpenCodePluginEntry; readonly index: number } {
  const index = activePersonaHarnessPluginIndex(prepared.entries)
  if (index === undefined) {
    return { kind: "blocked", reason: "unconfigured" }
  }
  const entry = prepared.entries[index]
  if (entry === undefined || personaAutoUpdateState(entry) === "invalid") {
    return { kind: "blocked", reason: "configuration-invalid" }
  }
  return { kind: "ready", entry, index }
}

function replaceEntry(
  entries: readonly OpenCodePluginEntry[],
  index: number,
  replacement: OpenCodePluginEntry,
): readonly OpenCodePluginEntry[] {
  return entries.map((entry, candidateIndex) => candidateIndex === index ? replacement : entry)
}

function packageVersion(packageRoot: string): string | undefined {
  try {
    const version = packageBinding(packageRoot, "").version
    return stableVersion(version) ? version : undefined
  } catch {
    return undefined
  }
}

function updateUsage(invocationName: string): string {
  return [
    `Usage: ${invocationName} update <status|enable|disable> [--yes] [--json]`,
    "",
    "Enable project-local automatic Persona Harness updates without changing workflow, rules, or profile files.",
    "A newer stable package is staged for the next OpenCode session only.",
  ].join("\n")
}

function parseUpdateCommand(args: readonly string[]): UpdateCommand {
  const [command, ...rest] = args
  if (command === "status") {
    return rest.length === 0
      ? { json: false, kind: "status" }
      : rest.length === 1 && rest[0] === "--json"
        ? { json: true, kind: "status" }
        : { kind: "invalid", message: "Unknown update status option." }
  }
  if (command === "enable" || command === "disable") {
    return rest.length === 1 && rest[0] === "--yes"
      ? { kind: command }
      : { kind: "invalid", message: `Explicit confirmation is required: update ${command} --yes.` }
  }
  return { kind: "invalid", message: "Unknown update command." }
}

function formatStatus(status: ProjectAutoUpdateStatus): string {
  return [
    "Persona Harness project auto-update",
    `State: ${status.state}`,
    ...(status.configuredVersion === undefined ? [] : [`Configured version: ${status.configuredVersion}`]),
    "Scope: the active OpenCode plugin pin only; a staged update applies to the next session.",
  ].join("\n")
}

function enableOrDisableProjectAutoUpdate(
  projectDir: string,
  enabled: boolean,
  packageRoot: string,
): { readonly kind: "blocked"; readonly reason: ProjectAutoUpdateBlockReason } | { readonly kind: "changed" | "no-op"; readonly version: string } {
  const preparedResult = readOwnedProjectAutoUpdate(projectDir)
  if (preparedResult.kind === "blocked") {
    return preparedResult
  }
  const activeResult = activeOwnedPlugin(preparedResult.value)
  if (activeResult.kind === "blocked") {
    return activeResult
  }
  const activeVersion = configuredVersion(activeResult.entry)
  const nextVersion = enabled ? packageVersion(packageRoot) : activeVersion
  if (nextVersion === undefined) {
    return { kind: "blocked", reason: enabled ? "configuration-invalid" : "unconfigured" }
  }
  const normalizedEntry = withPluginSpecifier(activeResult.entry, `${PERSONA_HARNESS_PACKAGE_NAME}@${nextVersion}`)
  const replacement = withPersonaAutoUpdate(normalizedEntry, enabled)
  const transaction = commitPluginEntries(
    preparedResult.value,
    replaceEntry(preparedResult.value.entries, activeResult.index, replacement),
  )
  return transaction === "failed"
    ? { kind: "blocked", reason: "write-failed" }
    : { kind: transaction, version: nextVersion }
}

export function runProjectAutoUpdateCommand(
  args: readonly string[],
  options: { readonly packageRoot?: string; readonly projectDir?: string } = {},
  invocationName = "ph",
): CliRunResult {
  const command = parseUpdateCommand(args)
  if (command.kind === "invalid") {
    return { status: 1, stdout: "", stderr: `${command.message}\n\n${updateUsage(invocationName)}\n` }
  }
  const projectDir = resolve(options.projectDir ?? process.cwd())
  if (command.kind === "status") {
    const status = readProjectAutoUpdateStatus(projectDir)
    if (command.json) {
      return {
        status: status.state === "invalid" ? 1 : 0,
        stdout: `${JSON.stringify({
          ...(status.configuredVersion === undefined ? {} : { configuredVersion: status.configuredVersion }),
          schemaVersion: PROJECT_AUTO_UPDATE_SCHEMA,
          state: status.state,
        }, null, 2)}\n`,
        stderr: "",
      }
    }
    return { status: status.state === "invalid" ? 1 : 0, stdout: `${formatStatus(status)}\n`, stderr: "" }
  }
  const result = enableOrDisableProjectAutoUpdate(
    projectDir,
    command.kind === "enable",
    resolve(options.packageRoot ?? defaultPackageRoot()),
  )
  if (result.kind === "blocked") {
    return {
      status: 1,
      stdout: "",
      stderr: `Project auto-update is blocked (${result.reason}); no files were changed.\n`,
    }
  }
  const action = command.kind === "enable" ? "enabled" : "disabled"
  return {
    status: 0,
    stdout: result.kind === "changed"
      ? `Project auto-update ${action} for ${PERSONA_HARNESS_PACKAGE_NAME}@${result.version}.\n`
      : `Project auto-update is already ${action}.\n`,
    stderr: "",
  }
}

export async function applyProjectAutoUpdate(options: ProjectAutoUpdateOptions): Promise<ProjectAutoUpdateResult> {
  if (!stableVersion(options.installedVersion)) {
    return { kind: "blocked", reason: "configuration-invalid" }
  }
  const preparedResult = readOwnedProjectAutoUpdate(options.projectDir)
  if (preparedResult.kind === "blocked") {
    return preparedResult
  }
  const activeResult = activeOwnedPlugin(preparedResult.value)
  if (activeResult.kind === "blocked") {
    return activeResult
  }
  const activeVersion = configuredVersion(activeResult.entry)
  if (personaAutoUpdateState(activeResult.entry) !== "enabled") {
    return { kind: "blocked", reason: "not-enabled" }
  }
  if (activeVersion === undefined || activeVersion !== options.installedVersion) {
    return { kind: "blocked", reason: "stale-plugin" }
  }
  let latest: ProjectAutoUpdateRegistryResult
  try {
    latest = await options.readLatestVersion()
  } catch {
    return { kind: "blocked", reason: "registry-unavailable" }
  }
  if (latest.kind === "unavailable") {
    return { kind: "blocked", reason: "registry-unavailable" }
  }
  if (!stableVersion(latest.version)) {
    return { kind: "blocked", reason: "registry-invalid" }
  }
  if (compareStableVersions(latest.version, options.installedVersion) <= 0) {
    return { kind: "current" }
  }
  const replacement = withPluginSpecifier(activeResult.entry, `${PERSONA_HARNESS_PACKAGE_NAME}@${latest.version}`)
  const transaction = commitPluginEntries(
    preparedResult.value,
    replaceEntry(preparedResult.value.entries, activeResult.index, replacement),
  )
  return transaction === "changed"
    ? { kind: "updated", version: latest.version }
    : transaction === "no-op"
      ? { kind: "current" }
      : { kind: "blocked", reason: "write-failed" }
}

function assertNever(value: never): never {
  throw new TypeError(`Unknown project auto-update state: ${String(value)}`)
}
