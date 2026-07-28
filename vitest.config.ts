import { defineConfig } from "vitest/config"

const DEFAULT_EXCLUDE = [
  "node_modules/**",
  "dist/**",
  "references/**",
  ".persona-test-fixtures/**",
]

const RESOURCE_SENSITIVE_TEST_FILES = [
  "tests/cooperative-finish-authority.test.ts",
  "tests/cooperative-finish-real-gradle.test.ts",
  "tests/cooperative-gradle-verification.test.ts",
  "tests/eval-runner.test.ts",
  "tests/persona-harness-ci-reverification-adversarial.test.ts",
  "tests/persona-harness-ci-reverification-runner.test.ts",
  "tests/persona-harness-ci-reverification-surface.test.ts",
  "tests/persona-harness-fresh-verification-runner.test.ts",
  "tests/persona-harness-mechanical-finish.test.ts",
  "tests/staged-package-verification-runner.test.ts",
  "tests/project-finish-attestation-consumption.test.ts",
  "tests/project-finish-attestation-producer-inputs.test.ts",
  "tests/project-finish-attestation-producer-profile.test.ts",
  "tests/project-finish-attestation-source.test.ts",
  "tests/project-finish-attestation-verifier.test.ts",
  "tests/persona-harness-semantic-tdd-transition.test.ts",
  "tests/persona-harness-source-identity.test.ts",
  "tests/persona-harness-staged-package-verification-installed.test.ts",
  "tests/persona-harness-workflow-loop.test.ts",
  "tests/native-project-read-runtime.test.ts",
  "tests/persona-harness-semantic-tdd.test.ts",
  "tests/workflow-cooperative-finish-public.test.ts",
  "tests/workflow-finish-attestation-parity.test.ts",
]

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "parallel",
          include: ["tests/**/*.test.ts"],
          exclude: [...DEFAULT_EXCLUDE, ...RESOURCE_SENSITIVE_TEST_FILES],
          sequence: { groupOrder: 0 },
        },
      },
      {
        test: {
          name: "resource-sensitive",
          include: RESOURCE_SENSITIVE_TEST_FILES,
          exclude: DEFAULT_EXCLUDE,
          fileParallelism: false,
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
})
