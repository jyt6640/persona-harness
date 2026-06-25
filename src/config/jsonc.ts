export function stripJsonComments(input: string): string {
  let output = ""
  let index = 0
  let inString = false
  let escaped = false

  while (index < input.length) {
    const current = input[index]
    const next = input[index + 1]

    if (inString) {
      output += current
      if (escaped) {
        escaped = false
      } else if (current === "\\") {
        escaped = true
      } else if (current === "\"") {
        inString = false
      }
      index += 1
      continue
    }

    if (current === "\"") {
      inString = true
      output += current
      index += 1
      continue
    }

    if (current === "/" && next === "/") {
      while (index < input.length && input[index] !== "\n") {
        index += 1
      }
      continue
    }

    if (current === "/" && next === "*") {
      index += 2
      while (index < input.length && !(input[index] === "*" && input[index + 1] === "/")) {
        index += 1
      }
      index += 2
      continue
    }

    output += current
    index += 1
  }

  return output
}
