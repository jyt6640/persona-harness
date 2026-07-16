import { describe, expect, it } from "vitest"

import config from "../vitest.config.js"

type JsonRecord = Readonly<Record<string, unknown>>

const RESOURCE_SENSITIVE_TEST_FILES = [
  "tests/eval-runner.test.ts",
  "tests/staged-package-verification-runner.test.ts",
  "tests/persona-harness-staged-package-verification-installed.test.ts",
  "tests/persona-harness-workflow-loop.test.ts",
]

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function namedProject(projects: readonly unknown[], name: string): JsonRecord {
  const project = projects.find((candidate) => {
    if (!isRecord(candidate) || !isRecord(candidate["test"])) return false
    return candidate["test"]["name"] === name
  })
  if (!isRecord(project) || !isRecord(project["test"])) {
    throw new Error(`Missing Vitest project: ${name}`)
  }
  return project["test"]
}

function stringList(value: unknown): readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string")
    ? value
    : []
}

describe("Vitest execution topology", () => {
  it("keeps normal files parallel and runs resource-sensitive files after them", () => {
    const rootConfig: unknown = config
    expect(isRecord(rootConfig)).toBe(true)
    if (!isRecord(rootConfig) || !isRecord(rootConfig["test"])) {
      throw new Error("Expected a Vitest test configuration")
    }

    const projects = rootConfig["test"]["projects"]
    expect(Array.isArray(projects)).toBe(true)
    if (!Array.isArray(projects)) {
      throw new Error("Expected explicit Vitest projects")
    }

    const parallel = namedProject(projects, "parallel")
    const resourceSensitive = namedProject(projects, "resource-sensitive")
    const parallelExclude = stringList(parallel["exclude"])
    const serialInclude = stringList(resourceSensitive["include"])

    expect(parallel["fileParallelism"]).not.toBe(false)
    expect(parallel["sequence"]).toEqual({ groupOrder: 0 })
    expect(resourceSensitive["fileParallelism"]).toBe(false)
    expect(resourceSensitive["sequence"]).toEqual({ groupOrder: 1 })
    expect(parallelExclude).toEqual(expect.arrayContaining(RESOURCE_SENSITIVE_TEST_FILES))
    expect(serialInclude).toEqual(RESOURCE_SENSITIVE_TEST_FILES)
  })
})
