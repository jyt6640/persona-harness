import { describe, expect, it } from "vitest"

import {
  ConsumerAuthorityGithubReadbackError,
  readConsumerAuthorityGithubEnrollment,
} from "../scripts/read-consumer-authority-github.mjs"

describe("consumer authority GitHub readback", () => {
  it("derives the immutable producer pin only from one public GitHub workflow declaration", async () => {
    const sha = "a".repeat(40)
    const requests: URL[] = []
    const result = await readConsumerAuthorityGithubEnrollment({
      repositorySlug: "example/public-gradle-app",
      workflowPath: "persona-harness.yml",
    }, async (url: URL) => {
      requests.push(url)
      return url.pathname.endsWith("persona-harness.yml")
        ? workflowContents(`jobs:\n  attest:\n    uses: jyt6640/persona-harness/.github/workflows/persona-harness-project-finish.yml@${sha}\n`)
        : repository()
    })

    expect(result).toEqual({
      callerWorkflowPath: ".github/workflows/persona-harness.yml",
      repositoryId: 987654321,
      repositorySlug: "example/public-gradle-app",
      reusableWorkflowSha: sha,
    })
    expect(requests.filter((url) => url.pathname === "/repos/example/public-gradle-app")).toHaveLength(2)
    expect(requests.find((url) => url.pathname.endsWith("persona-harness.yml"))?.searchParams.get("ref")).toBe("main")
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
    const publicRepository = repository()
    for (const text of [
      "uses: jyt6640/persona-harness/.github/workflows/persona-harness-project-finish.yml@main",
      `uses: jyt6640/persona-harness/.github/workflows/persona-harness-project-finish.yml@${"a".repeat(40)}\nuses: jyt6640/persona-harness/.github/workflows/persona-harness-project-finish.yml@${"b".repeat(40)}`,
      "secret-marker",
    ]) {
      await expect(readConsumerAuthorityGithubEnrollment({
        repositorySlug: "example/public-gradle-app",
        workflowPath: "persona-harness.yml",
      }, async (url: URL) => url.pathname.endsWith("persona-harness.yml")
        ? workflowContents(text)
        : publicRepository)).rejects.toBeInstanceOf(ConsumerAuthorityGithubReadbackError)
    }
  })

  it("does not treat reusable-workflow text outside the jobs mapping as executable identity", async () => {
    const sha = "a".repeat(40)
    const source = `description: |\n    uses: jyt6640/persona-harness/.github/workflows/persona-harness-project-finish.yml@${sha}\njobs:\n  test:\n    runs-on: ubuntu-latest\n`

    await expect(readConsumerAuthorityGithubEnrollment({
      repositorySlug: "example/public-gradle-app",
      workflowPath: "persona-harness.yml",
    }, async (url: URL) => url.pathname.endsWith("persona-harness.yml")
      ? workflowContents(source)
      : repository())).rejects.toMatchObject({ code: "authority-enrollment-workflow" })
  })

  it("blocks URL-shaped workflow paths and non-canonical GitHub content before enrollment", async () => {
    let requests = 0
    await expect(readConsumerAuthorityGithubEnrollment({
      repositorySlug: "example/public-gradle-app",
      workflowPath: "persona?ref=other.yml",
    }, async () => {
      requests += 1
      return repository()
    })).rejects.toMatchObject({ code: "authority-enrollment-invalid" })
    expect(requests).toBe(0)

    const source = `jobs:\n  attest:\n    uses: jyt6640/persona-harness/.github/workflows/persona-harness-project-finish.yml@${"a".repeat(40)}\n`
    const contents = workflowContents(source)
    await expect(readConsumerAuthorityGithubEnrollment({
      repositorySlug: "example/public-gradle-app",
      workflowPath: "persona-harness.yml",
    }, async (url: URL) => url.pathname.endsWith("persona-harness.yml")
      ? { ...contents, content: `${contents.content.slice(0, 8)}!${contents.content.slice(8)}` }
      : repository())).rejects.toMatchObject({ code: "authority-enrollment-workflow" })
  })

  it("rejects repository identity drift across the workflow readback", async () => {
    let repositoryReads = 0
    const source = `jobs:\n  attest:\n    uses: jyt6640/persona-harness/.github/workflows/persona-harness-project-finish.yml@${"a".repeat(40)}\n`

    await expect(readConsumerAuthorityGithubEnrollment({
      repositorySlug: "example/public-gradle-app",
      workflowPath: "persona-harness.yml",
    }, async (url: URL) => {
      if (url.pathname.endsWith("persona-harness.yml")) return workflowContents(source)
      repositoryReads += 1
      return repository(repositoryReads === 1 ? 987654321 : 123456789)
    })).rejects.toMatchObject({ code: "authority-enrollment-repository" })
  })
})

function repository(id = 987654321): Record<string, unknown> {
  return {
    full_name: "example/public-gradle-app",
    id,
    private: false,
    visibility: "public",
  }
}

function workflowContents(source: string): {
  readonly content: string
  readonly encoding: "base64"
  readonly path: string
  readonly sha: string
  readonly size: number
  readonly type: "file"
} {
  const bytes = Buffer.from(source, "utf8")
  return {
    content: bytes.toString("base64"),
    encoding: "base64",
    path: ".github/workflows/persona-harness.yml",
    sha: "c".repeat(40),
    size: bytes.byteLength,
    type: "file",
  }
}
