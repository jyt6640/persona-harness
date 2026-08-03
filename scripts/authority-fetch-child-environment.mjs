const COMMON_KEYS = ["LANG", "LC_ALL", "PH_AUTHORITY_GITHUB_TOKEN"]
const DARWIN_KEYS = [...COMMON_KEYS, "__CF_USER_TEXT_ENCODING"]
const LINUX_KEYS = [...COMMON_KEYS, "UV_USE_IO_URING"]

export function createAuthorityFetchChildEnvironment(token, platform, darwinTextEncoding) {
  if (!isChildToken(token) || (platform !== "darwin" && platform !== "linux")) return undefined
  const common = {
    LANG: "C",
    LC_ALL: "C",
    PH_AUTHORITY_GITHUB_TOKEN: token,
  }
  const environment = platform === "linux"
    ? { ...common, UV_USE_IO_URING: "0" }
    : isDarwinTextEncoding(darwinTextEncoding)
      ? { ...common, __CF_USER_TEXT_ENCODING: darwinTextEncoding }
      : undefined
  return environment !== undefined && isAuthorityFetchChildEnvironmentBounded(environment, platform)
    ? environment
    : undefined
}

export function isAuthorityFetchChildEnvironmentBounded(environment, platform) {
  if (!isRecord(environment) || (platform !== "darwin" && platform !== "linux")) return false
  const expected = platform === "darwin" ? DARWIN_KEYS : LINUX_KEYS
  const actual = Object.keys(environment).sort()
  if (actual.length !== expected.length || actual.some((key, index) => key !== [...expected].sort()[index])) return false
  if (typeof environment.PH_AUTHORITY_GITHUB_TOKEN !== "string" || environment.PH_AUTHORITY_GITHUB_TOKEN.length === 0) return false
  if (environment.LANG !== "C" || environment.LC_ALL !== "C") return false
  if (platform === "linux") return environment.UV_USE_IO_URING === "0"
  return typeof environment.__CF_USER_TEXT_ENCODING === "string" && environment.__CF_USER_TEXT_ENCODING.length > 0
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function isChildToken(value) {
  return typeof value === "string" && /^[A-Za-z0-9._-]{1,4096}$/u.test(value)
}

function isDarwinTextEncoding(value) {
  return typeof value === "string" && /^[\x20-\x7e]{1,256}$/u.test(value)
}
