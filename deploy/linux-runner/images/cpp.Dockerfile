# ==============================================================================
# Runtime Profile: C++ (GCC 14)
# Base Image: gcc:14-bookworm
# Pinned Digest: sha256:7b2e65c010c7a5f6e80b43527dfa6fbda19280ad7bf287661b17d5973703c948
# Security Policy: Non-root user (1000:1000), read-only rootfs, zero network
# ==============================================================================

FROM gcc:14-bookworm@sha256:7b2e65c010c7a5f6e80b43527dfa6fbda19280ad7bf287661b17d5973703c948

LABEL maintainer="Samir Saurabh <samirverma527@gmail.com>"
LABEL security.profile="gvisor-isolated"
LABEL assessment.language="cpp"

WORKDIR /workspace
RUN chown -R 1000:1000 /workspace && chmod 0700 /workspace

USER 1000:1000

CMD ["g++", "--version"]

