# v0.7.0-rc.2 Release Facts

## Pre-Publish State

`0.7.0-rc.2` is prepared for next-channel review only.

- Intended package metadata: `0.7.0-rc.2`.
- Exact release-prep base: `4ed9653b1d9c02a673b340d72d6d42ae3b674e2b`.
- Existing published `next`: `0.7.0-rc.1`.
- Existing stable `latest`: `0.6.0`.
- Existing rc1 registry gitHead/tag/release-branch commit:
  `d4d4d9acb1e4198fb2001ac81fe77f6bd9d4efd9`.
- No rc2 registry gitHead, shasum, integrity, package entry count, dist-tag,
  Git tag, GitHub prerelease, or registry-install smoke exists yet.

After QA release GO, the trusted publish workflow must publish rc2 with
`dist_tag=next`, then verify the registry version/gitHead/shasum and dist-tag
before a matching tag or GitHub prerelease is created. This file must be
updated with those post-publish facts only after that verification.

## Included P1 Scope

- Harness default audit and doctor reachability observation, without default
  promotion or measured-negative activation.
- Explicit project-local transactional `ph attach` for recognized
  Java/Spring/Gradle installations, including ready-install preservation and
  weak-only repair.
- Default-off OpenCode entry steering with selected-session first-user handling
  and bounded status records.
- Public platform/host boundary wording for macOS/Linux + OpenCode, unverified
  Windows, and planned-only Codex adapter.

## Package Boundary

The existing package entries cover `docs/current/release` and `docs/releases`;
this preparation adds no package allowlist expansion. Package contents still
exclude experiments, `.persona/evidence`, test fixtures, and dormant
non-Java/reference material under the established policy.

## Claim Boundary

This pre-publish record does not prove publication, registry behavior, platform
certification, product efficacy, token saving, app quality, security, broad
reliability, or enforcement.
