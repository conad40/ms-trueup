#!/bin/bash
# update-watcher.sh — Watches for rebuild trigger and runs docker compose build
# Install: copy to /opt/docker/ms-trueup/scripts/ and run as a systemd service
#
# Create /etc/systemd/system/trueup-updater.service:
#   [Unit]
#   Description=TrueUp Update Watcher
#   After=docker.service
#   [Service]
#   Type=simple
#   WorkingDirectory=/opt/docker/ms-trueup
#   ExecStart=/opt/docker/ms-trueup/scripts/update-watcher.sh
#   Restart=always
#   [Install]
#   WantedBy=multi-user.target
#
# Then: systemctl enable --now trueup-updater

TRIGGER_FILE="/opt/docker/ms-trueup/.rebuild-trigger"
COMPOSE_DIR="/opt/docker/ms-trueup"

echo "TrueUp update watcher started"

while true; do
    if [ -f "$TRIGGER_FILE" ]; then
        echo "$(date) — Rebuild triggered"
        rm -f "$TRIGGER_FILE"
        cd "$COMPOSE_DIR"
        docker compose up -d --build app 2>&1
        echo "$(date) — Rebuild complete"
    fi
    sleep 5
done
