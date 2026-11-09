# ==============================================================================
# Runtime Profile: Python 3.12
# Base Image: python:3.12-slim-bookworm
# Pinned Digest: sha256:9c10f8de64b97d2685718a287fa44e7c10b2f567b5e40e69b0fa6747b068832a
# Security Policy: Non-root user (1000:1000), read-only rootfs, zero network
# ==============================================================================

FROM python:3.12-slim-bookworm@sha256:9c10f8de64b97d2685718a287fa44e7c10b2f567b5e40e69b0fa6747b068832a

LABEL maintainer="Samir Saurabh <samirverma527@gmail.com>"
LABEL security.profile="gvisor-isolated"
LABEL assessment.language="python"

# Environment hardening
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1

WORKDIR /workspace
RUN chown -R 1000:1000 /workspace && chmod 0700 /workspace

USER 1000:1000

CMD ["python3", "--version"]
