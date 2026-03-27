#!/bin/bash

# ==============================================================================
# LeadFlow CRM Fast Auto-Sync Script 
# Intended to be run by GitHub Actions on every push to Main
# ==============================================================================

set -e

export TARGET_USER="leadflow"
export PROJECT_DIR="/home/$TARGET_USER/saas-project"

echo "========================================================"
echo "Starting Fast Auto-Sync Deployment..."
echo "Project Dir: $PROJECT_DIR"
echo "========================================================"

cd "$PROJECT_DIR"

# 1. Pull Latest Code
echo "--> Fetching latest code from GitHub..."
git fetch origin main
git reset --hard origin/main

# 2. Update Backend
echo "--> Updating Django Backend..."
cd "$PROJECT_DIR/SAAS"
source venv/bin/activate
export DJANGO_SETTINGS_MODULE=config.settings.production

echo "--> Installing new requirements..."
pip install -r requirements/prod.txt

echo "--> Running migrations and collecting static files..."
python manage.py migrate
python manage.py collectstatic --noinput

echo "--> Restarting Gunicorn Daemon..."
# Automatically authenticates without typing password using our sudoers patch
sudo systemctl restart gunicorn

# 3. Update Frontend
echo "--> Updating Next.js Frontend..."
cd "$PROJECT_DIR/leadflow-crm-frontend/leadflow"

echo "--> Installing Node modules..."
npm install

echo "--> Rebuilding Next.js Application..."
npm run build

echo "--> Restarting PM2 process..."
pm2 restart leadflow-frontend

echo "========================================================"
echo "Auto-Sync Completed Successfully!"
echo "========================================================"
