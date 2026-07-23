import { readdir, readFile, writeFile } from "node:fs/promises"
import { resolve, relative } from "node:path"

const projectDir = process.argv.includes("--project")
  ? resolve(process.argv[process.argv.indexOf("--project") + 1] ?? ".")
  : process.cwd()
const checkOnly = process.argv.includes("--check")

const resultsDir = resolve(projectDir, "docs/current/acceptance-results/results")
const indexPath = resolve(projectDir, "docs/current/acceptance-results/README.md")

const requiredFields = [
  "title",
  "date",
  "source",
  "package",
  "mode",
  "result",
  "archive",
  "acceptance",
  "ab",
]

function parseScalar(value) {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function parseFrontmatter(source, filePath) {
  if (!source.startsWith("---\n")) {
    throw new Error(`${filePath} is missing frontmatter`)
  }

  const end = source.indexOf("\n---\n", 4)
  if (end === -1) {
    throw new Error(`${filePath} has unterminated frontmatter`)
  }

  const frontmatter = source.slice(4, end).split("\n")
  const data = {}
  let currentListKey = undefined

  for (const line of frontmatter) {
    if (line.trim() === "") {
      continue
    }
    const listMatch = /^  - (.+)$/.exec(line)
    if (listMatch !== null && currentListKey !== undefined) {
      data[currentListKey].push(parseScalar(listMatch[1]))
      continue
    }

    const fieldMatch = /^([A-Za-z0-9_-]+):(.*)$/.exec(line)
    if (fieldMatch === null) {
      throw new Error(`${filePath} has unsupported frontmatter line: ${line}`)
    }

    const [, key, rawValue] = fieldMatch
    if (rawValue.trim() === "") {
      data[key] = []
      currentListKey = key
    } else {
      data[key] = parseScalar(rawValue)
      currentListKey = undefined
    }
  }

  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === "") {
      throw new Error(`${filePath} is missing required frontmatter field: ${field}`)
    }
  }

  return data
}

async function readResults() {
  const entries = await readdir(resultsDir, { withFileTypes: true })
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => resolve(resultsDir, entry.name))
    .sort()

  const results = []
  for (const file of files) {
    const source = await readFile(file, "utf8")
    const data = parseFrontmatter(source, file)
    results.push({
      ...data,
      file,
      relativePath: relative(resolve(projectDir, "docs/current/acceptance-results"), file),
    })
  }

  return results.sort((a, b) => {
    const byDate = String(b.date).localeCompare(String(a.date))
    if (byDate !== 0) {
      return byDate
    }
    return String(a.title).localeCompare(String(b.title))
  })
}

function renderIndex(results) {
  const rows = results
    .map((result) => {
      const title = `[${result.title}](${result.relativePath})`
      const source = String(result.source).slice(0, 12)
      return `| ${result.date} | ${result.result} | ${result.mode} | ${result.package} | \`${source}\` | ${title} | ${result.acceptance} | ${result.ab} |`
    })
    .join("\n")

  return `# Acceptance Results

This docs package stores Persona Harness acceptance-test and A/B measurement
results. Add one Markdown file under \`results/\` for each accepted run, then
regenerate this index with:

\`\`\`bash
npm run docs:acceptance-results
\`\`\`

CI/docs checks can verify the generated index with:

\`\`\`bash
npm run check:acceptance-results
\`\`\`

## Result Records

| Date | Result | Mode | Package | Source | Record | Acceptance | A/B |
| --- | --- | --- | --- | --- | --- | --- | --- |
${rows}

## Rules

- Record acceptance results here instead of expanding \`CHANGELOG.md\` with
  long evidence transcripts.
- Keep each record scoped to the evidence it actually supports.
- Use PASS / PARTIAL / FAIL / N.A language and keep no-claim boundaries clear.
- Negative or inconclusive A/B evidence is still valid evidence.
- Do not record automatic downgrade/removal, token-saving, product-efficacy,
  app-quality, broad reliability, closure guarantee, or release claims unless a
  separate accepted evidence path supports that exact claim.
- This generated index cannot select a historical docs/current/ record as
  current workflow lifecycle or release guidance; use the canonical docs index
  and current docs pointer for that selection.

Template: [TEMPLATE.md](TEMPLATE.md)
`
}

async function main() {
  const results = await readResults()
  const rendered = renderIndex(results)

  if (checkOnly) {
    const current = await readFile(indexPath, "utf8")
    if (current !== rendered) {
      throw new Error(
        `${relative(projectDir, indexPath)} is stale; run npm run docs:acceptance-results`,
      )
    }
    console.log(`Acceptance results index check: PASS (${results.length} result records)`)
    return
  }

  await writeFile(indexPath, rendered)
  console.log(`Acceptance results index written: ${relative(projectDir, indexPath)}`)
  console.log(`Acceptance result records: ${results.length}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
