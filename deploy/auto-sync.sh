#!/bin/bash

# ==============================================================================
# LeadFlow CRM — Fast Auto-Sync (Triggered by GitHub Actions on push to main)
#
# This script is lightweight by design. It does NOT reinstall system packages,
# databases, or Nginx. It only pulls code, installs new deps, and restarts.
# ==============================================================================

set -e

TARGET_USER="leadflow"
PROJECT_DIR="/home/$TARGET_USER/saas-project"

echo "========================================================"
echo "  LeadFlow CRM — Auto-Sync Started"
echo "  $(date '+%Y-%m-%d %H:%M:%S UTC')"
echo "========================================================"

cd "$PROJECT_DIR"

# 1. Pull latest code
echo ""
echo "==> Pulling latest code..."
git fetch origin main
git reset --hard origin/main

# 2. Backend updates
echo ""
echo "==> Updating Django backend..."
cd "$PROJECT_DIR/SAAS"
source venv/bin/activate
export DJANGO_SETTINGS_MODULE=config.settings.production

pip install -q -r requirements/prod.txt
python manage.py migrate --noinput
python manage.py collectstatic --noinput

echo "==> Restarting Gunicorn..."
sudo systemctl restart gunicorn

# 3. Frontend updates
echo ""
echo "==> Updating Next.js frontend..."
cd "$PROJECT_DIR/leadflow-crm-frontend/leadflow"

npm install --silent
npm run build

echo "==> Restarting PM2..."
pm2 restart leadflow-frontend

echo ""
echo "========================================================"
echo "  Auto-Sync Completed Successfully!"
echo "  $(date '+%Y-%m-%d %H:%M:%S UTC')"
echo "========================================================"
