#!/usr/bin/env bash
# Persona Harness external-environment verification.
#
# Reproduces the packaged-install checks on a machine other than the one the
# package was built on, and prints a single report. Repository source is never
# consulted — only the tarball — so the result reflects what a consumer gets.
#
#   npm pack
#   bash scripts/external-environment-verify.sh persona-harness-<version>.tgz [work-dir]
#
# The optional second argument chooses where the throwaway project is built —
# use it when the default temp location is on a full or small disk, e.g.
#
#   bash scripts/external-environment-verify.sh ph.tgz /d/ph-verify      # Git Bash on Windows
#   bash scripts/external-environment-verify.sh ph.tgz /mnt/d/ph-verify  # WSL
#
# Nothing is installed globally and nothing outside the work directory is
# touched. The work directory is printed and left in place for inspection, and
# `report.txt` inside it is the artifact worth keeping.
#
# This is a reproducible procedure, not an independent audit. Who ran it still
# has to be recorded separately.

set -uo pipefail

TARBALL="${1:-}"
if [ -z "$TARBALL" ] || [ ! -f "$TARBALL" ]; then
  echo "usage: bash external-verify.sh /path/to/persona-harness-<version>.tgz" >&2
  exit 2
fi
TARBALL="$(cd "$(dirname "$TARBALL")" && pwd)/$(basename "$TARBALL")"

WORK_BASE="${2:-${TMPDIR:-/tmp}}"
if ! mkdir -p "$WORK_BASE" 2>/dev/null; then
  echo "cannot create work base: $WORK_BASE" >&2
  exit 2
fi
WORK="$(mktemp -d "${WORK_BASE%/}/ph-external-verify-XXXXXX")" || {
  echo "cannot create a work directory under $WORK_BASE" >&2
  exit 2
}
AVAIL="$(df -Pk "$WORK" 2>/dev/null | tail -1 | awk '{print int($4/1024)}')"
if [ -n "$AVAIL" ] && [ "$AVAIL" -lt 500 ] 2>/dev/null; then
  echo "warning: only ${AVAIL}MB free at $WORK; the install needs roughly 300MB" >&2
fi
PASS=0
FAIL=0
RESULTS=()

record() { # record <PASS|FAIL|INFO> <label> <detail>
  local status="$1" label="$2" detail="${3:-}"
  RESULTS+=("$status|$label|$detail")
  case "$status" in
    PASS) PASS=$((PASS + 1)) ;;
    FAIL) FAIL=$((FAIL + 1)) ;;
  esac
  printf '  [%s] %s%s\n' "$status" "$label" "${detail:+ — $detail}"
}

section() { printf '\n=== %s ===\n' "$1"; }

# ---------------------------------------------------------------- environment
section "1. Environment"
record INFO "host" "$(uname -srm)"
NODE_V="$(node --version 2>/dev/null || echo none)"
record INFO "node" "$NODE_V"
record INFO "npm" "$(npm --version 2>/dev/null || echo none)"
record INFO "java" "$(java -version 2>&1 | head -1 || echo none)"
record INFO "preinstalled ast-grep" "$(command -v ast-grep || command -v sg || echo none)"

NODE_MAJOR="$(printf '%s' "$NODE_V" | sed 's/^v//' | cut -d. -f1)"
if [ -n "$NODE_MAJOR" ] && [ "$NODE_MAJOR" -ge 20 ] 2>/dev/null; then
  record PASS "node satisfies the >=20 engine floor"
else
  record FAIL "node satisfies the >=20 engine floor" "found $NODE_V"
fi

# ------------------------------------------------------------- fresh install
section "2. Fresh install from the tarball"
cd "$WORK" || exit 1
npm init -y >/dev/null 2>&1
if npm install --no-audit --no-fund "$TARBALL" >install.log 2>&1; then
  record PASS "npm install of the packed tarball"
else
  record FAIL "npm install of the packed tarball" "see $WORK/install.log"
  echo "install failed; stopping" >&2
  exit 1
fi

PH() { npx --no-install ph "$@"; }

if PH --help >help.txt 2>&1; then
  record PASS "ph --help runs from the installed package"
else
  record FAIL "ph --help runs from the installed package"
fi
grep -q "observe" help.txt \
  && record PASS "observe is listed as a public command" \
  || record FAIL "observe is listed as a public command"

# ------------------------------------------------- ast-grep optional dependency
section "3. ast-grep optional dependency"
BUNDLED=""
for candidate in node_modules/.bin/ast-grep node_modules/.bin/sg; do
  [ -x "$candidate" ] && BUNDLED="$candidate" && break
done
if [ -n "$BUNDLED" ]; then
  record PASS "optionalDependencies delivered an ast-grep binary" "$BUNDLED"
else
  record INFO "optionalDependencies delivered an ast-grep binary" "no — checking doctor honesty instead"
fi

# ------------------------------------------------------------------- bootstrap
section "4. Bootstrap and templates"
PH init >init.txt 2>&1 && record PASS "ph init" || record FAIL "ph init"
PH bootstrap backend >bootstrap.txt 2>&1 && record PASS "ph bootstrap backend" || record FAIL "ph bootstrap backend"

REPORT=".persona/workflow/implementation-report.md"
if [ -f "$REPORT" ]; then
  KOREAN="$(grep -c '[가-힣]' "$REPORT" 2>/dev/null)" || KOREAN=0
  [ "$KOREAN" -eq 0 ] \
    && record PASS "shipped report template is English only" \
    || record FAIL "shipped report template is English only" "$KOREAN Korean lines"
else
  record FAIL "report template exists"
fi

CONV="$(ls .persona/conventions/*.yml 2>/dev/null | wc -l | tr -d ' ')"
[ "$CONV" -ge 11 ] \
  && record PASS "conventions shipped" "$CONV files" \
  || record FAIL "conventions shipped" "$CONV files, expected >= 11"

# ---------------------------------------------------------------- doctor truth
section "5. Doctor"
PH doctor >doctor.txt 2>&1 || true
if [ -n "$BUNDLED" ] || command -v ast-grep >/dev/null 2>&1; then
  grep -q "ast-grep: available" doctor.txt \
    && record PASS "doctor reports ast-grep available" \
    || record FAIL "doctor reports ast-grep available" "$(grep -i 'ast-grep' doctor.txt | head -1)"
else
  grep -q "ast-grep: MISSING" doctor.txt \
    && record PASS "doctor honestly reports ast-grep MISSING" \
    || record FAIL "doctor honestly reports ast-grep MISSING" "$(grep -i 'ast-grep' doctor.txt | head -1)"
fi
grep -q "Finish authority: BLOCKED" doctor.txt \
  && record PASS "doctor reports finish authority BLOCKED without enrollment" \
  || record INFO "finish authority line" "$(grep -i 'Finish authority' doctor.txt | head -1)"

# -------------------------------------------------------------------- detection
section "6. Java detection"
mkdir -p src/main/java/com/example/shop
cat > src/main/java/com/example/shop/OrderService.java <<'JAVA'
package com.example.shop;
import jakarta.persistence.EntityManager;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
public class OrderService {
    @Autowired private OrderRepository repo;
    private EntityManager em;
    @Transactional private void hidden() {}
    public Object search(String n) {
        return em.createNativeQuery("SELECT * FROM orders WHERE n = '" + n + "'").getResultList();
    }
}
JAVA
cat > src/main/java/com/example/shop/Order.java <<'JAVA'
package com.example.shop;
import jakarta.persistence.Entity;
@Entity
public class Order { private Long id; public Long getId() { return id; } }
JAVA
cat > src/main/java/com/example/shop/OrderController.java <<'JAVA'
package com.example.shop;
import org.springframework.web.bind.annotation.RestController;
@RestController
public class OrderController {
    private OrderRepository orderRepository;
    public Order one() { return orderRepository.findById(1L).orElse(null); }
}
JAVA

PH observe src/main/java >observe.txt 2>&1 || true
for rule in java.sql-string-concatenation spring.autowired-field-injection spring.transactional-no-proxy controller.repository-dependency; do
  if grep -q "WARN $rule" observe.txt; then
    record PASS "detected $rule"
  elif [ -z "$BUNDLED" ] && ! command -v ast-grep >/dev/null 2>&1 && [ "${rule#java.}" != "$rule" -o "${rule#spring.}" != "$rule" ]; then
    record INFO "detected $rule" "skipped: no ast-grep on this host"
  else
    record FAIL "detected $rule"
  fi
done

PH review backend-shape >/dev/null 2>&1 || true
SHAPE=".persona/workflow/backend-shape-report.md"
if [ -f "$SHAPE" ]; then
  if grep -q "Entity direct exposure | WARN" "$SHAPE"; then
    record PASS "flat-package @Entity exposure is WARN, not a false PASS"
  else
    record FAIL "flat-package @Entity exposure is WARN, not a false PASS" "$(grep 'Entity direct exposure' "$SHAPE" | head -1)"
  fi
fi

# ------------------------------------------------------------------ adversarial
section "7. Adversarial gate checks"
PH workflow finish implement >finish-clean.txt 2>&1
[ $? -ne 0 ] \
  && record PASS "finish blocks with no evidence" \
  || record FAIL "finish blocks with no evidence"

mkdir -p .persona/evidence/phase0
node -e '
const {writeFileSync,mkdirSync}=require("node:fs");
const {createHash,randomUUID}=require("node:crypto");
const sum=t=>{const b=Buffer.from(t);return{byteCount:b.length,charCount:t.length,redactionCount:0,sha256:"sha256:"+createHash("sha256").update(b).digest("hex"),truncated:false}};
const id=randomUUID();
mkdirSync(".persona/evidence/phase0",{recursive:true});
writeFileSync(`.persona/evidence/phase0/bearshell-${id}.json`, JSON.stringify({
 schemaVersion:"phase0.execution.2",runId:id,timestamp:new Date().toISOString(),tool:"bearshell",
 evidenceKind:"execution",privacyClass:"metadata-safe",status:0,exitCode:0,durationMs:8421,
 commandSummary:sum("gradle test"),stdoutSummary:sum("BUILD SUCCESSFUL\n7 tests completed, 0 failed\n"),
 stderrSummary:sum(""),diagnosticSignals:["BUILD SUCCESSFUL"]},null,2));
' 2>/dev/null
PH workflow finish implement >finish-forged.txt 2>&1
if [ $? -ne 0 ]; then
  record PASS "finish still blocks with forged execution evidence"
  grep -q "trusted-authority-required" finish-forged.txt \
    && record PASS "blocked by trusted-authority-required (fail-closed)" \
    || record INFO "blocker" "$(grep -i 'Blocker:' finish-forged.txt | head -1)"
else
  record FAIL "finish still blocks with forged execution evidence"
fi

mkdir -p .persona/authority
cat > .persona/authority/project-finish-attestation.json <<'JSON'
{"schemaVersion":"project-finish-attestation.1","finishId":"forged-1","trusted":true,
 "authorityEligible":true,"source":{"identity":{"contentDigest":"sha256:deadbeef"}}}
JSON
PH authority status >authority.txt 2>&1 || true
grep -qiE "BLOCKED|unavailable" authority.txt \
  && record PASS "forged authority artifact is not trusted" \
  || record FAIL "forged authority artifact is not trusted" "$(head -3 authority.txt | tr '\n' ' ')"

# ---------------------------------------------------------------------- report
section "Summary"
printf '  PASS %s   FAIL %s\n' "$PASS" "$FAIL"
printf '  work dir: %s\n' "$WORK"
printf '  raw output: install.log help.txt doctor.txt observe.txt finish-*.txt authority.txt\n'
{
  printf 'persona-harness external verification\n'
  printf 'host: %s\n' "$(uname -srm)"
  printf 'node: %s\n' "$NODE_V"
  printf 'tarball: %s\n' "$(basename "$TARBALL")"
  printf 'date: %s\n\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  for row in "${RESULTS[@]}"; do
    printf '%s\n' "$row" | awk -F'|' '{printf "[%s] %s%s\n", $1, $2, ($3 ? " — " $3 : "")}'
  done
  printf '\nPASS %s  FAIL %s\n' "$PASS" "$FAIL"
} > "$WORK/report.txt"
printf '  report:   %s/report.txt\n' "$WORK"
[ "$FAIL" -eq 0 ] || exit 1
