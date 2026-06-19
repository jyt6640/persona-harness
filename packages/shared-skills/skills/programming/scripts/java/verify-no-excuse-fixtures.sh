#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CHECKER="$ROOT/scripts/java/check-no-excuse-rules.sh"
FIXTURES="$ROOT/fixtures/java/no-excuse"

pass_files="$(find "$FIXTURES/pass" -name "*.java" | sort)"
"$CHECKER" $pass_files >/dev/null

for dir in "$FIXTURES"/fail/*; do
    [ -d "$dir" ] || continue
    rule="$(basename "$dir")"
    files="$(find "$dir" -name "*.java" | sort)"
    set +e
    output="$("$CHECKER" $files 2>&1)"
    status=$?
    set -e
    if [ "$status" -eq 0 ]; then
        echo "expected failure for $rule" >&2
        exit 1
    fi
    if ! grep -q "\\[$rule\\]" <<<"$output"; then
        echo "missing expected rule $rule" >&2
        echo "$output" >&2
        exit 1
    fi
done

echo "java no-excuse fixtures passed"
