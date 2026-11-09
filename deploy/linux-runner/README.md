# Linux gVisor Dedicated Runner Deployment Guide (LOOP 9.1)

## Overview

This directory contains the production deployment package for the **Dedicated Code Runner Worker** running in an unprivileged, rootless OCI environment isolated by Google's **gVisor (`runsc`)** sandbox.

Target Host: **Ubuntu 24.04 LTS (Noble Numbat)** with **Linux Kernel 6.8+** on independent cloud or bare-metal infrastructure.

---

## Architecture & Security Boundary

```
+-----------------------------------------------------------------------------------------+
|                               Fastify API Backend (Port 4000)                           |
|  - Role-Based Access Control (Owner / Admin / Interviewer)                              |
|  - Authenticated requests to runner daemon using CODE_RUNNER_SECRET                     |
+-----------------------------------------------------------------------------------------+
                                           |
                                    Internal HTTP
                      (Authorization: Bearer <CODE_RUNNER_SECRET>)
                                           |
                                           v
+-----------------------------------------------------------------------------------------+
|                  Dedicated Code Runner Service (systemd on Port 4100)                   |
|  - System User: coderunner (UID 1001)                                                   |
|  - Systemd Hardening: ProtectSystem=strict, PrivateTmp=true, NoNewPrivileges=true      |
|  - MemoryMax=4G, CPUQuota=400%, TasksMax=512                                            |
|  - ZERO access to Postgres database credentials or AI provider API keys                 |
+-----------------------------------------------------------------------------------------+
                                           |
                                    Rootless Podman
                               (--runtime=runsc, --net=none)
                                           |
                                           v
+-----------------------------------------------------------------------------------------+
|                       gVisor Application Kernel (runsc Sentry)                          |
|  - Intercepts and virtualizes all Linux system calls in unprivileged Go user space      |
|  - Root filesystem: Read-only (--read-only)                                             |
|  - Workspace: Ephemeral tmpfs mount (destroyed upon process completion)                 |
|  - Network: Offline (--network=none), zero DNS, zero TCP/UDP egress                     |
|  - User: Candidate unprivileged user 1000:1000                                          |
|  - cgroups v2 resource ceilings enforced per execution:                                 |
|      * Node.js / TS / JS:  128MB RAM, 0.5 CPU, 64 PIDs, 5s timeout                      |
|      * Python 3:           128MB RAM, 0.5 CPU, 64 PIDs, 5s timeout                      |
|      * Go 1.23:            256MB RAM, 1.0 CPU, 128 PIDs, 10s compile / 5s exec          |
|      * Java 21:            512MB RAM, 1.0 CPU, 128 PIDs, 15s compile / 5s exec          |
|      * C++ GCC 14:         256MB RAM, 1.0 CPU, 64 PIDs,  10s compile / 5s exec          |
|      * Rust 1.81:          512MB RAM, 1.0 CPU, 128 PIDs, 20s compile / 5s exec          |
+-----------------------------------------------------------------------------------------+
```

---

## Step-by-Step Deployment Instructions

### 1. Provision Ubuntu 24.04 LTS Host
Ensure the server is running an official Ubuntu 24.04 LTS installation on independent infrastructure:
```bash
uname -r # Expected: 6.8.0-xx-generic or higher
cat /sys/fs/cgroup/cgroup.controllers # Verify cgroups v2 is active
```

### 2. Run Host Setup Script
Execute `setup-host.sh` as `root` (or with `sudo`):
```bash
sudo bash deploy/linux-runner/setup-host.sh
```
This script will:
1. Verify system prerequisites and cgroups v2.
2. Install `podman`, `uidmap`, `slirp4netns`, `curl`, and `jq`.
3. Provision the `coderunner` service account (UID 1001) with subuids and subgids.
4. Download and install gVisor `runsc 20240909.0` with SHA-512 checksum validation.
5. Configure `/etc/containers/containers.conf` with `runtime = "runsc"`.
6. Configure the internal zero-egress network namespace.

### 3. Deploy Application Code & Artifacts
Copy the built `services/code-runner` distribution to `/opt/code-runner`:
```bash
sudo cp -r services/code-runner/dist /opt/code-runner/
sudo cp -r services/code-runner/package.json /opt/code-runner/
sudo chown -R coderunner:coderunner /opt/code-runner
```

### 4. Configure Authentication Secret
Create `/etc/default/code-runner` with a strong random 32-character secret:
```bash
sudo bash -c 'echo "CODE_RUNNER_SECRET=$(openssl rand -hex 16)" > /etc/default/code-runner'
sudo chmod 0600 /etc/default/code-runner
sudo chown coderunner:coderunner /etc/default/code-runner
```
Provide the identical `CODE_RUNNER_SECRET` to the Fastify API in its `.env` file.

### 5. Install & Start Systemd Service
```bash
sudo cp deploy/linux-runner/systemd/code-runner.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now code-runner
sudo systemctl status code-runner
```

### 6. Run Security Acceptance Suite
Execute the 12-test adversarial suite to verify gVisor enforcement:
```bash
sudo bash deploy/linux-runner/verify-security.sh
```

Expected result:
```
>> Security Acceptance Gate Results: 12/12 Passed
>> [VERDICT] ALL GVISOR SECURITY ADVERSARIAL GATES PASSED.
```

