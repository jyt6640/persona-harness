export function personaCliUsage(invocationName: string): string {
  return [
    `Usage: ${invocationName} <command> [args...]`,
    "",
    "Public commands:",
    "  version                      Print the packaged Persona Harness version.",
    "  init                         Install Persona Harness config and OpenCode plugin config.",
    "  go <goal> | --stdin           Host-neutral single entry from a concrete goal to the current ticket and implementation rail.",
    "  doctor                       Diagnose local OpenCode and Persona Harness installation state.",
    "",
    "Examples:",
    `  ${invocationName} version`,
    `  ${invocationName} --version`,
    `  ${invocationName} init`,
    `  ${invocationName} go "Add a task creation endpoint."`,
    `  printf "Add task creation." | ${invocationName} go --stdin`,
    `  ${invocationName} doctor`,
  ].join("\n")
}
