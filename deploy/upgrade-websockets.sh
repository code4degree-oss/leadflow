#!/bin/bash

# ==============================================================================
# DY LeadFlow CRM — WebSockets Infrastructure Upgrade
# Run this script ONCE on your existing server to enable real-time features.
# Usage:
#   cd ~/saas-project/deploy
#   sudo ./upgrade-websockets.sh
# ==============================================================================

set -e

if [ "$EUID" -ne 0 ]; then
  echo "ERROR: Please run this script with sudo: sudo ./upgrade-websockets.sh"
  exit 1
fi

TARGET_USER="dyleadflow"
PROJECT_DIR="/home/$TARGET_USER/saas-project"

echo "==> Upgrading Gunicorn to ASGI/Uvicorn for WebSockets..."
sed -i 's/config.wsgi:application/-k uvicorn.workers.UvicornWorker config.asgi:application/g' /etc/systemd/system/gunicorn.service
systemctl daemon-reload
systemctl restart gunicorn

echo "==> Upgrading Nginx configuration..."
# Check if /ws/ is already in the Nginx config
if ! grep -q "location /ws/" /etc/nginx/sites-available/dyleadflow; then
    # Insert the WebSocket block right before "location / {"
    sed -i '/location \/ {/i \
    # WebSockets\n    location /ws/ {\n        proxy_pass http://unix:'"$PROJECT_DIR"'/SAAS/gunicorn.sock;\n        proxy_http_version 1.1;\n        proxy_set_header Upgrade $http_upgrade;\n        proxy_set_header Connection "upgrade";\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Host $server_name;\n        proxy_read_timeout 86400s;\n        proxy_send_timeout 86400s;\n    }\n' /etc/nginx/sites-available/dyleadflow

    nginx -t
    systemctl restart nginx
    echo "    Nginx updated and restarted successfully."
else
    echo "    Nginx is already configured for WebSockets."
fi

echo "========================================================"
echo "  WebSockets Upgrade Complete! Real-time features are live."
echo "========================================================"
