export const AUTHORITY_GITHUB_TOKEN_ENV = "PH_AUTHORITY_GITHUB_TOKEN"

export function selectAuthorityGithubToken(
  env: Readonly<Record<string, string | undefined>>,
): string | undefined {
  return [env["GH_TOKEN"], env["GITHUB_TOKEN"]].find(isAuthorityGithubToken)
}

export function isAuthorityGithubToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9._-]{1,4096}$/u.test(value)
}
