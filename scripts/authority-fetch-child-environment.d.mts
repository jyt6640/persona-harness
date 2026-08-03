export function createAuthorityFetchChildEnvironment(
  token: unknown,
  platform: string,
  darwinTextEncoding?: unknown,
): Readonly<Record<string, string>> | undefined

export function isAuthorityFetchChildEnvironmentBounded(
  environment: unknown,
  platform: "darwin" | "linux",
): boolean
