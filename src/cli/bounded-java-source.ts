import { join } from "node:path"

import { walkBoundedFiles } from "../io/bounded-path-walker.js"

const JAVA_MAIN_DIR = join("src", "main", "java")
const JAVA_SOURCE_MAX_DEPTH = 64
const JAVA_SOURCE_MAX_ENTRIES = 10_000

export type BoundedJavaSourceFile = {
  readonly absolutePath: string
  readonly relativePath: string
  readonly text: string
}

export type BoundedJavaSourceResult = {
  readonly files: readonly BoundedJavaSourceFile[]
  readonly safe: boolean
}

export function readBoundedJavaSources(projectDir: string): BoundedJavaSourceResult {
  const walked = walkBoundedFiles(join(projectDir, JAVA_MAIN_DIR), projectDir, {
    extensions: [".java"],
    includeText: true,
    maxDepth: JAVA_SOURCE_MAX_DEPTH,
    maxEntries: JAVA_SOURCE_MAX_ENTRIES,
  })
  if (!walked.safe) {
    return { files: [], safe: false }
  }

  const files: BoundedJavaSourceFile[] = []
  for (const file of walked.files) {
    if (file.text === undefined) {
      return { files: [], safe: false }
    }
    files.push({
      absolutePath: file.absolutePath,
      relativePath: `${JAVA_MAIN_DIR.replaceAll("\\", "/")}/${file.relativePath}`,
      text: file.text,
    })
  }
  return { files, safe: true }
}
