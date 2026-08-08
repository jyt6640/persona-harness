#!/usr/bin/env node
// Reports whether the version on each npm dist-tag was published through the
// governed path.
//
// `.github/workflows/publish.yml` publishes with `--provenance`, so a version
// it produced carries an npm provenance attestation. A version published from
// a workstation does not. Nothing detected that difference: `0.8.0-beta.33`
// reached `staging` outside the workflow on 2026-08-08, and the gap only
// surfaced when someone went looking for the post-publish readback record that
// also never ran.
//
// This is deliberately read-only and network-bound, so it is a dispatchable
// audit rather than a pull-request gate — see #203 on keeping the PR path free
// of external network state.
//
// Usage:
//   node scripts/check-registry-channel-provenance.mjs [--json]

import { execFileSync } from "node:child_process"
import process from "node:process"

const PACKAGE_NAME = "persona-harness"
const REGISTRY = "https://registry.npmjs.org"
const PROVENANCE_PREDICATE = "https://slsa.dev/provenance/"

function npmView(args) {
  const stdout = execFileSync("npm", ["view", ...args, "--json", "--registry", REGISTRY], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
  return stdout.trim() === "" ? undefined : JSON.parse(stdout)
}

/**
 * A version is governed when the registry holds a provenance attestation for
 * it. The absence of one is the signal; its contents are verified elsewhere by
 * the staged-package artifact attestation path.
 *
 * Separated from the network call so the classification can be tested without
 * depending on what happens to be published today.
 */
export function classifyRegistryProvenance(metadata, version) {
  if (metadata === undefined || metadata === null) {
    return { state: "unreadable", version }
  }
  const publisher = metadata?._npmUser?.name
  const attestations = metadata?.dist?.attestations
  if (attestations === undefined || attestations === null) {
    return { publisher, state: "absent", version }
  }
  const predicate = attestations?.provenance?.predicateType
  return {
    publisher,
    state: typeof predicate === "string" && predicate.startsWith(PROVENANCE_PREDICATE) ? "present" : "unrecognized",
    version,
  }
}

function channelProvenance(version) {
  let metadata
  try {
    metadata = npmView([`${PACKAGE_NAME}@${version}`])
  } catch {
    return { state: "unreadable", version }
  }
  return classifyRegistryProvenance(metadata, version)
}

function main() {
  const json = process.argv.includes("--json")
  let distTags
  try {
    distTags = npmView([PACKAGE_NAME, "dist-tags"])
  } catch {
    console.log(JSON.stringify({ diagnostics: ["registry-dist-tags-unreadable"], status: "blocked" }))
    process.exit(1)
  }

  const channels = Object.entries(distTags ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([channel, version]) => ({ channel, ...channelProvenance(version) }))
  const ungoverned = channels.filter((entry) => entry.state !== "present")
  const report = {
    channels,
    diagnostics: ungoverned.map((entry) => `${entry.channel}-provenance-${entry.state}`),
    package: PACKAGE_NAME,
    schemaVersion: "registry-channel-provenance.1",
    status: ungoverned.length === 0 ? "passed" : "blocked",
  }

  if (json) {
    console.log(JSON.stringify(report))
  } else {
    console.log(`Registry channel provenance: ${report.status.toUpperCase()}`)
    for (const entry of channels) {
      const publisher = entry.publisher === undefined ? "" : ` by ${entry.publisher}`
      console.log(`  ${entry.channel}: ${entry.version} — provenance ${entry.state}${publisher}`)
    }
    if (ungoverned.length > 0) {
      console.log("")
      console.log("A channel without provenance was published outside .github/workflows/publish.yml.")
      console.log("npm does not allow republishing a version, so the fix is a new version through that workflow.")
    }
  }
  process.exit(report.status === "passed" ? 0 : 1)
}

if (process.argv[1]?.endsWith("check-registry-channel-provenance.mjs")) {
  main()
}
