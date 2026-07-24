import { describe, expect, it } from "vitest"

import {
  ConsumerAuthorityGithubReadbackError,
  readConsumerAuthorityGithubEnrollment,
} from "../scripts/read-consumer-authority-github.mjs"

describe("consumer authority GitHub readback", () => {
  it("derives the immutable producer pin only from one public GitHub workflow declaration", async () => {
    const sha = "a".repeat(40)
    const result = await readConsumerAuthorityGithubEnrollment({
      repositorySlug: "example/public-gradle-app",
      workflowPath: "persona-harness.yml",
    }, async (url: URL) => url.pathname.endsWith("persona-harness.yml")
      ? { content: Buffer.from(`jobs:\n  attest:\n    uses: jyt6640/persona-harness/.github/workflows/persona-harness-project-finish.yml@${sha}\n`).toString("base64"), encoding: "base64" }
      : { full_name: "example/public-gradle-app", id: 987654321, private: false, visibility: "public" })

    expect(result).toEqual({
      callerWorkflowPath: ".github/workflows/persona-harness.yml",
      repositoryId: 987654321,
      repositorySlug: "example/public-gradle-app",
      reusableWorkflowSha: sha,
    })
  })

  it.each([
    ["private repository", { full_name: "example/public-gradle-app", id: 987654321, private: true, visibility: "private" }],
    ["wrong repository", { full_name: "other/public-gradle-app", id: 987654321, private: false, visibility: "public" }],
  ])("blocks %s without forwarding readback content", async (_name, repository) => {
    await expect(readConsumerAuthorityGithubEnrollment({
      repositorySlug: "example/public-gradle-app",
      workflowPath: "persona-harness.yml",
    }, async () => repository)).rejects.toMatchObject({ code: "authority-enrollment-repository" })
  })

  it("blocks mutable, duplicate, and malformed reusable references", async () => {
    const repository = { full_name: "example/public-gradle-app", id: 987654321, private: false, visibility: "public" }
    for (const text of [
      "uses: jyt6640/persona-harness/.github/workflows/persona-harness-project-finish.yml@main",
      `uses: jyt6640/persona-harness/.github/workflows/persona-harness-project-finish.yml@${"a".repeat(40)}\nuses: jyt6640/persona-harness/.github/workflows/persona-harness-project-finish.yml@${"b".repeat(40)}`,
      "secret-marker",
    ]) {
      await expect(readConsumerAuthorityGithubEnrollment({
        repositorySlug: "example/public-gradle-app",
        workflowPath: "persona-harness.yml",
      }, async (url: URL) => url.pathname.endsWith("persona-harness.yml")
        ? { content: Buffer.from(text).toString("base64"), encoding: "base64" }
        : repository)).rejects.toBeInstanceOf(ConsumerAuthorityGithubReadbackError)
    }
  })
})
