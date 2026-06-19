#!/usr/bin/env bash
# No-excuse rule checker for the Java programming skill.
# Only rules enforceable via pure text matching live here.
# The deeper rules (rich domain, validation placement, layer direction,
# flow-vs-judgment) are judgment calls — the SKILL.md post-write loop covers them.

set -euo pipefail

if [ $# -eq 0 ]; then
    echo "Usage: $0 <File.java> [File.java ...]" >&2
    exit 2
fi

violations=0
report() {
    echo "::error file=${1},line=${2}::[${3}] ${4}" >&2
    violations=$((violations + 1))
}

is_test_file() {
    case "$1" in
        *Test.java|*Tests.java|*IT.java|*/test/*) return 0 ;;
    esac
    return 1
}

is_domain_file() {
    case "$1" in
        */domain/*) return 0 ;;
    esac
    return 1
}

is_constant_declaration() {
    [[ "$1" =~ static[[:space:]]+final ]]
}

has_exemption() {
    [[ "$1" =~ //[[:space:]]*no-excuse-ok:[[:space:]]*.+ ]]
}

is_main_method_file() {
    [ -f "$1" ] && grep -qE "static[[:space:]]+void[[:space:]]+main[[:space:]]*\(" "$1"
}

for file in "$@"; do
    [ -f "$file" ] || continue
    case "$file" in
        *.java) ;;
        *) continue ;;
    esac

    in_test=0;   is_test_file "$file" && in_test=1
    in_domain=0; is_domain_file "$file" && in_domain=1
    has_main=0;  is_main_method_file "$file" && has_main=1
    optional_vars="$(grep -oE 'Optional<[A-Za-z0-9_?,[:space:].]+>[[:space:]]+[A-Za-z_][A-Za-z0-9_]*' "$file" 2>/dev/null | awk '{print $NF}' | tr '\n' ' ' || true)"

    line_no=0
    while IFS= read -r raw_line || [ -n "$raw_line" ]; do
        line_no=$((line_no + 1))
        line="$raw_line"
        code_only="${line%%//*}"

        # ── Exemption marker: // no-excuse-ok: <reason> ──
        if has_exemption "$line"; then
            continue
        fi

        # ── domain-framework-import: domain must not import framework / infra APIs ──
        if [ "$in_domain" -eq 1 ] && [ "$in_test" -eq 0 ]; then
            domain_import_re='^[[:space:]]*import[[:space:]]+(org\.springframework|jakarta\.persistence|javax\.persistence|jakarta\.servlet|javax\.servlet|org\.hibernate|java\.sql|javax\.sql)\.'
            if [[ "$code_only" =~ $domain_import_re ]]; then
                report "$file" "$line_no" "domain-framework-import" "domain imports framework/infra API — move it to a boundary or adapter"
            fi
        fi

        # ── vague-name: class/interface named *Manager / *Helper / *Util ──
        vague_re='(class|interface)[[:space:]]+[A-Za-z0-9_]*(Manager|Helper|Util)([[:space:]<{]|$)'
        if [[ "$code_only" =~ $vague_re ]]; then
            report "$file" "$line_no" "vague-name" "Manager/Helper/Util names nothing — name by responsibility (Service/Policy/Validator)"
        fi

        # ── raw-type: raw common generic types ─────────────────────────────
        raw_type_re='(^|[<,(=[:space:]])(List|Map|Set|Collection|Iterable|Iterator|Optional|Class|Comparable|Comparator|Supplier|Function|Predicate|Consumer)[[:space:]]+[_a-zA-Z][A-Za-z0-9_]*'
        if [[ "$code_only" =~ $raw_type_re ]]; then
            report "$file" "$line_no" "raw-type" "raw generic type — add type parameters or redesign the signature"
        fi

        # ── optional-get: unsafe Optional.get() ────────────────────────────
        if [[ "$code_only" =~ \.get\(\) ]]; then
            for optional_var in $optional_vars; do
                if [[ "$code_only" =~ (^|[^A-Za-z0-9_])$optional_var[[:space:]]*\.[[:space:]]*get[[:space:]]*\( ]]; then
                    report "$file" "$line_no" "optional-get" "Optional.get() — use orElseThrow/map/ifPresent, or prove presence with // no-excuse-ok: optional"
                fi
            done
        fi

        # ── mutable-static: mutable static field ───────────────────────────
        if [[ "$code_only" =~ ^[[:space:]]*(public|protected|private)?[[:space:]]*static[[:space:]]+ ]] && ! is_constant_declaration "$code_only"; then
            if [[ "$code_only" =~ \; ]]; then
                report "$file" "$line_no" "mutable-static" "mutable static field — introduce an owner/lifecycle or make it static final"
            fi
        fi

        # ── public-field: public non-constant fields ───────────────────────
        if [[ "$code_only" =~ ^[[:space:]]*public[[:space:]]+ ]] && [[ "$code_only" =~ \; ]] && ! is_constant_declaration "$code_only"; then
            if ! [[ "$code_only" =~ ^[[:space:]]*public[[:space:]]+(class|interface|enum|record)[[:space:]] ]]; then
                report "$file" "$line_no" "public-field" "public mutable/exposed field — keep fields private and expose behavior"
            fi
        fi

        # ── domain-record: record declared inside a domain package (entity-as-record smell) ──
        if [ "$in_domain" -eq 1 ] && [ "$in_test" -eq 0 ]; then
            if [[ "$code_only" =~ (public[[:space:]]+|^[[:space:]]*)record[[:space:]]+[A-Z] ]]; then
                report "$file" "$line_no" "domain-record" "record in a domain package — entities are classes; mark a true VO with // no-excuse-ok: vo"
            fi
        fi

        # ── setter: public void setX(...) on a domain object ──
        if [ "$in_domain" -eq 1 ]; then
            setter_re='void[[:space:]]+set[A-Z][A-Za-z0-9_]*[[:space:]]*\('
            if [[ "$code_only" =~ $setter_re ]]; then
                report "$file" "$line_no" "setter" "setter on a domain object — use named behavior or return a new instance"
            fi
        fi

        # ── field-injection: @Autowired on a field ──
        if [[ "$code_only" =~ @Autowired ]]; then
            report "$file" "$line_no" "field-injection" "@Autowired field — use constructor injection (@RequiredArgsConstructor + final)"
        fi

        # ── printf-debug: System.out/err.print* outside main/test ──
        if [[ "$code_only" =~ System\.(out|err)\.print ]]; then
            if [ "$in_test" -eq 0 ] && [ "$has_main" -eq 0 ]; then
                report "$file" "$line_no" "printf-debug" "System.out/err.print* — use SLF4J (@Slf4j)"
            fi
        fi

        # ── printstacktrace ──
        if [[ "$code_only" =~ \.printStackTrace\( ]]; then
            report "$file" "$line_no" "printstacktrace" "e.printStackTrace() — log via SLF4J with context"
        fi

        # ── broad-catch: catch (Exception|Throwable ...) outside tests ──
        broad_re='catch[[:space:]]*\([[:space:]]*(Exception|Throwable)([[:space:]]|\))'
        if [[ "$code_only" =~ $broad_re ]]; then
            if [ "$in_test" -eq 0 ]; then
                report "$file" "$line_no" "broad-catch" "catch (Exception/Throwable) — narrow it, or // no-excuse-ok: catch at a boundary"
            fi
        fi

        # ── empty-catch: catch (...) {} ──
        empty_catch_re='catch[[:space:]]*\(.*\)[[:space:]]*\{[[:space:]]*\}'
        if [[ "$code_only" =~ $empty_catch_re ]]; then
            report "$file" "$line_no" "empty-catch" "empty catch block — handle or rethrow"
        fi

        # ── raw-runtime-throw: throw new RuntimeException("literal") ──
        if [[ "$code_only" =~ throw[[:space:]]+new[[:space:]]+RuntimeException\([[:space:]]*\" ]]; then
            report "$file" "$line_no" "raw-runtime-throw" "throw new RuntimeException(\"...\") — use a domain exception + ErrorCode"
        fi

        # ── test-name-convention: methodName_ExpectedResult_TestState ─────
        if [ "$in_test" -eq 1 ]; then
            test_method_re='^[[:space:]]*(public|private|protected)?[[:space:]]*void[[:space:]]+([a-z][A-Za-z0-9]*)_([A-Z][A-Za-z0-9]*)_((When|If)[A-Z][A-Za-z0-9]*)[[:space:]]*\('
            any_void_method_re='^[[:space:]]*(public|private|protected)?[[:space:]]*void[[:space:]]+([A-Za-z_][A-Za-z0-9_]*)[[:space:]]*\('
            if [[ "$code_only" =~ $any_void_method_re ]]; then
                method_name="${BASH_REMATCH[2]}"
                if [[ "$method_name" != "setUp" ]] && [[ "$method_name" != "tearDown" ]] && [[ "$method_name" != "beforeEach" ]] && [[ "$method_name" != "afterEach" ]]; then
                    if ! [[ "$code_only" =~ $test_method_re ]]; then
                        report "$file" "$line_no" "test-name-convention" "test method must be methodName_ExpectedResult_TestState"
                    fi
                fi
            fi
        fi

        # ── todo-no-owner ──
        if echo "$line" | grep -qE '(TODO|FIXME|XXX)([[:space:]]|:)'; then
            if ! echo "$line" | grep -qE '(TODO|FIXME|XXX).*[(@[]'; then
                report "$file" "$line_no" "todo-no-owner" "TODO/FIXME requires (#issue) or @owner attribution"
            fi
        fi
    done < "$file"
done

if [ "$violations" -gt 0 ]; then
    echo "" >&2
    echo "java-programmer: $violations violation(s). Then run:" >&2
    echo "  ./gradlew compileJava test check" >&2
    exit 1
fi

echo "java-programmer: no-excuse rules passed for $# file(s)."
