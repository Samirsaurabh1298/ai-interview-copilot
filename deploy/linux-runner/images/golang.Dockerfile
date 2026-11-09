# ==============================================================================
# Runtime Profile: Go 1.23
# Base Image: golang:1.23-bookworm
# Pinned Digest: sha256:4f3a8869c3666d6ee4f82be4c5e3f53ae8d2b960c1d6faef88b17b2b8c94627b
# Security Policy: Non-root user (1000:1000), read-only rootfs, zero network
# ==============================================================================

FROM golang:1.23-bookworm@sha256:4f3a8869c3666d6ee4f82be4c5e3f53ae8d2b960c1d6faef88b17b2b8c94627b

LABEL maintainer="Samir Saurabh <samirverma527@gmail.com>"
LABEL security.profile="gvisor-isolated"
LABEL assessment.language="go"

ENV GOPATH=/tmp/go
ENV GOCACHE=/tmp/go-cache
ENV CGO_ENABLED=0

WORKDIR /workspace
RUN mkdir -p /tmp/go /tmp/go-cache /workspace && \
    chown -R 1000:1000 /tmp/go /tmp/go-cache /workspace && \
    chmod -R 0700 /tmp/go /tmp/go-cache /workspace

USER 1000:1000

CMD ["go", "version"]

