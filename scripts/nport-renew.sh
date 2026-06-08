#!/bin/bash
# nport-renew.sh — Auto-renew nport tunnel every 4 hours
# Usage: ./nport-renew.sh &
# Or run via cron: */5 * * * * /path/to/nport-renew.sh check

PORT="${NPORT_PORT:-3217}"
SERVICE="${NPORT_SERVICE:-talkone}"
PIDFILE="/tmp/nport-${PORT}.pid"
LOGFILE="/tmp/nport-${PORT}.log"
RENEW_INTERVAL=14400  # 4 hours in seconds

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOGFILE"
}

start_tunnel() {
    # Kill existing nport process for this port
    if [ -f "$PIDFILE" ]; then
        local old_pid
        old_pid=$(cat "$PIDFILE" 2>/dev/null)
        if [ -n "$old_pid" ] && kill -0 "$old_pid" 2>/dev/null; then
            log "Killing old nport process: $old_pid"
            kill "$old_pid" 2>/dev/null
            sleep 2
        fi
        rm -f "$PIDFILE"
    fi

    # Also kill any other nport processes on this port
    pkill -f "nport ${PORT}" 2>/dev/null
    sleep 1

    # Start new tunnel in background
    log "Starting nport tunnel: port=$PORT service=$SERVICE"
    nport "$PORT" -s "$SERVICE" >> "$LOGFILE" 2>&1 &
    local pid=$!
    echo "$pid" > "$PIDFILE"
    log "nport started with PID: $pid"

    # Wait a moment and check if it's still running
    sleep 3
    if kill -0 "$pid" 2>/dev/null; then
        log "nport tunnel is running"
    else
        log "ERROR: nport tunnel failed to start"
        rm -f "$PIDFILE"
        return 1
    fi
}

check_tunnel() {
    # Check if nport process is running
    if [ -f "$PIDFILE" ]; then
        local pid
        pid=$(cat "$PIDFILE" 2>/dev/null)
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            # Process is running, check if tunnel is responsive
            # Try to detect if nport output has recent activity
            if [ -f "$LOGFILE" ]; then
                local last_line
                last_line=$(tail -1 "$LOGFILE" 2>/dev/null)
                log "Tunnel OK (PID: $pid) — Last: $last_line"
            else
                log "Tunnel OK (PID: $pid)"
            fi
            return 0
        fi
    fi

    # Process not running, restart
    log "Tunnel not running, restarting..."
    start_tunnel
}

# ── Main ──
case "${1:-run}" in
    run)
        # Run in loop mode (foreground daemon)
        log "=== nport-renew daemon started ==="
        log "Port: $PORT, Service: $SERVICE, Renew interval: ${RENEW_INTERVAL}s"
        start_tunnel
        while true; do
            sleep "$RENEW_INTERVAL"
            log "Renewing tunnel (4h interval)..."
            start_tunnel
        done
        ;;
    check)
        # Single check (for cron)
        check_tunnel
        ;;
    start)
        start_tunnel
        ;;
    stop)
        if [ -f "$PIDFILE" ]; then
            local pid
            pid=$(cat "$PIDFILE" 2>/dev/null)
            if [ -n "$pid" ]; then
                kill "$pid" 2>/dev/null
                log "Stopped nport (PID: $pid)"
            fi
            rm -f "$PIDFILE"
        fi
        pkill -f "nport ${PORT}" 2>/dev/null
        ;;
    status)
        if [ -f "$PIDFILE" ]; then
            local pid
            pid=$(cat "$PIDFILE" 2>/dev/null)
            if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
                echo "nport is running (PID: $pid)"
                echo "Port: $PORT, Service: $SERVICE"
                echo "Log: $LOGFILE"
                tail -5 "$LOGFILE" 2>/dev/null
            else
                echo "nport is NOT running (stale PID file)"
            fi
        else
            echo "nport is NOT running"
        fi
        ;;
    *)
        echo "Usage: $0 {run|check|start|stop|status}"
        echo "  run   - Run as daemon, auto-renew every 4h (default)"
        echo "  check - Single check/restart if needed (for cron)"
        echo "  start - Start tunnel once"
        echo "  stop  - Stop tunnel"
        echo "  status - Show status"
        exit 1
        ;;
esac
