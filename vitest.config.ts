import { defineConfig } from "vitest/config"

const DEFAULT_EXCLUDE = [
  "node_modules/**",
  "dist/**",
  "references/**",
  ".persona-test-fixtures/**",
]

const RESOURCE_SENSITIVE_TEST_FILES = [
  "tests/cooperative-finish-real-gradle.test.ts",
  "tests/eval-runner.test.ts",
  "tests/project-finish-attestation-producer-oidc-bridge.test.ts",
  "tests/staged-package-verification-runner.test.ts",
  "tests/persona-harness-staged-package-verification-installed.test.ts",
  "tests/persona-harness-workflow-loop.test.ts",
]

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "parallel",
          include: ["tests/**/*.test.ts"],
          exclude: [...DEFAULT_EXCLUDE, ...RESOURCE_SENSITIVE_TEST_FILES],
          maxWorkers: 4,
          sequence: { groupOrder: 0 },
        },
      },
      {
        test: {
          name: "resource-sensitive",
          include: RESOURCE_SENSITIVE_TEST_FILES,
          exclude: DEFAULT_EXCLUDE,
          fileParallelism: false,
          maxWorkers: 1,
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
})
