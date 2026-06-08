#!/usr/bin/env bash
# ============================================
# Cloudflare Tunnel for PrepTalk
# Free, no domain needed, HTTPS included
# ============================================

set -euo pipefail

# Install cloudflared if not present
if ! command -v cloudflared &>/dev/null; then
  echo "📦 Installing cloudflared..."
  curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
    -o /usr/local/bin/cloudflared && chmod +x /usr/local/bin/cloudflared
fi

LOCAL_PORT="${LOCAL_PORT:-8080}"

echo "🚀 Starting Cloudflare Tunnel..."
echo "   Local:  http://localhost:${LOCAL_PORT}"
echo "   Public: https://<random>.trycloudflare.com"
echo ""

cloudflared tunnel --url "http://localhost:${LOCAL_PORT}"
