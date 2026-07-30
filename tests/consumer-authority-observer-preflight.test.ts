import { describe, expect, it } from "vitest"

import {
  assessGithubActionsReadiness,
} from "../scripts/consumer-authority-observer-preflight-core.mjs"
import { runObserverCredentialPreflight } from "../scripts/consumer-authority-observer-preflight-launcher.mjs"

const credential = "ghp_observer_preflight_probe"
const readyOutput = {
  authorityEligible: false,
  consumerHome: "isolated",
  credential: "usable",
  fixtureAuthorization: "required",
  mutationPerformed: false,
  next: "fixture-authorization",
  schemaVersion: "consumer-authority-observer-preflight.1",
  state: "ready",
}

describe("consumer authority observer credential preflight", () => {
  it("accepts only the fixed authenticated user and empty sentinel Actions metadata probes", async () => {
    const calls: string[] = []

    const result = await assessGithubActionsReadiness(credential, async (url, headers) => {
      calls.push(url.toString())
      expect(headers.Authorization).toBe(`Bearer ${credential}`)
      if (url.pathname === "/user") return { body: { id: 7 }, statusCode: 200 }
      return { body: { artifacts: [], total_count: 0 }, statusCode: 200 }
    })

    expect(result).toEqual(readyOutput)
    expect(calls).toEqual([
      "https://api.github.com/user",
      "https://api.github.com/repos/jyt6640/persona-harness-attestation-claim-fixture/actions/artifacts?name=persona-harness-observer-preflight-sentinel-v1&per_page=1",
    ])
    expect(JSON.stringify(result)).not.toContain(credential)
  })

  it("blocks missing credentials, authenticated-user failure, scoped Actions failure, and sentinel artifacts", async () => {
    const noRequest = async (): Promise<never> => {
      throw new Error("request must not run")
    }

    await expect(assessGithubActionsReadiness("unsafe\ncredential", noRequest)).resolves.toMatchObject({
      credential: "unusable",
      state: "blocked",
      code: "host-gh-token-invalid",
    })
    await expect(assessGithubActionsReadiness(credential, async () => ({ body: {}, statusCode: 401 }))).resolves.toMatchObject({
      credential: "unusable",
      state: "blocked",
      code: "github-auth-unusable",
    })
    await expect(assessGithubActionsReadiness(credential, async (url) => (
      url.pathname === "/user"
        ? { body: { id: 7 }, statusCode: 200 }
        : { body: {}, statusCode: 403 }
    ))).resolves.toMatchObject({
      credential: "unusable",
      state: "blocked",
      code: "github-actions-read-unusable",
    })
    await expect(assessGithubActionsReadiness(credential, async (url) => (
      url.pathname === "/user"
        ? { body: { id: 7 }, statusCode: 200 }
        : { body: { artifacts: [{ id: 9 }], total_count: 1 }, statusCode: 200 }
    ))).resolves.toMatchObject({
      credential: "unusable",
      state: "blocked",
      code: "github-actions-sentinel-not-empty",
    })
  })

  it("keeps the host credential out of the consumer environment and every public result", () => {
    const calls: string[] = []
    let removedHome: string | undefined

    const result = runObserverCredentialPreflight({
      createHome: () => {
        calls.push("create-home")
        return "/isolated-observer-home"
      },
      environment: {
        GH_TOKEN: "ambient-token-must-not-be-used",
        GITHUB_TOKEN: "ambient-token-must-not-be-used",
        HOME: "/host-home",
        PATH: "/host-bin",
        SECRET_MARKER: "host-secret-must-not-cross",
      },
      execute: (command, args, options) => {
        calls.push(command)
        if (command === "gh") {
          expect(args).toEqual(["auth", "token", "--hostname", "github.com"])
          expect(options.env.GH_TOKEN).toBeUndefined()
          expect(options.env.GITHUB_TOKEN).toBeUndefined()
          expect(options.env.HOME).toBe("/host-home")
          expect(options.env.SECRET_MARKER).toBeUndefined()
          return { status: 0, stdout: `${credential}\n` }
        }
        expect(command).toBe(process.execPath)
        expect(options.env).toEqual({
          HOME: "/isolated-observer-home",
          LANG: "C",
          LC_ALL: "C",
          PH_OBSERVER_PREFLIGHT_GITHUB_TOKEN: credential,
        })
        return { status: 0, stdout: `${JSON.stringify(readyOutput)}\n` }
      },
      removeHome: (path) => {
        calls.push("remove-home")
        removedHome = path
      },
    })

    expect(result).toEqual(readyOutput)
    expect(calls).toEqual(["gh", "create-home", process.execPath, "remove-home"])
    expect(removedHome).toBe("/isolated-observer-home")
    expect(JSON.stringify(result)).not.toContain(credential)
    expect(JSON.stringify(result)).not.toContain("host-home")
  })

  it("blocks host token retrieval and malformed worker output without launching product, npm, or archive work", () => {
    const commands: string[] = []

    const result = runObserverCredentialPreflight({
      createHome: () => "/unused-home",
      environment: { HOME: "/host-home", PATH: "/host-bin" },
      execute: (command) => {
        commands.push(command)
        return { status: 1, stdout: "ghp_do_not_reflect" }
      },
      removeHome: () => undefined,
    })

    expect(result).toMatchObject({
      authorityEligible: false,
      code: "host-gh-auth-unavailable",
      credential: "unusable",
      fixtureAuthorization: "blocked",
      mutationPerformed: false,
      state: "blocked",
    })
    expect(JSON.stringify(result)).not.toContain("ghp_do_not_reflect")
    expect(commands).toEqual(["gh"])
  })

  it("blocks an absent host gh executable without exposing its failure", () => {
    const result = runObserverCredentialPreflight({
      environment: { HOME: "/host-home", PATH: "/host-bin" },
      execute: () => {
        throw new Error(`host-gh-missing-${credential}`)
      },
    })

    expect(result).toMatchObject({
      code: "host-gh-auth-unavailable",
      credential: "unusable",
      fixtureAuthorization: "blocked",
      state: "blocked",
    })
    expect(JSON.stringify(result)).not.toContain(credential)
  })

  it("rejects a malformed worker payload even when it names the allowed blocked next step", () => {
    const result = runObserverCredentialPreflight({
      createHome: () => "/isolated-observer-home",
      environment: { HOME: "/host-home", PATH: "/host-bin" },
      execute: (command) => (
        command === "gh"
          ? { status: 0, stdout: `${credential}\n` }
          : { status: 1, stdout: JSON.stringify({ next: "github-actions-read-preflight" }) }
      ),
      removeHome: () => undefined,
    })

    expect(result).toMatchObject({
      code: "github-actions-read-unusable",
      credential: "unusable",
      fixtureAuthorization: "blocked",
      state: "blocked",
    })
  })

  it("turns observer launch and cleanup errors into bounded blocks without reflecting credential material", () => {
    const workerLaunch = runObserverCredentialPreflight({
      createHome: () => "/isolated-observer-home",
      environment: { HOME: "/host-home", PATH: "/host-bin" },
      execute: (command) => {
        if (command === "gh") return { status: 0, stdout: `${credential}\n` }
        throw new Error(`worker-launch-${credential}`)
      },
      removeHome: () => undefined,
    })
    const cleanupFailure = runObserverCredentialPreflight({
      createHome: () => "/isolated-observer-home",
      environment: { HOME: "/host-home", PATH: "/host-bin" },
      execute: (command) => (
        command === "gh"
          ? { status: 0, stdout: `${credential}\n` }
          : { status: 0, stdout: `${JSON.stringify(readyOutput)}\n` }
      ),
      removeHome: () => {
        throw new Error(`cleanup-${credential}`)
      },
    })

    expect(workerLaunch).toMatchObject({
      code: "github-actions-read-unusable",
      credential: "unusable",
      fixtureAuthorization: "blocked",
      state: "blocked",
    })
    expect(cleanupFailure).toMatchObject({
      code: "observer-home-cleanup-unavailable",
      credential: "unusable",
      fixtureAuthorization: "blocked",
      state: "blocked",
    })
    expect(JSON.stringify({ cleanupFailure, workerLaunch })).not.toContain(credential)
  })

  it("rejects a token-bearing worker result rather than reflecting or trusting it", () => {
    const result = runObserverCredentialPreflight({
      createHome: () => "/isolated-observer-home",
      environment: { HOME: "/host-home", PATH: "/host-bin" },
      execute: (command) => (
        command === "gh"
          ? { status: 0, stdout: `${credential}\n` }
          : { status: 0, stdout: `${JSON.stringify({ ...readyOutput, token: credential })}\n` }
      ),
      removeHome: () => undefined,
    })

    expect(result).toMatchObject({
      code: "github-actions-read-unusable",
      credential: "unusable",
      fixtureAuthorization: "blocked",
      state: "blocked",
    })
    expect(JSON.stringify(result)).not.toContain(credential)
  })
})
