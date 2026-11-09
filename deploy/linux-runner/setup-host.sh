#!/usr/bin/env bash
# ==============================================================================
# AI Coding Assessment Platform: Linux Runner Worker Host Setup
# Target OS: Ubuntu 24.04 LTS (Noble Numbat) - Linux Kernel 6.8+
# Target Architecture: x86_64
# Security Profile: Rootless OCI + gVisor (runsc) + cgroups v2
# ==============================================================================

set -euo pipefail

echo "======================================================================"
echo ">> [LOOP 9.1] AI Coding Assessment Platform - Dedicated Linux Runner Host Setup"
echo "======================================================================"

# 1. OS & Kernel Baseline Verification
if [ -f /etc/os-release ]; then
  . /etc/os-release
  echo ">> Host OS Detected: ${NAME} ${VERSION_ID}"
  if [[ "${ID}" != "ubuntu" && "${ID}" != "debian" ]]; then
    echo ">> [WARNING] Recommended distribution is Ubuntu 24.04 LTS or Debian 12."
  fi
else
  echo ">> [ERROR] Unable to identify host operating system (/etc/os-release missing)."
  exit 1
fi

KERNEL_VER=$(uname -r)
echo ">> Linux Kernel: ${KERNEL_VER}"

# 2. cgroups v2 Unified Hierarchy Verification
if [ -f /sys/fs/cgroup/cgroup.controllers ]; then
  echo ">> [OK] cgroups v2 unified hierarchy is active."
  cat /sys/fs/cgroup/cgroup.controllers
else
  echo ">> [CRITICAL] cgroups v2 is NOT enabled. Please add 'systemd.unified_cgroup_hierarchy=1' to kernel cmdline."
  exit 1
fi

# 3. Install Host Dependencies
echo ">> Installing required packages (podman, uidmap, slirp4netns, curl, jq, iptables)..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends \
  podman \
  uidmap \
  slirp4netns \
  curl \
  jq \
  iptables \
  ca-certificates \
  systemd-container

# 4. Provision Dedicated Unprivileged User: coderunner
RUNNER_USER="coderunner"
RUNNER_UID=1001
RUNNER_GID=1001

if id "${RUNNER_USER}" &>/dev/null; then
  echo ">> User ${RUNNER_USER} already exists."
else
  echo ">> Creating dedicated non-root service account: ${RUNNER_USER} (UID: ${RUNNER_UID})..."
  groupadd -g "${RUNNER_GID}" "${RUNNER_USER}"
  useradd -u "${RUNNER_UID}" -g "${RUNNER_GID}" -m -s /bin/bash "${RUNNER_USER}"
fi

# Configure subordinate UIDs and GIDs for rootless namespaces
echo ">> Configuring subordinate UIDs/GIDs in /etc/subuid and /etc/subgid..."
grep -q "^${RUNNER_USER}:" /etc/subuid || echo "${RUNNER_USER}:100000:65536" >> /etc/subuid
grep -q "^${RUNNER_USER}:" /etc/subgid || echo "${RUNNER_USER}:100000:65536" >> /etc/subgid

# Enable systemd user lingering so background services survive logout
loginctl enable-linger "${RUNNER_USER}" || true

# 5. Install Pinned gVisor (runsc) Runtime
GVISOR_VERSION="20240909.0"
GVISOR_URL="https://storage.googleapis.com/gvisor/releases/release/${GVISOR_VERSION}/x86_64"
INSTALL_DIR="/usr/local/bin"

echo ">> Downloading gVisor runsc version ${GVISOR_VERSION}..."
curl -fsSL "${GVISOR_URL}/runsc" -o "${INSTALL_DIR}/runsc"
curl -fsSL "${GVISOR_URL}/runsc.sha512" -o "${INSTALL_DIR}/runsc.sha512"

echo ">> Verifying gVisor binary integrity..."
cd "${INSTALL_DIR}"
sha512sum -c runsc.sha512
chmod 0755 "${INSTALL_DIR}/runsc"

echo ">> gVisor runsc installed successfully:"
"${INSTALL_DIR}/runsc" --version

# 6. Configure Podman OCI Engine for gVisor
mkdir -p /etc/containers
cat <<EOF > /etc/containers/containers.conf
# AI Coding Assessment Platform: Podman Rootless Configuration
[engine]
runtime = "runsc"
cgroup_manager = "systemd"
events_logger = "journald"

[engine.runtimes]
runsc = [
  "/usr/local/bin/runsc"
]

[network]
default_network = "isolated-sandbox"
network_backend = "netavark"
EOF

# 7. Configure Network Isolation (Zero Egress Rule)
echo ">> Setting up offline container network with strict zero-egress policy..."
sudo -u "${RUNNER_USER}" podman network create --internal isolated-sandbox 2>/dev/null || true

# 8. Create Application Directory Structure
APP_DIR="/opt/code-runner"
mkdir -p "${APP_DIR}/dist" "${APP_DIR}/tmp" "${APP_DIR}/images"
chown -R "${RUNNER_USER}:${RUNNER_USER}" "${APP_DIR}"
chmod 0750 "${APP_DIR}"

echo "======================================================================"
echo ">> [SUCCESS] Linux Runner Host Setup Completed."
echo ">> Host is ready for systemd service deployment and image registration."
echo "======================================================================"

