# Abiruchi Hotel 10k Capacity Guide: Cloudflare Free Tier + Self-Hosted Firewall

This guide explains how to operate Abiruchi Hotel at **10,000+ concurrent requests** using **100% Free-Tier services** without cloud provider bills (AWS/GCP/Azure).

---

## 1. Architecture Overview

```
10,000 Users (Guests / Staff)
        │
        ▼
[Cloudflare Free Tier]  <── Free Edge CDN, DDoS Protection & WAF (250+ Global PoPs)
        │
   (Outbound Encrypted Tunnel - No Public IP, No Open Ports Needed)
        │
        ▼
[cloudflared daemon]     <── Runs inside Docker on your local/VPS server
        │
        ▼
[NGINX Reverse Proxy]   <── 10,240 epoll workers, IP rate limiter, security headers
        │
        ▼
[Abiruchi Hotel Core Engine]   <── Node 22 API + SQLite / PostgreSQL RLS + Google Translate
```

---

## 2. Why This Beats Paid Cloud Load Balancers

| Feature | Paid AWS / GCP Cloud Setup | Abiruchi Hotel Free-Tier Setup (Cloudflare + NGINX) |
| :--- | :--- | :--- |
| **Monthly Cost** | \$150 - \$800+ / month (ALB, Data Transfer, NAT) | **\$0.00 / month (100% Free Tier)** |
| **DDoS Protection** | Paid AWS Shield Advanced (\$3,000/mo) | **Unmetered Free DDoS Mitigation (Layer 3, 4, 7)** |
| **Public Ports Required** | Must expose ports 80/443 to the public internet | **0 open inbound ports** via Cloudflare Tunnel |
| **Edge Caching** | Paid CloudFront / Cloud CDN data transfer fees | **Free Unlimited Static Asset Edge Caching** |
| **SSL / TLS Certificate**| Manual certbot renewals or paid ACM certs | **Free Automatic Cloudflare Universal SSL (TLS 1.3)** |
| **Language Translation**| Paid Google Cloud Translation API (\$20/mil char)| **Free Google Translate Engine with local cache** |

---

## 3. Step-by-Step Setup

### Step 1: Create a Free Cloudflare Account
1. Sign up for a free account at [https://cloudflare.com](https://cloudflare.com).
2. Add your domain name (or a free domain from DuckDNS / No-IP).
3. Set your domain's nameservers to Cloudflare's free nameservers.

### Step 2: Create a Cloudflare Tunnel (Zero-Port-Forwarding)
1. Go to **Cloudflare Zero Trust Dashboard** > **Networks** > **Tunnels**.
2. Click **Create a Tunnel** and select **Cloudflared**.
3. Name your tunnel: `abiruchi-tunnel`.
4. Copy your Tunnel Token: `eyJh...`.
5. Under **Public Hostname**, configure:
   - **Subdomain**: `order` (or `@` for root)
   - **Domain**: `yourdomain.com`
   - **Type**: `HTTP`
   - **URL**: `nginx:80` (or `localhost:8085` if running without Docker network)

### Step 3: Add Tunnel Token to Abiruchi Hotel Environment
Add your token to `.env`:
```env
CLOUDFLARE_TUNNEL_TOKEN=eyJh...
```

### Step 4: Configure Free Cloudflare WAF Rules
In the Cloudflare Dashboard under **Security** > **WAF** > **Custom Rules**:
1. **Rate Limiting Rule**:
   - URL path contains `/api/v1/orders`
   - Action: Block or Managed Challenge if requests exceed 15 per minute per IP.
2. **Bot Fight Mode**:
   - Turn **Bot Fight Mode** to **ON** (automatically blocks automated credential stuffing and scrapers).

### Step 5: Configure Free Edge Caching for 10k Capacity
In Cloudflare under **Rules** > **Page Rules**:
- **URL**: `*yourdomain.com/*`
- **Cache Level**: Standard
- **Edge Cache TTL**: 1 day (for static assets)
*Result: Over 80% of QR menu traffic is served directly from Cloudflare edge caches, requiring minimal CPU from your origin server.*
