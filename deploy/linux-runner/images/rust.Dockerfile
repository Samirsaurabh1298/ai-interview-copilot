# ==============================================================================
# Runtime Profile: Rust 1.81
# Base Image: rust:1.81-slim-bookworm
# Pinned Digest: sha256:5e3d74fa77ad2888cf3b421a8d11d044f5cfd7eeaa1426477b7eb711fb62c2f4
# Security Policy: Non-root user (1000:1000), read-only rootfs, zero network
# ==============================================================================

FROM rust:1.81-slim-bookworm@sha256:5e3d74fa77ad2888cf3b421a8d11d044f5cfd7eeaa1426477b7eb711fb62c2f4

LABEL maintainer="Samir Saurabh <samirverma527@gmail.com>"
LABEL security.profile="gvisor-isolated"
LABEL assessment.language="rust"

ENV CARGO_HOME=/tmp/cargo
ENV RUSTUP_HOME=/tmp/rustup
ENV CARGO_NET_OFFLINE=true

WORKDIR /workspace
RUN mkdir -p /tmp/cargo /tmp/rustup /workspace && \
    chown -R 1000:1000 /tmp/cargo /tmp/rustup /workspace && \
    chmod -R 0700 /tmp/cargo /tmp/rustup /workspace

USER 1000:1000

CMD ["cargo", "--version"]

