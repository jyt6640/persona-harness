import { spawnSync } from "node:child_process"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  AUTHORITY_DISCOVERY_EXERCISE_MARKER,
  createAuthorityDiscoveryExerciseResult,
  formatAuthorityDiscoveryExerciseResult,
} from "../scripts/consumer-authority-authority-discovery-exercise.mjs"
import {
  PACKAGE_EXERCISE_PHASES,
  PackageExercisePhaseEnvelopeError,
  assessPackageExerciseContractOutput,
  formatPackageExercisePhaseRecord,
  requirePackageExerciseContractSuccess,
} from "../scripts/clean-package-exercise-phase.mjs"

const SOURCE_MARKER = "source-cli-package-exercise-phase"
const SOURCE_SUCCESS = "source-cli-package-exercise-contract: PASS"
const FRESH_TAR_MARKER = "installed-package-exercise-phase"
const FRESH_TAR_SUCCESS = "installed-package-exercise-contract: PASS"

describe("clean package exercise phase protocol", () => {
  it("requires every ordered source-built phase before accepting the terminal marker", () => {
    const output = [
      ...PACKAGE_EXERCISE_PHASES["source-built"].map((phase) =>
        formatPackageExercisePhaseRecord("source-built", phase, "ready", "passed", SOURCE_MARKER),
      ),
      SOURCE_SUCCESS,
      "",
    ].join("\n")

    expect(assessPackageExerciseContractOutput({
      marker: SOURCE_MARKER,
      output,
      status: 0,
      successMarker: SOURCE_SUCCESS,
      surface: "source-built",
    })).toEqual({ state: "ready" })
  })

  it("binds the authority-discovery result immediately after its ready phase", () => {
    const phases = PACKAGE_EXERCISE_PHASES["source-built"]
    const output = [
      ...phases.flatMap((phase) => {
        const record = formatPackageExercisePhaseRecord("source-built", phase, "ready", "passed", SOURCE_MARKER)
        return phase === "authority-discovery"
          ? [record, formatAuthorityDiscoveryExerciseResult(createAuthorityDiscoveryExerciseResult("source-built"))]
          : [record]
      }),
      SOURCE_SUCCESS,
      "",
    ].join("\n")

    expect(() => requirePackageExerciseContractSuccess({
      authorityDiscoveryMarker: AUTHORITY_DISCOVERY_EXERCISE_MARKER,
      fallbackCode: "clean-package-source-contract",
      marker: SOURCE_MARKER,
      output,
      status: 0,
      successMarker: SOURCE_SUCCESS,
      surface: "source-built",
    })).not.toThrow()

    const misplaced = output.replace(
      `${formatPackageExercisePhaseRecord("source-built", "authority-discovery", "ready", "passed", SOURCE_MARKER)}\n${formatAuthorityDiscoveryExerciseResult(createAuthorityDiscoveryExerciseResult("source-built"))}`,
      `${formatAuthorityDiscoveryExerciseResult(createAuthorityDiscoveryExerciseResult("source-built"))}\n${formatPackageExercisePhaseRecord("source-built", "authority-discovery", "ready", "passed", SOURCE_MARKER)}`,
    )
    expect(() => requirePackageExerciseContractSuccess({
      authorityDiscoveryMarker: AUTHORITY_DISCOVERY_EXERCISE_MARKER,
      fallbackCode: "clean-package-source-contract",
      marker: SOURCE_MARKER,
      output: misplaced,
      status: 0,
      successMarker: SOURCE_SUCCESS,
      surface: "source-built",
    })).toThrow("clean-package-source-contract-phase-envelope-invalid")
  })

  it("rejects missing, duplicate, foreign, malformed, and blocked-then-success discovery results", () => {
    const phaseRecord = formatPackageExercisePhaseRecord(
      "source-built",
      "authority-discovery",
      "ready",
      "passed",
      SOURCE_MARKER,
    )
    const result = formatAuthorityDiscoveryExerciseResult(createAuthorityDiscoveryExerciseResult("source-built"))
    const complete = PACKAGE_EXERCISE_PHASES["source-built"].flatMap((phase) => {
      const record = formatPackageExercisePhaseRecord("source-built", phase, "ready", "passed", SOURCE_MARKER)
      return phase === "authority-discovery" ? [record, result] : [record]
    })
    const validOutput = [...complete, SOURCE_SUCCESS, ""].join("\n")
    const cases = [
      validOutput.replace(`\n${result}`, ""),
      validOutput.replace(result, `${result}\n${result}`),
      validOutput.replace(result, `${AUTHORITY_DISCOVERY_EXERCISE_MARKER}: ${JSON.stringify({
        result: "trusted-unconsumed-persisted",
        schemaVersion: "consumer-authority-discovery-exercise.1",
        surface: "fresh-tar",
      })}`),
      validOutput.replace(result, `${AUTHORITY_DISCOVERY_EXERCISE_MARKER}: ${JSON.stringify({
        result: "trusted-unconsumed-persisted",
        schemaVersion: "consumer-authority-discovery-exercise.1",
        surface: "source-built",
        unexpected: "ignored-by-no-one",
      })}`),
      validOutput.replace(result, `${AUTHORITY_DISCOVERY_EXERCISE_MARKER}: ${JSON.stringify({
        result: "blocked",
        schemaVersion: "consumer-authority-discovery-exercise.1",
        surface: "source-built",
      })}\n${result}`),
    ]

    expect(phaseRecord).toContain("authority-discovery")
    for (const output of cases) {
      expect(() => requirePackageExerciseContractSuccess({
        authorityDiscoveryMarker: AUTHORITY_DISCOVERY_EXERCISE_MARKER,
        fallbackCode: "clean-package-source-contract",
        marker: SOURCE_MARKER,
        output,
        status: 0,
        successMarker: SOURCE_SUCCESS,
        surface: "source-built",
      })).toThrow("clean-package-source-contract-phase-envelope-invalid")
    }
  })

  it("reports only the fixed fresh-tar phase and code for a blocked child", () => {
    const phases = PACKAGE_EXERCISE_PHASES["fresh-tar"]
    const output = [
      formatPackageExercisePhaseRecord("fresh-tar", phases[0]!, "ready", "passed", FRESH_TAR_MARKER),
      formatPackageExercisePhaseRecord("fresh-tar", phases[1]!, "blocked", "contract-failed", FRESH_TAR_MARKER),
      "",
    ].join("\n")

    expect(assessPackageExerciseContractOutput({
      marker: FRESH_TAR_MARKER,
      output,
      status: 1,
      successMarker: FRESH_TAR_SUCCESS,
      surface: "fresh-tar",
    })).toEqual({
      code: "contract-failed",
      phase: phases[1],
      state: "blocked",
    })
  })

  it("rejects missing, foreign, out-of-order, and untrusted transcript fields without reflection", () => {
    const hostile = "/private/consumer/root/ghp_phase_protocol_marker"
    const first = PACKAGE_EXERCISE_PHASES["source-built"][0]!
    const second = PACKAGE_EXERCISE_PHASES["source-built"][1]!
    const valid = formatPackageExercisePhaseRecord("source-built", first, "ready", "passed", SOURCE_MARKER)
    const outcomes = [
      assessPackageExerciseContractOutput({
        marker: SOURCE_MARKER,
        output: `${SOURCE_SUCCESS}\n`,
        status: 0,
        successMarker: SOURCE_SUCCESS,
        surface: "source-built",
      }),
      assessPackageExerciseContractOutput({
        marker: SOURCE_MARKER,
        output: [
          formatPackageExercisePhaseRecord("source-built", second, "ready", "passed", SOURCE_MARKER),
          SOURCE_SUCCESS,
          "",
        ].join("\n"),
        status: 0,
        successMarker: SOURCE_SUCCESS,
        surface: "source-built",
      }),
      assessPackageExerciseContractOutput({
        marker: SOURCE_MARKER,
        output: `${SOURCE_MARKER}: ${JSON.stringify({
          code: "passed",
          phase: first,
          schemaVersion: "clean-package-exercise-phase.1",
          state: "ready",
          surface: "source-built",
          unsafe: hostile,
        })}\n`,
        status: 1,
        successMarker: SOURCE_SUCCESS,
        surface: "source-built",
      }),
      assessPackageExerciseContractOutput({
        marker: SOURCE_MARKER,
        output: [
          valid,
          formatPackageExercisePhaseRecord("fresh-tar", PACKAGE_EXERCISE_PHASES["fresh-tar"][1]!, "blocked", "contract-failed", SOURCE_MARKER),
          "",
        ].join("\n"),
        status: 1,
        successMarker: SOURCE_SUCCESS,
        surface: "source-built",
      }),
    ]

    for (const outcome of outcomes) {
      expect(outcome).toEqual({ state: "invalid" })
      expect(JSON.stringify(outcome)).not.toContain(hostile)
    }
  })

  it("does not accept a successful exit after a blocked phase or a substring success marker", () => {
    const first = PACKAGE_EXERCISE_PHASES["source-built"][0]!
    const blocked = formatPackageExercisePhaseRecord("source-built", first, "blocked", "observer-gh-parser-rejected", SOURCE_MARKER)

    expect(assessPackageExerciseContractOutput({
      marker: SOURCE_MARKER,
      output: `${blocked}\n${SOURCE_SUCCESS}\n`,
      status: 0,
      successMarker: SOURCE_SUCCESS,
      surface: "source-built",
    })).toEqual({ state: "invalid" })
    expect(assessPackageExerciseContractOutput({
      marker: SOURCE_MARKER,
      output: `${SOURCE_SUCCESS} trailing\n`,
      status: 0,
      successMarker: SOURCE_SUCCESS,
      surface: "source-built",
    })).toEqual({ state: "invalid" })
  })

  it("makes the clean-bundle parent reject marker-only, malformed, out-of-order, and foreign transcripts", () => {
    const first = PACKAGE_EXERCISE_PHASES["source-built"][0]!
    const second = PACKAGE_EXERCISE_PHASES["source-built"][1]!
    const malformed = `${SOURCE_MARKER}: ${JSON.stringify({
      code: "passed",
      phase: first,
      schemaVersion: "clean-package-exercise-phase.1",
      state: "ready",
      surface: "source-built",
      unexpected: "ignored-by-no-one",
    })}\n`
    const cases = [
      `${SOURCE_SUCCESS}\n`,
      malformed,
      `${formatPackageExercisePhaseRecord("source-built", second, "ready", "passed", SOURCE_MARKER)}\n`,
      `${formatPackageExercisePhaseRecord("fresh-tar", PACKAGE_EXERCISE_PHASES["fresh-tar"][0]!, "ready", "passed", SOURCE_MARKER)}\n`,
    ]

    for (const output of cases) {
      let thrown
      try {
        requirePackageExerciseContractSuccess({
          fallbackCode: "clean-package-source-contract",
          marker: SOURCE_MARKER,
          output,
          status: 1,
          successMarker: SOURCE_SUCCESS,
          surface: "source-built",
        })
      } catch (error) {
        thrown = error
      }
      expect(thrown).toBeInstanceOf(PackageExercisePhaseEnvelopeError)
      expect(thrown).toMatchObject({
        code: "clean-package-source-contract-phase-envelope-invalid",
      })
    }
  })

  it("emits one bounded first-phase record for an actual source child failure", () => {
    const marker = "/private/consumer/root/ghp_source_child_marker"
    const result = spawnSync(process.execPath, [
      join(process.cwd(), "scripts", "test-installed-package-contract.mjs"),
      "--package-exercise",
      "--observer-gh",
      marker,
      "--source-cli",
      `${marker}-missing-cli`,
    ], {
      cwd: process.cwd(),
      encoding: "utf8",
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toBe("")
    expect(result.stdout).toBe(`${formatPackageExercisePhaseRecord(
      "source-built",
      "cli-binding",
      "blocked",
      "contract-failed",
      SOURCE_MARKER,
    )}\n`)
    expect(`${result.stdout}${result.stderr}`).not.toContain(marker)
  })
})
