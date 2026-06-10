#!/bin/bash
# auto-deploy.sh — Check git remote for new commits, auto pull & redeploy
# Usage: ./auto-deploy.sh (run once) or via cron

PROJECT_DIR="/home/systems/preptalk"
BRANCH="main"
LOGFILE="/tmp/preptalk-auto-deploy.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOGFILE"
}

cd "$PROJECT_DIR" || { log "ERROR: cannot cd to $PROJECT_DIR"; exit 1; }

# Fetch latest from remote (no merge yet)
git fetch origin "$BRANCH" 2>/dev/null
if [ $? -ne 0 ]; then
    log "WARN: git fetch failed (network issue?)"
    exit 1
fi

LOCAL=$(git rev-parse "$BRANCH")
REMOTE=$(git rev-parse "origin/$BRANCH")

if [ "$LOCAL" = "$REMOTE" ]; then
    log "No changes (LOCAL == REMOTE)"
    exit 0
fi

log "New commits detected!"
log "  LOCAL:  $LOCAL"
log "  REMOTE: $REMOTE"
log "  Diff:"
git log --oneline "$BRANCH..origin/$BRANCH" 2>/dev/null | tee -a "$LOGFILE"

# Pull latest code
log "Pulling latest code..."
git pull origin "$BRANCH" 2>&1 | tee -a "$LOGFILE"
if [ $? -ne 0 ]; then
    log "ERROR: git pull failed"
    exit 1
fi

# Rebuild Docker image
log "Rebuilding Docker image..."
docker compose build 2>&1 | tee -a "$LOGFILE"
if [ $? -ne 0 ]; then
    log "ERROR: docker build failed"
    exit 1
fi

# Restart container
log "Restarting container..."
docker compose down 2>&1 | tee -a "$LOGFILE"
docker compose up -d 2>&1 | tee -a "$LOGFILE"
if [ $? -ne 0 ]; then
    log "ERROR: docker compose up failed"
    exit 1
fi

# Wait for health check
log "Waiting for container to be ready..."
for i in $(seq 1 12); do
    sleep 5
    STATUS=$(curl -s http://localhost:3217/api/health 2>/dev/null)
    if echo "$STATUS" | grep -q '"ok":true'; then
        log "Deploy successful! Container is healthy."
        log "New commits deployed:"
        git log --oneline -3 "$BRANCH" | tee -a "$LOGFILE"

        # Restart nport tunnel (container restart kills the tunnel)
        log "Restarting nport tunnel..."
        "$PROJECT_DIR/scripts/nport-renew.sh" stop >> "$LOGFILE" 2>&1
        sleep 2
        "$PROJECT_DIR/scripts/nport-renew.sh" start >> "$LOGFILE" 2>&1
        log "nport tunnel restarted"
        exit 0
    fi
done

log "Container started but health check did not pass yet"
exit 1
