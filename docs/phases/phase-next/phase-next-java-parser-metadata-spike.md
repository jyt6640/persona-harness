# Java Parser Metadata Spike

## Goal

`java-parser` 후보를 구현하지 않고 no-install metadata spike로 확인하고, Candidate A를 유지할지 `tree-sitter-java` fallback으로 바꿀지 결정한다.

이번 loop는 package metadata 확인만 한다. dependency 설치, parser 실행, observer 구현, linter/Guard 구현, enforcement gate, build/test failure 연결은 하지 않는다.

## Constraints

- No dependency install.
- No parser execution.
- No observer implementation.
- No linter or Guard implementation.
- No enforcement gate.
- No build/test failure connection.
- No product-quality guarantee.

## Metadata Commands

확인에 사용한 command:

```sh
npm view java-parser name version description main module type types typings exports repository.url license dependencies peerDependencies engines dist.unpackedSize --json
npm view tree-sitter-java name version description main module type types typings exports repository.url license dependencies peerDependencies engines dist.unpackedSize --json
npm view java-parser readme --json
npm view tree-sitter-java readme --json
npm view java-parser homepage bugs.url dist.tarball time.modified keywords maintainers --json
npm view tree-sitter-java homepage bugs.url dist.tarball time.modified keywords maintainers --json
```

These commands read npm registry metadata only. They did not install or execute either parser.

## Candidate A: `java-parser`

Observed metadata:

- package: `java-parser`
- version: `3.0.1`
- description: `Java Parser in JavaScript`
- module format: ESM, via `"type": "module"`
- exported entry: `./src/index.js`
- TypeScript types: `./api.d.ts`
- license: `Apache-2.0`
- dependencies: `chevrotain`, `chevrotain-allstar`, `lodash`
- unpacked size: `257064`
- registry modified: `2025-08-07T04:54:38.933Z`

Metadata interpretation:

- The package is small enough for a later minimal prototype.
- ESM matches the current Persona Harness package shape, which also uses `"type": "module"`.
- Published TypeScript declarations reduce integration risk for a TypeScript test/prototype loop.
- No native binding or JVM sidecar appears in the metadata.
- The npm metadata did not expose README details for parse export shape or visitor API shape, so those remain unconfirmed until an approved install/compile spike.

## Candidate B: `tree-sitter-java`

Observed metadata:

- package: `tree-sitter-java`
- version: `0.23.5`
- description: `Java grammar for tree-sitter`
- main: `bindings/node`
- TypeScript types: `bindings/node`
- license: `MIT`
- dependencies: `node-addon-api`, `node-gyp-build`
- peer dependency: `tree-sitter`
- unpacked size: `6223115`
- registry modified: `2024-12-21T18:26:25.678Z`
- README metadata identifies it as a Java grammar for tree-sitter.

Metadata interpretation:

- It remains a credible structured parsing fallback.
- Native binding packaging and a `tree-sitter` peer dependency make the first prototype surface larger than Candidate A.
- It may become preferable if partial-source tolerance, explicit parse-error inspection, or tree-sitter query ergonomics become the main requirement.

## Decision

Maintain **Candidate A: `java-parser`** as the first structured parser observation candidate.

Keep **Candidate B: `tree-sitter-java`** as fallback, not as the default next implementation candidate.

## Why

`java-parser` metadata fits the current TypeScript/Node harness better:

- ESM package shape aligns with this repo.
- Type declarations are published.
- No native addon, peer parser package, JVM sidecar, or external linter runtime is visible in metadata.
- The package is smaller and should make a later report-only prototype easier to bound.

`tree-sitter-java` should not replace Candidate A yet because its metadata shows more moving parts before the project has proven that structured parser observation is worth the additional surface.

## Unconfirmed

No-install metadata does not prove:

- exact `parse` export shape
- exact visitor API shape
- TypeScript compile behavior in this repo
- parser tolerance on partial Java source
- concrete node paths for import, field, constructor parameter, or method-call evidence

These remain follow-up checks for a later approved dependency/install spike or minimal prototype loop.

## Boundary

This decision is not:

- an AST implementation
- a linter implementation
- a Guard implementation
- an enforcement gate
- a build/test failure path
- a product-quality guarantee

Candidate A should still be described as CST-backed structured parsing, not true AST semantics.

## Next Loop

Completed follow-up:

```text
Run an approved minimal dependency/compile spike for `java-parser` only,
checking import/type shape without implementing observer logic.
```

The compile/import spike installed `java-parser` as a dev dependency and confirmed:

- ESM named imports compile for `parse`, `lexAndParse`, `BaseJavaCstVisitor`, and `BaseJavaCstVisitorWithDefaults`.
- Runtime import exposes those names as functions/constructors.
- Published types expose `CstNode`, `IToken`, `JavaCstVisitor`, and `JavaCstVisitorWithDefaults`.
- The spike did not call `parse`, implement observer traversal, add linter/Guard behavior, or connect findings to build/test failure.

Limitation:

- `npm audit` reports 6 transitive vulnerabilities through `java-parser`/Chevrotain/Lodash. The available npm audit fix points to `java-parser@0.3.2`, which is a semver-major downgrade relative to `3.0.1`, so this loop does not apply it.

Dependency hygiene follow-up:

- Phase 1.2 later deferred parser-backed observation and kept the string-based report-only observer.
- Because the package was only used by the compile/import spike test, `java-parser` was removed from `package.json` and `package-lock.json`.
- The spike remains documented as historical evidence, not as an active package dependency.

Recommended next loop:

```text
If parser-backed observation is revisited later, select and install a parser dependency in that future loop,
with transitive audit surface reviewed again at that time.
```

Alternative next loop:

```text
Continue with non-parser Phase candidates while Phase 1.2 keeps the string-based report-only observer.
```
