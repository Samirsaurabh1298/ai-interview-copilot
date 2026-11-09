# ==============================================================================
# Runtime Profile: TypeScript & JavaScript (Node.js 22 LTS)
# Base Image: node:22-bookworm-slim
# Pinned Digest: sha256:d84f865ec0ea59781190cf6182c161eb3ef060934ce3d052d1921fb923fb5328
# Security Policy: Non-root user (1000:1000), read-only rootfs, zero network
# ==============================================================================

FROM node:22-bookworm-slim@sha256:d84f865ec0ea59781190cf6182c161eb3ef060934ce3d052d1921fb923fb5328

LABEL maintainer="Samir Saurabh <samirverma527@gmail.com>"
LABEL security.profile="gvisor-isolated"
LABEL assessment.language="typescript,javascript"

# Pre-create unprivileged candidate workspace
WORKDIR /workspace
RUN chown -R 1000:1000 /workspace && chmod 0700 /workspace

# Non-root candidate execution
USER 1000:1000
ENV NODE_ENV=production
ENV CI=true

# Entrypoint expects ephemeral mounted volume /workspace
CMD ["node", "--version"]

