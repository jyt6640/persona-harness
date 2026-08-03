import { describe, expect, it } from "vitest"

import {
  createAuthorityFetchChildEnvironment,
  isAuthorityFetchChildEnvironmentBounded,
} from "../scripts/authority-fetch-child-environment.mjs"

describe("authority fetch child environment", () => {
  it("accepts only the Linux runtime-owned io_uring marker beside the fixed child envelope", () => {
    const environment = {
      LANG: "C",
      LC_ALL: "C",
      PH_AUTHORITY_GITHUB_TOKEN: "ghp_test_marker",
      UV_USE_IO_URING: "0",
    }

    expect(isAuthorityFetchChildEnvironmentBounded(environment, "linux")).toBe(true)
    expect(isAuthorityFetchChildEnvironmentBounded({ ...environment, UV_USE_IO_URING: "1" }, "linux")).toBe(false)
    expect(isAuthorityFetchChildEnvironmentBounded({ ...environment, EXTRA: "unexpected" }, "linux")).toBe(false)
    expect(isAuthorityFetchChildEnvironmentBounded({ LANG: "C", LC_ALL: "C", UV_USE_IO_URING: "0" }, "linux")).toBe(false)
  })

  it("preserves the existing bounded darwin envelope", () => {
    expect(isAuthorityFetchChildEnvironmentBounded({
      LANG: "C",
      LC_ALL: "C",
      PH_AUTHORITY_GITHUB_TOKEN: "ghp_test_marker",
      __CF_USER_TEXT_ENCODING: "0x1F5:0:0",
    }, "darwin")).toBe(true)
  })

  it("constructs the exact Linux child envelope instead of relying on inherited runtime state", () => {
    const environment = createAuthorityFetchChildEnvironment("ghp_test_marker", "linux")

    expect(environment).toEqual({
      LANG: "C",
      LC_ALL: "C",
      PH_AUTHORITY_GITHUB_TOKEN: "ghp_test_marker",
      UV_USE_IO_URING: "0",
    })
    expect(isAuthorityFetchChildEnvironmentBounded(environment, "linux")).toBe(true)
    expect(createAuthorityFetchChildEnvironment("ghp_test_marker", "win32")).toBeUndefined()
  })
})
