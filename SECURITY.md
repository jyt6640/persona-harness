# Security Policy

## Scope

Persona Harness is a local CLI and OpenCode plugin. It runs commands on your
machine. In particular, `ph bearshell` is **not a sandbox** — it bounds runtime
and output size, but commands still execute with your permissions. Treat any
project profile, policy, or rule file you install as code you are choosing to
run.

## Trust boundaries

- PH runs locally and may read and write `.persona/` files.
- PH runs verification commands only when you invoke them.
- `ph bearshell` runs commands with **your** permissions. It is **not a
  sandbox** — it bounds runtime and output size only.
- Run PH in projects you trust, do not run `ph bearshell` on untrusted
  commands, and keep secrets out of evidence files.

PH does not claim sandboxing, remote isolation, safety on malicious projects, or
any secret-protection guarantee.

## Supported versions

Only the current published `latest` and `next` npm channels receive security
fixes. Alpha and older tags do not.

## Reporting a vulnerability

Please do **not** open a public issue for a security problem.

Use GitHub's private vulnerability reporting on this repository
("Security" tab → "Report a vulnerability"), or email the maintainer at the
address on the npm package page.

Include: affected version, reproduction steps, and impact. You'll get an
acknowledgement as soon as the maintainer sees it. This is a single-maintainer
project, so response time is best-effort, not contractual.
