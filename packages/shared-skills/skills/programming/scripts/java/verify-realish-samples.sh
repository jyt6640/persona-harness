#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP="${TMPDIR:-/tmp}/java-programming-realish"
CHECKER="$ROOT/scripts/java/check-no-excuse-rules.sh"

rm -rf "$TMP"
mkdir -p "$TMP"

uv run "$ROOT/scripts/java/new-project.py" spring-service --group com.acme --path "$TMP" --java-version 21 >/dev/null
(
    cd "$TMP/spring-service"
    "$CHECKER" $(find src -name "*.java" | sort) >/dev/null
    gradle compileJava test check --no-daemon >/dev/null
)

mkdir -p "$TMP/pure-library/src/main/java/com/acme/library" "$TMP/pure-library/src/test/java/com/acme/library"
cat > "$TMP/pure-library/settings.gradle" <<'EOF'
rootProject.name = 'pure-library'
EOF
cat > "$TMP/pure-library/build.gradle" <<'EOF'
plugins {
    id 'java-library'
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

repositories { mavenCentral() }

dependencies {
    testImplementation 'org.junit.jupiter:junit-jupiter:6.1.0'
    testImplementation 'org.assertj:assertj-core:4.0.0-M1'
    testRuntimeOnly 'org.junit.platform:junit-platform-launcher:6.1.0'
}

test { useJUnitPlatform() }
EOF
cat > "$TMP/pure-library/src/main/java/com/acme/library/Email.java" <<'EOF'
package com.acme.library;

import java.util.regex.Pattern;

public record Email(String value) {
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^@]+@[^@]+\\.[^@]+$");

    public Email {
        if (value == null || !EMAIL_PATTERN.matcher(value).matches()) {
            throw new IllegalArgumentException("invalid email");
        }
    }
}
EOF
cat > "$TMP/pure-library/src/test/java/com/acme/library/EmailTest.java" <<'EOF'
package com.acme.library;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class EmailTest {
    @Test
    void new_ReturnsEmail_WhenValueIsValid() {
        Email email = new Email("a@b.com");

        assertThat(email.value()).isEqualTo("a@b.com");
    }

    @Test
    void new_ThrowsIllegalArgumentException_WhenValueIsInvalid() {
        assertThatThrownBy(() -> new Email("bad"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
EOF
(
    cd "$TMP/pure-library"
    "$CHECKER" $(find src -name "*.java" | sort) >/dev/null
    gradle compileJava test check --no-daemon >/dev/null
)

mkdir -p "$TMP/cli-utility/src/main/java/com/acme/cli"
cat > "$TMP/cli-utility/settings.gradle" <<'EOF'
rootProject.name = 'cli-utility'
EOF
cat > "$TMP/cli-utility/build.gradle" <<'EOF'
plugins {
    id 'application'
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

application {
    mainClass = 'com.acme.cli.GreetingCli'
}
EOF
cat > "$TMP/cli-utility/src/main/java/com/acme/cli/GreetingCli.java" <<'EOF'
package com.acme.cli;

public class GreetingCli {
    public static void main(String[] args) {
        String name = args.length == 0 ? "world" : args[0];
        System.out.println(greeting(name));
    }

    static String greeting(String name) {
        if (name == null || name.isBlank()) {
            return "hello, world";
        }
        return "hello, " + name;
    }
}
EOF
(
    cd "$TMP/cli-utility"
    "$CHECKER" $(find src -name "*.java" | sort) >/dev/null
    gradle compileJava check run --args="Ada" --no-daemon | grep -q "hello, Ada"
)

echo "java real-ish samples passed"
