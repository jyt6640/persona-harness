export type CliHelpLocale = "en" | "ko"

export type RootHelpSelection =
  | { readonly kind: "selected"; readonly locale: CliHelpLocale }
  | { readonly kind: "invalid"; readonly message: string }

function parseLocale(value: string): CliHelpLocale | undefined {
  if (value === "en" || value === "ko") {
    return value
  }
  return undefined
}

export function parseRootHelpSelection(args: readonly string[]): RootHelpSelection {
  let locale: CliHelpLocale = "en"
  let localeWasSelected = false

  for (let index = 1; index < args.length; index += 1) {
    const argument = args[index]
    if (argument !== "--lang" && !argument.startsWith("--lang=")) {
      return { kind: "invalid", message: `Unknown help option: ${argument}` }
    }
    if (localeWasSelected) {
      return { kind: "invalid", message: "--lang may be provided only once." }
    }

    const value = argument === "--lang" ? args[index + 1] : argument.slice("--lang=".length)
    if (value === undefined || value.length === 0 || value.startsWith("--")) {
      return { kind: "invalid", message: "--lang requires one of: en, ko." }
    }
    const parsedLocale = parseLocale(value)
    if (parsedLocale === undefined) {
      return { kind: "invalid", message: `Unsupported help language: ${value}. Supported: en, ko.` }
    }
    locale = parsedLocale
    localeWasSelected = true
    if (argument === "--lang") {
      index += 1
    }
  }

  return { kind: "selected", locale }
}
