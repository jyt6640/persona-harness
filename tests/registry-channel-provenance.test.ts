import { describe, expect, it } from "vitest"

// @ts-expect-error -- plain .mjs audit script with no type declaration
import { classifyRegistryProvenance } from "../scripts/check-registry-channel-provenance.mjs"

const GOVERNED = {
  _npmUser: { name: "GitHub Actions" },
  dist: {
    attestations: {
      provenance: { predicateType: "https://slsa.dev/provenance/v1" },
      url: "https://registry.npmjs.org/-/npm/v1/attestations/persona-harness@0.8.0-beta.23",
    },
  },
}

const WORKSTATION_PUBLISH = {
  _npmUser: { name: "black_bear" },
  dist: { shasum: "03e4c5585392c87a2e2b28a3c7a1a278d6a50d05" },
}

/**
 * `publish.yml` publishes with `--provenance`, so a version it produced carries
 * an npm provenance attestation and one published from a workstation does not.
 * Nothing detected that difference until `0.8.0-beta.33` reached `staging`
 * outside the workflow and the missing post-publish readback was noticed by
 * hand, days later.
 */
describe("registry channel provenance", () => {
  it("accepts a version published through the workflow", () => {
    expect(classifyRegistryProvenance(GOVERNED, "0.8.0-beta.23")).toMatchObject({
      publisher: "GitHub Actions",
      state: "present",
    })
  })

  it("reports a version published outside the workflow as absent", () => {
    // This is the exact shape `0.8.0-beta.33` returned from the registry.
    expect(classifyRegistryProvenance(WORKSTATION_PUBLISH, "0.8.0-beta.33")).toMatchObject({
      publisher: "black_bear",
      state: "absent",
    })
  })

  it("does not accept an attestation that is not provenance", () => {
    // An attestation block alone is not the claim; only a SLSA provenance
    // predicate says the registry artifact came from the workflow.
    const otherPredicate = {
      dist: { attestations: { provenance: { predicateType: "https://example.invalid/other/v1" } } },
    }

    expect(classifyRegistryProvenance(otherPredicate, "0.0.0")).toMatchObject({ state: "unrecognized" })
  })

  it("treats an explicit null attestations field as absent rather than unreadable", () => {
    // npm returns `null` rather than omitting the key, which read as "present
    // but empty" to a naive check.
    expect(classifyRegistryProvenance({ dist: { attestations: null } }, "0.0.0")).toMatchObject({ state: "absent" })
  })

  it("reports unreadable metadata separately from a missing attestation", () => {
    // A registry that cannot be read is not evidence that a publish bypassed
    // the workflow, and must not be reported as if it were.
    expect(classifyRegistryProvenance(undefined, "0.0.0")).toMatchObject({ state: "unreadable" })
  })
})
