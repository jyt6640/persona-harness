#!/usr/bin/env -S uv run --script
# noqa: SIZE_OK - scaffold templates are a single data table; splitting hides the generated shape.
# /// script
# requires-python = ">=3.11"
# dependencies = ["typer", "rich"]
# ///

# ─── How to run ───
#   uv run new-project.py my-service
#   uv run new-project.py my-service --group com.acme --path ./projects
# ──────────────────
#
# NOTE: This scaffolds the code seams of the default stack — Spring Boot + Web MVC +
# Spring Data JPA (with domain/entity SEPARATION: pure-POJO domain entity + a separate
# @Entity in infrastructure) + Flyway + Bean Validation + Lombok, plus a Fake-based Service
# test. Operational seams (Spring Security, springdoc, Actuator, Testcontainers, Docker, CI)
# are defaults too but added per project to keep the starter minimal. The philosophy is
# technology-agnostic — a harness may swap any seam and stay conformant.
# See references/java/technology-seams.md.
#
# Scaffolds a domain-first, layered Spring Boot project:
#   <pkg>/Application.java
#   <pkg>/global/exception/...                    (ErrorCode, base + custom exceptions, handler)
#   <pkg>/member/{presentation,application,domain,infrastructure}/...   one sample slice
#   src/test/.../member/domain/fake/FakeMemberRepository.java + MemberServiceTest.java
#
# The `member` slice is a TEMPLATE to copy for the next domain — not a base to extend.
# Templates are data (a single dict); the logic stays small.

from __future__ import annotations

import sys
from pathlib import Path
from string import Template

import typer
from rich.console import Console

console = Console(stderr=True)

DEFAULT_JAVA_VERSION = 25
DEFAULT_SPRING_BOOT_VERSION = "4.1.0"
DEFAULT_DEPENDENCY_MANAGEMENT_VERSION = "1.1.7"
DEFAULT_GRADLE_VERSION = "9.5.1"

# Each entry: relative output path (with $-placeholders) -> file body (with $-placeholders).
FILES: dict[str, str] = {
    "settings.gradle": "rootProject.name = '$name'\n",
    "build.gradle": """\
plugins {
    id 'org.springframework.boot' version '$spring_boot_version'
    id 'io.spring.dependency-management' version '$dependency_management_version'
    id 'java'
}
group = '$group'
version = '0.0.1-SNAPSHOT'
java {
    toolchain {
        languageVersion = JavaLanguageVersion.of($java_version)
    }
}
repositories { mavenCentral() }
dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-web'
    implementation 'org.springframework.boot:spring-boot-starter-data-jpa'
    implementation 'org.springframework.boot:spring-boot-starter-validation'
    implementation 'org.flywaydb:flyway-core'
    compileOnly 'org.projectlombok:lombok'
    annotationProcessor 'org.projectlombok:lombok'
    runtimeOnly 'com.h2database:h2'           // local/dev; prod uses MySQL/PostgreSQL
    testImplementation 'org.springframework.boot:spring-boot-starter-test'
    testRuntimeOnly 'org.junit.platform:junit-platform-launcher'
    testCompileOnly 'org.projectlombok:lombok'
    testAnnotationProcessor 'org.projectlombok:lombok'
}
test { useJUnitPlatform() }
""",
    "src/main/resources/application.yml": """\
spring:
  application:
    name: $name
  datasource:
    url: jdbc:h2:mem:$artifact;MODE=MySQL;DB_CLOSE_DELAY=-1
    username: sa
  jpa:
    hibernate:
      ddl-auto: validate          # Flyway owns the schema; Hibernate only validates
    open-in-view: false
  flyway:
    enabled: true
server:
  port: 8080
""",
    "src/main/resources/db/migration/V1__init.sql": """\
CREATE TABLE member (
    id    BIGINT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name  VARCHAR(100) NOT NULL
);
""",
    "src/main/java/$pkgpath/Application.java": """\
package $pkg;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
""",
    # ── global/exception ──
    "src/main/java/$pkgpath/global/exception/ErrorCode.java": """\
package $pkg.global.exception;

public interface ErrorCode {
    String getCode();
    String getMessage();
}
""",
    "src/main/java/$pkgpath/global/exception/CommonErrorCode.java": """\
package $pkg.global.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum CommonErrorCode implements ErrorCode {

    INVALID_REQUEST_BODY("COMMON_INVALID_REQUEST_BODY", "요청 형식이 올바르지 않습니다."),
    INTERNAL_SERVER_ERROR("COMMON_INTERNAL_SERVER_ERROR", "서버 오류가 발생했습니다.");

    private final String code;
    private final String message;
}
""",
    "src/main/java/$pkgpath/global/exception/ErrorResponse.java": """\
package $pkg.global.exception;

public record ErrorResponse(String message) {
}
""",
    "src/main/java/$pkgpath/global/exception/customException/BaseException.java": """\
package $pkg.global.exception.customException;

import lombok.Getter;
import $pkg.global.exception.ErrorCode;

@Getter
public class BaseException extends RuntimeException {

    private final ErrorCode errorCode;

    public BaseException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }
}
""",
    "src/main/java/$pkgpath/global/exception/customException/BusinessException.java": """\
package $pkg.global.exception.customException;

import $pkg.global.exception.ErrorCode;

public class BusinessException extends BaseException {
    public BusinessException(ErrorCode errorCode) {
        super(errorCode);
    }
}
""",
    "src/main/java/$pkgpath/global/exception/GlobalExceptionHandler.java": """\
package $pkg.global.exception;

import java.util.Map;
import org.springframework.context.support.DefaultMessageSourceResolvable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import $pkg.global.exception.customException.BaseException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Map<String, HttpStatus> STATUS_BY_ERROR_CODE = Map.of(
            CommonErrorCode.INVALID_REQUEST_BODY.getCode(), HttpStatus.BAD_REQUEST,
            CommonErrorCode.INTERNAL_SERVER_ERROR.getCode(), HttpStatus.INTERNAL_SERVER_ERROR,
            "MEMBER_EMAIL_BLANK", HttpStatus.BAD_REQUEST,
            "MEMBER_EMAIL_DUPLICATED", HttpStatus.BAD_REQUEST
    );

    @ExceptionHandler(BaseException.class)
    public ResponseEntity<ErrorResponse> handleBase(BaseException e) {
        ErrorCode code = e.getErrorCode();
        return ResponseEntity.status(statusOf(code)).body(new ErrorResponse(e.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(DefaultMessageSourceResolvable::getDefaultMessage)
                .orElse(CommonErrorCode.INVALID_REQUEST_BODY.getMessage());
        return ResponseEntity.badRequest().body(new ErrorResponse(message));
    }

    @ExceptionHandler(Exception.class) // no-excuse-ok: catch — last-resort boundary
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception e) {
        return ResponseEntity.status(statusOf(CommonErrorCode.INTERNAL_SERVER_ERROR))
                .body(new ErrorResponse(CommonErrorCode.INTERNAL_SERVER_ERROR.getMessage()));
    }

    private HttpStatus statusOf(ErrorCode code) {
        return STATUS_BY_ERROR_CODE.getOrDefault(code.getCode(), HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
""",
    # ── member: domain ──
    "src/main/java/$pkgpath/member/domain/MemberErrorCode.java": """\
package $pkg.member.domain;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import $pkg.global.exception.ErrorCode;

@Getter
@RequiredArgsConstructor
public enum MemberErrorCode implements ErrorCode {

    MEMBER_EMAIL_BLANK("MEMBER_EMAIL_BLANK", "이메일을 입력해 주세요."),
    MEMBER_EMAIL_DUPLICATED("MEMBER_EMAIL_DUPLICATED", "이미 가입된 이메일입니다.");

    private final String code;
    private final String message;
}
""",
    "src/main/java/$pkgpath/member/domain/Member.java": """\
package $pkg.member.domain;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import $pkg.global.exception.customException.BusinessException;

@Getter
@RequiredArgsConstructor(access = AccessLevel.PRIVATE)
public class Member {

    private final Long id;
    private final String email;
    private final String name;

    public static Member create(String email, String name) {
        validateEmail(email);
        return new Member(null, email, name);
    }

    public static Member restore(Long id, String email, String name) {
        return new Member(id, email, name);
    }

    public Member appendId(Long id) {
        return new Member(id, email, name);
    }

    public boolean hasEmail(String email) {
        return this.email.equals(email);
    }

    private static void validateEmail(String email) {
        if (email == null || email.isBlank()) {
            throw new BusinessException(MemberErrorCode.MEMBER_EMAIL_BLANK);
        }
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof Member that)) {
            return false;
        }
        if (this.id == null || that.id == null) {
            return false;
        }
        return this.id.equals(that.id);
    }

    @Override
    public int hashCode() {
        return (id != null) ? id.hashCode() : System.identityHashCode(this);
    }
}
""",
    "src/main/java/$pkgpath/member/domain/MemberRepository.java": """\
package $pkg.member.domain;

import java.util.Optional;

public interface MemberRepository {
    Member save(Member member);
    Optional<Member> findById(Long id);
    boolean existsByEmail(String email);
}
""",
    # ── member: application ──
    "src/main/java/$pkgpath/member/application/dto/MemberCreateCommand.java": """\
package $pkg.member.application.dto;

public record MemberCreateCommand(String email, String name) {
}
""",
    "src/main/java/$pkgpath/member/application/MemberValidator.java": """\
package $pkg.member.application;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import $pkg.global.exception.customException.BusinessException;
import $pkg.member.application.dto.MemberCreateCommand;
import $pkg.member.domain.MemberErrorCode;
import $pkg.member.domain.MemberRepository;

@Component
@RequiredArgsConstructor
public class MemberValidator {

    private final MemberRepository memberRepository;

    public void validateNotDuplicated(MemberCreateCommand command) {
        if (memberRepository.existsByEmail(command.email())) {
            throw new BusinessException(MemberErrorCode.MEMBER_EMAIL_DUPLICATED);
        }
    }
}
""",
    "src/main/java/$pkgpath/member/application/MemberService.java": """\
package $pkg.member.application;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import $pkg.member.application.dto.MemberCreateCommand;
import $pkg.member.domain.Member;
import $pkg.member.domain.MemberRepository;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class MemberService {

    private final MemberRepository memberRepository;
    private final MemberValidator memberValidator;

    @Transactional
    public Member register(MemberCreateCommand command) {
        memberValidator.validateNotDuplicated(command);
        Member member = Member.create(command.email(), command.name());
        return memberRepository.save(member);
    }
}
""",
    # ── member: presentation ──
    "src/main/java/$pkgpath/member/presentation/dto/request/MemberCreateRequest.java": """\
package $pkg.member.presentation.dto.request;

import jakarta.validation.constraints.NotBlank;
import $pkg.member.application.dto.MemberCreateCommand;

public record MemberCreateRequest(
        @NotBlank String email,
        @NotBlank String name) {

    public MemberCreateCommand toCommand() {
        return new MemberCreateCommand(email, name);
    }
}
""",
    "src/main/java/$pkgpath/member/presentation/dto/response/MemberResponse.java": """\
package $pkg.member.presentation.dto.response;

import $pkg.member.domain.Member;

public record MemberResponse(Long id, String email, String name) {
    public static MemberResponse from(Member member) {
        return new MemberResponse(member.getId(), member.getEmail(), member.getName());
    }
}
""",
    "src/main/java/$pkgpath/member/presentation/MemberController.java": """\
package $pkg.member.presentation;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import $pkg.member.application.MemberService;
import $pkg.member.domain.Member;
import $pkg.member.presentation.dto.request.MemberCreateRequest;
import $pkg.member.presentation.dto.response.MemberResponse;

@RestController
@RequestMapping("/members")
@RequiredArgsConstructor
public class MemberController {

    private final MemberService memberService;

    @PostMapping
    public ResponseEntity<MemberResponse> create(@Valid @RequestBody MemberCreateRequest request) {
        Member member = memberService.register(request.toCommand());
        return ResponseEntity.status(HttpStatus.CREATED).body(MemberResponse.from(member));
    }
}
""",
    # ── member: infrastructure (Spring Data JPA, domain/entity SEPARATION) ──
    "src/main/java/$pkgpath/member/infrastructure/MemberJpaEntity.java": """\
package $pkg.member.infrastructure;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;
import $pkg.member.domain.Member;

// JPA's mutable shape lives HERE (infrastructure), NOT on the domain Member.
@Entity
@Table(name = "member")
@NoArgsConstructor(access = AccessLevel.PROTECTED)   // JPA requires a no-arg ctor; nobody else calls it
public class MemberJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String name;

    private MemberJpaEntity(Long id, String email, String name) {
        this.id = id;
        this.email = email;
        this.name = name;
    }

    public static MemberJpaEntity fromDomain(Member member) {
        return new MemberJpaEntity(member.getId(), member.getEmail(), member.getName());
    }

    public Member toDomain() {
        return Member.restore(id, email, name);     // rebuild through the domain factory
    }
}
""",
    "src/main/java/$pkgpath/member/infrastructure/MemberJpaRepository.java": """\
package $pkg.member.infrastructure;

import org.springframework.data.jpa.repository.JpaRepository;

// Spring Data interface — an infrastructure detail, NOT the domain port.
interface MemberJpaRepository extends JpaRepository<MemberJpaEntity, Long> {
    boolean existsByEmail(String email);
}
""",
    "src/main/java/$pkgpath/member/infrastructure/MemberRepositoryAdapter.java": """\
package $pkg.member.infrastructure;

import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;
import $pkg.member.domain.Member;
import $pkg.member.domain.MemberRepository;

// Implements the DOMAIN port; the only class that knows JPA. Maps entity <-> domain.
@Repository
@RequiredArgsConstructor
public class MemberRepositoryAdapter implements MemberRepository {

    private final MemberJpaRepository jpaRepository;

    @Override
    public Member save(Member member) {
        MemberJpaEntity saved = jpaRepository.save(MemberJpaEntity.fromDomain(member));
        return saved.toDomain();
    }

    @Override
    public Optional<Member> findById(Long id) {
        return jpaRepository.findById(id).map(MemberJpaEntity::toDomain);
    }

    @Override
    public boolean existsByEmail(String email) {
        return jpaRepository.existsByEmail(email);
    }
}
""",
    # ── member: tests ──
    "src/test/java/$pkgpath/member/domain/fake/FakeMemberRepository.java": """\
package $pkg.member.domain.fake;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import $pkg.member.domain.Member;
import $pkg.member.domain.MemberRepository;

public class FakeMemberRepository implements MemberRepository {

    private final Map<Long, Member> store = new ConcurrentHashMap<>();
    private final AtomicLong sequence = new AtomicLong();

    @Override
    public Member save(Member member) {
        Member saved = member.appendId(sequence.incrementAndGet());
        store.put(saved.getId(), saved);
        return saved;
    }

    @Override
    public Optional<Member> findById(Long id) {
        return Optional.ofNullable(store.get(id));
    }

    @Override
    public boolean existsByEmail(String email) {
        return store.values().stream().anyMatch(member -> member.hasEmail(email));
    }
}
""",
    "src/test/java/$pkgpath/member/application/MemberServiceTest.java": """\
package $pkg.member.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import $pkg.global.exception.customException.BusinessException;
import $pkg.member.application.dto.MemberCreateCommand;
import $pkg.member.domain.Member;
import $pkg.member.domain.fake.FakeMemberRepository;

class MemberServiceTest {

    private MemberService memberService;
    private FakeMemberRepository memberRepository;

    @BeforeEach
    void setUp() {
        memberRepository = new FakeMemberRepository();
        memberService = new MemberService(memberRepository, new MemberValidator(memberRepository));
    }

    @Test
    @DisplayName("회원을 등록한다")
    void register_ReturnsMember_WhenCommandIsValid() {
        // when
        Member member = memberService.register(new MemberCreateCommand("a@b.com", "ada"));

        // then
        assertThat(member.getId()).isNotNull();
        assertThat(member.hasEmail("a@b.com")).isTrue();
    }

    @Test
    @DisplayName("이미 가입된 이메일이면 회원 등록에 실패한다")
    void register_ThrowsBusinessException_WhenEmailIsDuplicated() {
        // given
        memberService.register(new MemberCreateCommand("a@b.com", "ada"));

        // when & then
        assertThatThrownBy(() -> memberService.register(new MemberCreateCommand("a@b.com", "bob")))
                .isInstanceOf(BusinessException.class);
    }
}
""",
    ".gitignore": ".gradle/\nbuild/\n*.log\n.idea/\n*.iml\n.DS_Store\n",
}


def main(
    name: str,
    path: str = typer.Option(".", help="Parent dir"),
    group: str = typer.Option("com.example", help="Group / base package, e.g. com.acme"),
    java_version: int = typer.Option(DEFAULT_JAVA_VERSION, help="Java toolchain version"),
    spring_boot_version: str = typer.Option(DEFAULT_SPRING_BOOT_VERSION, help="Spring Boot plugin version"),
    dependency_management_version: str = typer.Option(
        DEFAULT_DEPENDENCY_MANAGEMENT_VERSION,
        help="Spring dependency-management plugin version",
    ),
    gradle_version: str = typer.Option(DEFAULT_GRADLE_VERSION, help="Gradle wrapper version to print"),
) -> None:
    """Scaffold a domain-first, layered Spring Boot project with one sample `member` slice."""
    project_dir = Path(path) / name
    if project_dir.exists():
        console.print(f"[red]x[/red] {project_dir} already exists")
        sys.exit(1)

    artifact = name.replace("-", "").replace("_", "").lower()
    pkg = f"{group}.{artifact}"
    subs = {
        "name": name,
        "group": group,
        "artifact": artifact,
        "pkg": pkg,
        "pkgpath": pkg.replace(".", "/"),
        "java_version": str(java_version),
        "spring_boot_version": spring_boot_version,
        "dependency_management_version": dependency_management_version,
    }

    for rel_template, body in FILES.items():
        out_path = project_dir / Template(rel_template).substitute(**subs)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(Template(body).substitute(**subs))
        console.print(f"  [dim]wrote[/] {out_path.relative_to(project_dir)}")

    console.print(f"\n[bold green]Done![/] cd {project_dir}")
    console.print(f"  gradle wrapper --gradle-version {gradle_version}   # pin & commit the wrapper")
    console.print("  ./gradlew compileJava test check         # the member slice is green out of the box")
    console.print("\nCopy the `member/` slice as the template for your next domain.")


if __name__ == "__main__":
    typer.run(main)
