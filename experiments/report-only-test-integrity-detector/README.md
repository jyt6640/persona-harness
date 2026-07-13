# Report-Only Test-Integrity Detector Evidence

This is a source-only, deterministic research corpus for report-only test
integrity findings. It does not call `ph`, execute a product command, inspect a
real project, use the network, or grant workflow finish authority.

The corpus covers two candidate warning signals:

- `TEST-EMPTY-JUNIT`: a JUnit-shaped test method with no assertion or
  interaction verification.
- `TEST-DISABLED-REASON`: a JUnit-shaped disabled test without a usable reason.

`validate.mjs --validate` checks the immutable corpus and canonical lock.
`validate.mjs --candidate reference-candidate.json` evaluates a synthetic
detector output against the frozen record set. The evaluator reports precision
and recall as diagnostic research output only. A self-consistent local digest
or `generatedBy` value remains `evidenceTrust: "untrusted"` and
`finishAuthority: "not-authorized"`.

The canonical lock pins record order and IDs, semantic metadata, payload root,
payload and transcript paths and hashes, transcript command identity and
outputs, negative escape paths, and the no-product boundary. A change to
payload or transcript bytes is rejected even when a mutable manifest hash is
updated. Existing cases cannot be relabeled or extended in place; a future
change needs an intentionally versioned lock and separate result.

All results are source-only diagnostic evidence. This unit makes no
efficacy, adoption, reliability, security, Stable, GA, latest, or product
enforcement claim.
