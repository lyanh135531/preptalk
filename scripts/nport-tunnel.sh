#!/usr/bin/env bash
# ============================================
# nport.link tunnel script for PrepTalk
# Auto-reconnects on disconnect
# Usage: nohup ./nport-tunnel.sh > /tmp/nport.log 2>&1 &
# ============================================

set -euo pipefail

LOCAL_PORT="${LOCAL_PORT:-3217}"
SERVICE="${NPORT_SERVICE:-talkone}"

echo "🚀 Starting nport.link tunnel..."
echo "   Local port: $LOCAL_PORT"
echo "   Service: $SERVICE"
echo ""

while true; do
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Connecting nport $LOCAL_PORT -s $SERVICE ..."

    if nport "$LOCAL_PORT" -s "$SERVICE"; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Tunnel closed gracefully."
    else
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  Tunnel disconnected!"
    fi

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Reconnecting in 5 seconds..."
    sleep 5
done
