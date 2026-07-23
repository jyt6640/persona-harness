import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  unlinkSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  closeProjectFinishAttestationArtifactReservation,
  materializeProjectFinishAttestationArtifactReservation,
  reserveProjectFinishAttestationArtifactOutput,
  verifyProjectFinishAttestationArtifactReservation,
} from "../scripts/project-finish-attestation-artifact-output.mjs"

const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true })
  }
})

describe("project finish attestation artifact output lifecycle", () => {
  it("blocks a staging-phase parent replacement before receipt or predicate bytes leave the reserved output", () => {
    const fixture = createFixture()
    const reservation = reserveProjectFinishAttestationArtifactOutput(fixture.runner)

    rmSync(fixture.output, { force: true, recursive: true })
    symlinkSync(fixture.outside, fixture.output)

    try {
      expect(() => materializeProjectFinishAttestationArtifactReservation(reservation, artifacts())).toThrow()
      expect(existsSync(join(fixture.outside, "receipt.json"))).toBe(false)
      expect(existsSync(join(fixture.outside, "predicate.json"))).toBe(false)
      expect(lstatSync(fixture.output).isSymbolicLink()).toBe(true)
    } finally {
      closeProjectFinishAttestationArtifactReservation(reservation)
    }
  })

  it("blocks a final output-root replacement after materialization instead of accepting an aliased handoff", () => {
    const fixture = createFixture()
    const reservation = reserveProjectFinishAttestationArtifactOutput(fixture.runner)

    try {
      materializeProjectFinishAttestationArtifactReservation(reservation, artifacts())
      rmSync(fixture.output, { force: true, recursive: true })
      symlinkSync(fixture.outside, fixture.output)

      expect(() => verifyProjectFinishAttestationArtifactReservation(reservation)).toThrow()
      expect(existsSync(join(fixture.outside, "receipt.json"))).toBe(false)
      expect(existsSync(join(fixture.outside, "predicate.json"))).toBe(false)
    } finally {
      closeProjectFinishAttestationArtifactReservation(reservation)
    }
  })

  it("blocks a replaced receipt leaf before descriptor-bound bytes can reach its alias target", () => {
    const fixture = createFixture()
    const reservation = reserveProjectFinishAttestationArtifactOutput(fixture.runner)
    const receipt = join(fixture.output, "receipt.json")

    unlinkSync(receipt)
    symlinkSync(join(fixture.outside, "receipt.json"), receipt)

    try {
      expect(() => materializeProjectFinishAttestationArtifactReservation(reservation, artifacts())).toThrow()
      expect(existsSync(join(fixture.outside, "receipt.json"))).toBe(false)
      expect(existsSync(join(fixture.outside, "predicate.json"))).toBe(false)
    } finally {
      closeProjectFinishAttestationArtifactReservation(reservation)
    }
  })

  it("materializes the exact receipt and predicate only while every reserved output identity remains current", () => {
    const fixture = createFixture()
    const reservation = reserveProjectFinishAttestationArtifactOutput(fixture.runner)
    const value = artifacts()

    try {
      materializeProjectFinishAttestationArtifactReservation(reservation, value)
      expect(verifyProjectFinishAttestationArtifactReservation(reservation)).toEqual({
        outputDirectory: fixture.output,
      })
      expect(readFileSync(join(fixture.output, "receipt.json"))).toEqual(value.receiptBytes)
      expect(readFileSync(join(fixture.output, "predicate.json"), "utf8")).toBe(
        `${JSON.stringify(value.predicate)}\n`,
      )
    } finally {
      closeProjectFinishAttestationArtifactReservation(reservation)
    }
  })
})

function artifacts() {
  return {
    predicate: { schemaVersion: "project-finish-attestation.1", subject: "receipt.json" },
    receiptBytes: Buffer.from('{"schemaVersion":"project-finish-attestation.1"}\n', "utf8"),
  }
}

function createFixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "persona-project-finish-artifact-output-")))
  const runner = join(root, "runner")
  const outside = join(root, "outside")
  mkdirSync(runner)
  mkdirSync(outside)
  temporaryDirectories.push(root)
  return {
    output: join(runner, ".project-finish-attestation-artifacts"),
    outside,
    runner,
  }
}
