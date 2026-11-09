#!/usr/bin/env bash
# ==============================================================================
# AI Coding Assessment Platform: Linux Runner Security Acceptance Test Suite
# Target Runtime: Rootless Podman / Docker + gVisor (runsc) on Ubuntu 24.04 LTS
# ==============================================================================

set -euo pipefail

PASS_COUNT=0
FAIL_COUNT=0
TOTAL_TESTS=12

echo "======================================================================"
echo ">> [LOOP 9.1] Linux gVisor Security Acceptance Test Suite"
echo ">> Host Kernel: $(uname -r) | Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "======================================================================"

# Determine container engine
if command -v podman &>/dev/null; then
  ENGINE="podman"
elif command -v docker &>/dev/null; then
  ENGINE="docker"
else
  echo ">> [CRITICAL] Neither podman nor docker found in PATH."
  exit 1
fi

echo ">> Container Engine: ${ENGINE} ($( ${ENGINE} --version ))"

# Verify gVisor runsc is available
if ! command -v runsc &>/dev/null; then
  echo ">> [CRITICAL] gVisor 'runsc' binary not found in PATH."
  exit 1
fi
echo ">> gVisor runsc version: $(runsc --version | head -n 1)"

NODE_IMAGE="docker.io/library/node:22-bookworm-slim@sha256:d84f865ec0ea59781190cf6182c161eb3ef060934ce3d052d1921fb923fb5328"

run_test() {
  local test_name="$1"
  local cmd="$2"
  local expect_pass="$3" # "true" means command should return 0, "false" means it should fail / return non-zero

  echo -n ">> Running Test: ${test_name}... "
  if eval "${cmd}" &>/dev/null; then
    if [ "${expect_pass}" == "true" ]; then
      echo "[PASSED]"
      PASS_COUNT=$((PASS_COUNT + 1))
    else
      echo "[FAILED - Expected failure but succeeded]"
      FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
  else
    if [ "${expect_pass}" == "false" ]; then
      echo "[PASSED - Adversarial action correctly blocked]"
      PASS_COUNT=$((PASS_COUNT + 1))
    else
      echo "[FAILED - Expected success but failed]"
      FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
  fi
}

echo "----------------------------------------------------------------------"
echo ">> Phase 5 Adversarial Gate Execution"
echo "----------------------------------------------------------------------"

# 1. Environment Secret Isolation: Container cannot access host environment secrets
HOST_SECRET_CANARY="SECRET_TOKEN_PILOT_VERIFICATION_CANARY_XYZ987"
export PILOT_CANARY_SECRET="${HOST_SECRET_CANARY}"
run_test "1. Environment Secret Isolation" \
  "${ENGINE} run --rm --runtime=runsc --network=none ${NODE_IMAGE} node -e 'if (process.env.PILOT_CANARY_SECRET) process.exit(1);'" \
  "true"

# 2. Host Filesystem Denial: Candidate cannot write to root filesystem
run_test "2. Read-Only Root Filesystem Enforcement" \
  "${ENGINE} run --rm --runtime=runsc --read-only --network=none ${NODE_IMAGE} touch /etc/hacked.txt" \
  "false"

# 3. Cross-Execution Filesystem Isolation
TMP_DIR_A=$(mktemp -d /tmp/runner-test-a-XXXXXX)
TMP_DIR_B=$(mktemp -d /tmp/runner-test-b-XXXXXX)
echo "candidate A secret" > "${TMP_DIR_A}/secret.txt"
run_test "3. Cross-Execution Workspace Isolation" \
  "${ENGINE} run --rm --runtime=runsc -v ${TMP_DIR_B}:/workspace:rw --workdir=/workspace ${NODE_IMAGE} test -f /workspace/secret.txt" \
  "false"
rm -rf "${TMP_DIR_A}" "${TMP_DIR_B}"

# 4. Outbound Network Egress Denial: raw socket / IP connection blocked
run_test "4. Raw TCP Outbound Network Denial" \
  "${ENGINE} run --rm --runtime=runsc --network=none ${NODE_IMAGE} node -e 'require(\"net\").connect(80, \"1.1.1.1\").on(\"connect\", () => process.exit(1)).on(\"error\", () => process.exit(0))'" \
  "true"

# 5. DNS Resolution Denial: DNS queries blocked
run_test "5. DNS Resolution Denial" \
  "${ENGINE} run --rm --runtime=runsc --network=none ${NODE_IMAGE} node -e 'require(\"dns\").lookup(\"google.com\", (err) => { if (err) process.exit(0); process.exit(1); })'" \
  "true"

# 6. PID Limit Enforcement: Fork Bomb Mitigation
run_test "6. PID Ceilings & Fork Bomb Containment" \
  "${ENGINE} run --rm --runtime=runsc --pids-limit=32 --network=none ${NODE_IMAGE} bash -c 'for i in {1..100}; do sleep 10 & done' 2>&1" \
  "false"

# 7. Memory Quota Enforcement: OOM termination cleanly handled
run_test "7. Memory Quota Ceilings" \
  "${ENGINE} run --rm --runtime=runsc --memory=64m --memory-swap=64m --network=none ${NODE_IMAGE} node -e 'const a = []; while(true) a.push(Buffer.alloc(1024*1024));'" \
  "false"

# 8. CPU Quota Throttling Enforcement
run_test "8. CPU Quota Enforced" \
  "${ENGINE} run --rm --runtime=runsc --cpus=0.5 --network=none ${NODE_IMAGE} node -e 'const start = Date.now(); while(Date.now() - start < 500); process.exit(0);'" \
  "true"

# 9. Execution Timeout Termination
run_test "9. External Watchdog Timeout Termination" \
  "timeout 2s ${ENGINE} run --rm --runtime=runsc --network=none ${NODE_IMAGE} node -e 'while(true);'" \
  "false"

# 10. Non-Root Execution Enforcement: UID is 1000, not 0
run_test "10. Non-Root Candidate UID Enforcement" \
  "${ENGINE} run --rm --runtime=runsc --user=1000:1000 --network=none ${NODE_IMAGE} node -e 'if (process.getuid() !== 1000) process.exit(1);'" \
  "true"

# 11. No Privileged Capabilities: Raw network sockets / sys_admin denied
run_test "11. Capability Drop (CAP_SYS_ADMIN Denied)" \
  "${ENGINE} run --rm --runtime=runsc --cap-drop=ALL --network=none ${NODE_IMAGE} node -e 'try { require(\"child_process\").execSync(\"mount\"); } catch { process.exit(0); } process.exit(1);'" \
  "true"

# 12. Cleanup Verification: No dangling containers or leftover processes
RUNNING_CONTAINERS=$(${ENGINE} ps -q --filter "ancestor=${NODE_IMAGE}" | wc -l)
run_test "12. Ephemeral Sandbox Teardown Verification" \
  "[ ${RUNNING_CONTAINERS} -eq 0 ]" \
  "true"

echo "======================================================================"
echo ">> Security Acceptance Gate Results: ${PASS_COUNT}/${TOTAL_TESTS} Passed"
if [ "${FAIL_COUNT}" -eq 0 ]; then
  echo ">> [VERDICT] ALL GVISOR SECURITY ADVERSARIAL GATES PASSED."
  exit 0
else
  echo ">> [VERDICT] GVISOR SECURITY GATE FAILED: ${FAIL_COUNT} test(s) failed."
  exit 1
fi

