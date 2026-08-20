import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const repositoryRoot = process.cwd()

describe("current package authority", () => {
  it("binds the root, lockfile, and private shared package to 0.8.13", () => {
    const packageJson = JSON.parse(readFileSync(join(repositoryRoot, "package.json"), "utf8")) as {
      readonly version: string
    }
    const packageLock = JSON.parse(readFileSync(join(repositoryRoot, "package-lock.json"), "utf8")) as {
      readonly version: string
      readonly packages: Readonly<Record<string, { readonly version?: string }>>
    }
    const sharedPackage = JSON.parse(readFileSync(join(repositoryRoot, "packages/shared-skills/package.json"), "utf8")) as {
      readonly version: string
    }

    expect(packageJson.version).toBe("0.8.13")
    expect(packageLock.version).toBe("0.8.13")
    expect(packageLock.packages[""]?.version).toBe("0.8.13")
    expect(sharedPackage.version).toBe("0.8.13")
  })

  it("ships a distinct current acceptance record while retaining historical records", () => {
    const packageJson = JSON.parse(readFileSync(join(repositoryRoot, "package.json"), "utf8")) as {
      readonly files: readonly string[]
    }
    const currentSchema = "scripts/consumer-authority-v0813-acceptance-schema.mjs"
    const currentTypes = "scripts/consumer-authority-v0813-acceptance-schema.d.mts"
    const currentRecord = "docs/current/release/consumer-authority-v0813-acceptance.json"

    expect(existsSync(join(repositoryRoot, currentSchema))).toBe(true)
    expect(existsSync(join(repositoryRoot, currentTypes))).toBe(true)
    expect(existsSync(join(repositoryRoot, currentRecord))).toBe(true)
    expect(packageJson.files).toEqual(expect.arrayContaining([currentSchema, currentTypes, "docs/current/release"]))
    expect(existsSync(join(repositoryRoot, "scripts/consumer-authority-v0810-acceptance-schema.mjs"))).toBe(true)
    expect(existsSync(join(repositoryRoot, "scripts/consumer-authority-v0811-acceptance-schema.mjs"))).toBe(true)
    expect(existsSync(join(repositoryRoot, "scripts/consumer-authority-v0812-acceptance-schema.mjs"))).toBe(true)
    expect(existsSync(join(repositoryRoot, "docs/current/release/consumer-authority-v0810-acceptance.json"))).toBe(true)
    expect(existsSync(join(repositoryRoot, "docs/current/release/consumer-authority-v0811-acceptance.json"))).toBe(true)
    expect(existsSync(join(repositoryRoot, "docs/current/release/consumer-authority-v0812-acceptance.json"))).toBe(true)
    expect(existsSync(join(repositoryRoot, "docs/current/release/consumer-authority-v084-acceptance.json"))).toBe(true)
    expect(existsSync(join(repositoryRoot, "docs/current/release/consumer-authority-v085-acceptance.json"))).toBe(true)
    expect(existsSync(join(repositoryRoot, "docs/current/release/consumer-authority-v086-acceptance.json"))).toBe(true)
    expect(existsSync(join(repositoryRoot, "docs/current/release/consumer-authority-v087-acceptance.json"))).toBe(true)
    expect(existsSync(join(repositoryRoot, "docs/current/release/consumer-authority-v088-acceptance.json"))).toBe(true)
    expect(existsSync(join(repositoryRoot, "docs/current/release/consumer-authority-v089-acceptance.json"))).toBe(true)
  })
})
