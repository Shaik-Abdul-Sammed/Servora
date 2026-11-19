#!/usr/bin/env bash
# ==============================================================================
# Abiruchi Hotel Self-Hosted Firewall & 10,000 Concurrent Capacity Hardening Script
# Zero-Cloud Architecture for Linux (Ubuntu / Debian / RHEL)
# ==============================================================================

set -euo pipefail

echo "=========================================================================="
echo "          ABIRUCHI HOTEL SELF-HOSTED 10K FIREWALL & HOST HARDENING               "
echo "=========================================================================="

# 1. Kernel Network Parameter Optimization (sysctl for 10k concurrent connections)
echo "[1/4] Applying Linux Kernel Network Optimizations (sysctl)..."
cat << 'EOF' | sudo tee /etc/sysctl.d/99-abiruchi-10k.conf > /dev/null
# Maximum open files and file descriptors
fs.file-max = 2097152

# Socket backlog and connection limits for 10k users
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 65535

# TCP memory and SYN flood protection
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_syncookies = 1

# TCP connection recycling and timeouts
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_keepalive_intvl = 15
net.ipv4.tcp_keepalive_probes = 5

# Port range expansion for high outbound concurrency
net.ipv4.ip_local_port_range = 1024 65535

# Buffer window sizes
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.ipv4.tcp_rmem = 4096 87380 16777216
net.ipv4.tcp_wmem = 4096 65536 16777216
EOF

sudo sysctl --system > /dev/null
echo "✓ Kernel network parameters tuned for 10k concurrency."

# 2. File Descriptor Limits (limits.conf)
echo "[2/4] Setting user limits for file descriptors..."
cat << 'EOF' | sudo tee /etc/security/limits.d/99-abiruchi.conf > /dev/null
* soft nofile 65535
* hard nofile 65535
root soft nofile 65535
root hard nofile 65535
EOF
echo "✓ File limits set to 65,535."

# 3. Host Firewall Configuration (UFW)
if command -v ufw >/dev/null 2>&1; then
    echo "[3/4] Configuring Uncomplicated Firewall (UFW)..."
    
    # Reset/default policy
    sudo ufw default deny incoming
    sudo ufw default allow outgoing

    # Allow SSH with rate limiting (anti-brute force)
    sudo ufw limit ssh comment 'Rate-limited SSH'

    # Allow Web Traffic (Reverse proxy / Cloudflare)
    sudo ufw allow 80/tcp comment 'HTTP NGINX'
    sudo ufw allow 443/tcp comment 'HTTPS NGINX'
    sudo ufw allow 8085/tcp comment 'Abiruchi Hotel Reverse Proxy'

    # STRICT LOCAL ISOLATION: Prevent external direct access to databases
    # PostgreSQL (5432) and Redis (6379) are accessible ONLY from localhost/docker
    sudo ufw deny 5432/tcp comment 'Block direct external Postgres'
    sudo ufw deny 6379/tcp comment 'Block direct external Redis'
    sudo ufw deny 3001/tcp comment 'Block direct unproxied Abiruchi Hotel API'

    echo "✓ UFW rules configured (Backend ports isolated to localhost)."
else
    echo "[3/4] UFW not found, skipping UFW setup (using container isolation)."
fi

# 4. Cloudflare Zero-Port-Forwarding Notice
echo "[4/4] Cloudflare Tunnel (cloudflared) status:"
echo "--------------------------------------------------------------------------"
echo "To expose your 10k instance without opening ANY inbound ports on your router:"
echo "  1. Run: docker run -d cloudflare/cloudflared:latest tunnel --no-autoupdate run --token <YOUR_TOKEN>"
echo "  2. Point your Cloudflare DNS CNAME to the tunnel."
echo "  3. Cloudflare handles all DDoS protection, SSL, and edge caching for FREE."
echo "--------------------------------------------------------------------------"
echo "Abiruchi Hotel firewall & 10k capacity tuning complete!"
