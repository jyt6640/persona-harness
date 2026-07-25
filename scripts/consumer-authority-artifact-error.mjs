export class ConsumerAuthorityArtifactFetchError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}
