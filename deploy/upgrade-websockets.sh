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

# Find the project directory dynamically
PROJECT_DIR=$(dirname $(pwd))

echo "==> Upgrading Gunicorn to ASGI/Uvicorn for WebSockets..."
if [ -f "/etc/systemd/system/gunicorn.service" ]; then
    sed -i 's/config.wsgi:application/-k uvicorn.workers.UvicornWorker config.asgi:application/g' /etc/systemd/system/gunicorn.service
    systemctl daemon-reload
    systemctl restart gunicorn
else
    echo "WARNING: /etc/systemd/system/gunicorn.service not found. You may need to manually update your gunicorn command."
fi

echo "==> Upgrading Nginx configuration..."
# Find the Nginx config file dynamically
NGINX_CONF=$(grep -l "proxy_pass.*gunicorn.sock" /etc/nginx/sites-enabled/* /etc/nginx/sites-available/* 2>/dev/null | head -n 1)

if [ -z "$NGINX_CONF" ]; then
    echo "ERROR: Could not automatically locate your Nginx configuration file containing gunicorn.sock."
    echo "Please manually add the /ws/ block to your Nginx config."
else
    echo "Found Nginx config at: $NGINX_CONF"
    
    if ! grep -q "location /ws/" "$NGINX_CONF"; then
        sed -i '/location \/ {/i \
    # WebSockets\n    location /ws/ {\n        proxy_pass http://unix:'"$PROJECT_DIR"'/SAAS/gunicorn.sock;\n        proxy_http_version 1.1;\n        proxy_set_header Upgrade $http_upgrade;\n        proxy_set_header Connection "upgrade";\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Host $server_name;\n        proxy_read_timeout 86400s;\n        proxy_send_timeout 86400s;\n    }\n' "$NGINX_CONF"

        nginx -t
        systemctl restart nginx
        echo "    Nginx updated and restarted successfully."
    else
        echo "    Nginx is already configured for WebSockets."
    fi
fi

echo "========================================================"
echo "  WebSockets Upgrade Complete! Real-time features are live."
echo "========================================================"
