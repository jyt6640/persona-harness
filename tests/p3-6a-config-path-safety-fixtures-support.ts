import { spawnSync } from "node:child_process"
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export type JsonObject = Record<string, unknown>

export type ValidatorRun = {
  readonly exitCode: number
  readonly result: JsonObject | undefined
  readonly stderr: string
  readonly stdout: string
}

const testsDirectory = dirname(fileURLToPath(import.meta.url))
export const corpusDirectory = resolve(
  testsDirectory,
  "../experiments/p3-6a-config-path-safety-fixtures",
)
export const validatorPath = join(corpusDirectory, "evaluator", "measure.mjs")

export function copyCorpus(): string {
  const parentDirectory = mkdtempSync(join(tmpdir(), "p3-6a-fixture-copy-"))
  const copiedDirectory = join(parentDirectory, "corpus")
  cpSync(corpusDirectory, copiedDirectory, { recursive: true })
  return copiedDirectory
}

export function removeCorpusCopy(copiedDirectory: string): void {
  rmSync(dirname(copiedDirectory), { force: true, recursive: true })
}

export function makeSymlinkFixture(copiedDirectory: string): void {
  symlinkSync("../outside.json", join(copiedDirectory, "fixtures/outside-link.json"))
  setJsonPath(join(copiedDirectory, "corpus.json"), ["records", "0", "fixture"], "fixtures/outside-link.json")
}

export function replaceFixtureDirectoryWithSymlink(copiedDirectory: string): void {
  rmSync(join(copiedDirectory, "fixtures"), { force: true, recursive: true })
  symlinkSync("../outside-fixtures", join(copiedDirectory, "fixtures"))
}

export function readJsonObject(filePath: string): JsonObject {
  const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"))
  if (!isJsonObject(parsed)) {
    throw new TypeError(`Expected JSON object: ${filePath}`)
  }
  return parsed
}

export function writeJsonObject(filePath: string, value: JsonObject): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

export function updateJsonObject(filePath: string, update: (value: JsonObject) => void): void {
  const value = readJsonObject(filePath)
  update(value)
  writeJsonObject(filePath, value)
}

export function updateCorpusRecords(
  corpusFilePath: string,
  update: (records: JsonObject[]) => void,
): void {
  updateJsonObject(corpusFilePath, (corpus) => {
    const records = corpus.records
    if (!Array.isArray(records) || !records.every(isJsonObject)) {
      throw new TypeError(`Expected corpus records: ${corpusFilePath}`)
    }
    update(records)
  })
}

export function setJsonPath(filePath: string, segments: readonly string[], value: unknown): void {
  updateJsonObject(filePath, (document) => {
    let current: unknown = document
    for (const segment of segments.slice(0, -1)) {
      if (isJsonObject(current)) {
        current = current[segment]
      } else if (Array.isArray(current) && /^\d+$/u.test(segment)) {
        current = current[Number(segment)]
      } else {
        throw new TypeError(`Invalid JSON path segment: ${segment}`)
      }
    }

    const finalSegment = segments.at(-1)
    if (finalSegment === undefined) {
      throw new TypeError("JSON path must not be empty")
    }
    if (isJsonObject(current)) {
      current[finalSegment] = value
      return
    }
    if (Array.isArray(current) && /^\d+$/u.test(finalSegment)) {
      current[Number(finalSegment)] = value
      return
    }
    throw new TypeError(`Invalid JSON path target: ${finalSegment}`)
  })
}

export function runValidator(
  copiedDirectory: string,
  version: "base" | "successor",
): ValidatorRun {
  const child = spawnSync(
    process.execPath,
    [validatorPath, "--root", copiedDirectory, "--version", version],
    { encoding: "utf8" },
  )
  const stdout = typeof child.stdout === "string" ? child.stdout.trim() : ""
  const stderr = typeof child.stderr === "string" ? child.stderr.trim() : ""
  let parsed: unknown
  try {
    parsed = stdout.length === 0 ? undefined : JSON.parse(stdout)
  } catch {
    parsed = undefined
  }
  return {
    exitCode: child.status ?? -1,
    result: isJsonObject(parsed) ? parsed : undefined,
    stderr,
    stdout,
  }
}

export function failureCodes(run: ValidatorRun): readonly string[] {
  const codes = run.result?.failureCodes
  return Array.isArray(codes) && codes.every((code): code is string => typeof code === "string")
    ? codes
    : []
}

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
