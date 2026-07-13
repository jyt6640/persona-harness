# Experiments

This directory contains package-external experiment inputs and results. It is
not part of the published npm package.

## Index

- [Intent-detection corpus](intent-detection/README.md): preregistered Korean
  and English prompts for a future measurement run.
- [Entry-intent corpus](entry-intent-corpus/README.md): 32-record bilingual
  preregistration for the default-off OpenCode advisory detector; false negatives
  cost 2 and false positives cost 1. Its deterministic result is corpus-only.
- [P3 adversarial closure fixtures](p3-adversarial-closure-fixtures/README.md):
  source-only P0 audit reproduction fixtures for future integrity regressions.
  The payloads are not authoritative product evidence and do not claim a fix.
- [P3-7 ph init safe upgrade contract](p3-7-ph-init-safe-upgrade-contract/README.md):
  source-only synthetic ownership, conflict, backup, rollback, and rerun
  fixtures for a future safe `ph init` implementation. It does not implement
  `ph init` or claim product behavior.

Experiment material is package-excluded and is not product-quality evidence,
runtime activation authorization, or a default-on decision.
