#!/usr/bin/env bash
# ============================================
# nport.io tunnel script for PrepTalk
# Auto-reconnects on disconnect
# ============================================

set -euo pipefail

# Configuration — edit these or set env vars
NPORT_TOKEN="${NPORT_TOKEN:-}"
LOCAL_PORT="${LOCAL_PORT:-8080}"
REMOTE_PORT="${REMOTE_PORT:-0}"  # 0 = random port from nport

if [ -z "$NPORT_TOKEN" ]; then
  echo "❌ ERROR: NPORT_TOKEN not set"
  echo "   Get your token from https://nport.io/dashboard"
  echo "   Then run: export NPORT_TOKEN=your-token-here"
  exit 1
fi

echo "🚀 Starting nport tunnel..."
echo "   Local port : $LOCAL_PORT"
echo "   Remote port: ${REMOTE_PORT:-random}"
echo "   Token      : ${NPORT_TOKEN:0:8}..."
echo ""

while true; do
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Connecting to nport..."

  if nport \
    --authtoken "$NPORT_TOKEN" \
    --region eu \
    -remote-port "$REMOTE_PORT" \
    "http://localhost:$LOCAL_PORT"; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Tunnel closed gracefully."
  else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  Tunnel disconnected!"
  fi

  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Reconnecting in 5 seconds..."
  sleep 5
done
