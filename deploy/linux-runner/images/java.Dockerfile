# ==============================================================================
# Runtime Profile: Java 21 JDK
# Base Image: eclipse-temurin:21-jdk-jammy
# Pinned Digest: sha256:1a82da3d76b1e6eb4d75d272f10b7ea1e3e7f415c8e31de3f4f1ff8109bfbece
# Security Policy: Non-root user (1000:1000), read-only rootfs, zero network
# ==============================================================================

FROM eclipse-temurin:21-jdk-jammy@sha256:1a82da3d76b1e6eb4d75d272f10b7ea1e3e7f415c8e31de3f4f1ff8109bfbece

LABEL maintainer="Samir Saurabh <samirverma527@gmail.com>"
LABEL security.profile="gvisor-isolated"
LABEL assessment.language="java"

# Java memory safety within container
ENV JAVA_TOOL_OPTIONS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -Djava.awt.headless=true"

WORKDIR /workspace
RUN chown -R 1000:1000 /workspace && chmod 0700 /workspace

USER 1000:1000

CMD ["javac", "-version"]

