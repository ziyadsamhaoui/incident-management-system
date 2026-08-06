# ---------- Build stage ----------
# Uses the project's own Maven wrapper (pins Maven 3.9.16, same as CI).
FROM maven:3.9.11-eclipse-temurin-17 AS builder

WORKDIR /build

# 1) Resolve dependencies first so a source-only change reuses the cached layer.
# Docker COPY copies a directory's *contents*, never the directory itself —
# so .mvn must target an explicit destination subdirectory.
COPY pom.xml mvnw ./
COPY .mvn ./.mvn/
# mvnw is checked out with CRLF on Windows hosts — strip \r or the shell chokes.
RUN sed -i 's/\r$//' mvnw \
    && chmod +x mvnw \
    && ./mvnw -B -ntp dependency:go-offline

# 2) Compile & package the fat jar.
#    Tests are NOT run here — they run in CI (GitHub Actions, with a Postgres
#    sidecar + Testcontainers). Skipping keeps image builds fast and hermetic.
COPY src src
RUN ./mvnw -B -ntp clean package -Dmaven.test.skip=true

# ---------- Runtime stage ----------
FROM eclipse-temurin:17-jre

WORKDIR /app

# curl for the actuator healthcheck; dedicated non-root user for the app.
# UID/GID pinned to 1001 (same convention as the frontend image).
# /data/incident-media is pre-created so a fresh named volume inherits app
# ownership — bind mounts must chown the host dir to 1001:1001 instead.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 app \
    && useradd --system --uid 1001 --gid app --home /app app \
    && mkdir -p /data/incident-media \
    && chown app:app /data/incident-media

# Wildcard keeps the copy stable across version bumps (e.g. 0.0.1-SNAPSHOT → 0.1.0).
# Assumes exactly one jar in target/ — Spring Boot repackage replaces the plain jar.
COPY --from=builder /build/target/*.jar app.jar

RUN chown -R app:app /app
USER app

EXPOSE 8080

# Requires spring-boot-starter-actuator (present); /actuator/health is exposed by default.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8080/actuator/health || exit 1

# Size the JVM heap relative to the container's memory limit instead of the
# host's RAM (UseContainerSupport is on by default on JDK 17 — this caps the
# heap for small containers / shared hosts).
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]
