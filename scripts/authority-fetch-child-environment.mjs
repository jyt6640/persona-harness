const COMMON_KEYS = ["LANG", "LC_ALL", "PH_AUTHORITY_GITHUB_TOKEN"]
const DARWIN_KEYS = [...COMMON_KEYS, "__CF_USER_TEXT_ENCODING"]
const LINUX_KEYS = [...COMMON_KEYS, "UV_USE_IO_URING"]

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
