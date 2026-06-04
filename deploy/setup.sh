#!/bin/bash

# ==============================================================================
# DY LeadFlow CRM — Full Server Setup (Run ONCE on a fresh Ubuntu VM)
#
# Usage:
#   1. Copy this file to your VM
#   2. Update the CONFIGURATION VARIABLES below
#   3. chmod +x deploy.sh && sudo ./deploy.sh
# ==============================================================================

set -e

# ======================== CONFIGURATION VARIABLES =============================
# Change these for each new deployment target
TARGET_USER="dyleadflow"
PROJECT_DIR="/home/$TARGET_USER/saas-project"
DOMAIN_NAME="20.18.160.17"               # Your domain or public IP
REPO_URL="https://github.com/code4degree-oss/dyleadflow.git"

DB_NAME="dyleadflow_db"
DB_USER="dyleadflow_user"
DB_PASSWORD="dyleadflow123"                 # Change in production!
DJANGO_SECRET_KEY="replace-this-with-a-very-secret-string"  # Change in production!
# ==============================================================================

echo "========================================================"
echo "  DY LeadFlow CRM — Full Server Setup"
echo "  Target User : $TARGET_USER"
echo "  Project Dir : $PROJECT_DIR"
echo "  Domain/IP   : $DOMAIN_NAME"
echo "========================================================"

# --- Pre-flight check ---
if [ "$EUID" -ne 0 ]; then
  echo "ERROR: Please run this script with sudo."
  exit 1
fi

# ==========================================================================
# STEP 1: System Dependencies
# ==========================================================================
echo ""
echo "==> [1/8] Installing system dependencies..."
apt update && apt upgrade -y
apt install -y python3-pip python3-dev python3-venv libpq-dev \
               postgresql postgresql-contrib nginx curl \
               bash-completion git ufw

# Node.js 20.x
if ! command -v node &> /dev/null; then
    echo "    Installing Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi

# PM2
if ! command -v pm2 &> /dev/null; then
    echo "    Installing PM2..."
    npm install -g pm2
fi

# ==========================================================================
# STEP 2: Clone Repository
# ==========================================================================
echo ""
echo "==> [2/8] Cloning repository..."
if [ ! -d "$PROJECT_DIR" ]; then
    sudo -u "$TARGET_USER" git clone "$REPO_URL" "$PROJECT_DIR"
else
    echo "    Directory already exists, skipping clone."
fi

# ==========================================================================
# STEP 3: PostgreSQL Database
# ==========================================================================
echo ""
echo "==> [3/8] Configuring PostgreSQL..."
sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME};" 2>/dev/null || echo "    DB already exists"
sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';" 2>/dev/null || echo "    User already exists"
sudo -u postgres psql -c "ALTER ROLE ${DB_USER} SET client_encoding TO 'utf8';"
sudo -u postgres psql -c "ALTER ROLE ${DB_USER} SET default_transaction_isolation TO 'read committed';"
sudo -u postgres psql -c "ALTER ROLE ${DB_USER} SET timezone TO 'UTC';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"
# PostgreSQL 15+ requires explicit schema grants
sudo -u postgres psql -d "${DB_NAME}" -c "GRANT ALL ON SCHEMA public TO ${DB_USER};"

# ==========================================================================
# STEP 4: Django Backend
# ==========================================================================
echo ""
echo "==> [4/8] Setting up Django backend..."
cd "$PROJECT_DIR/SAAS"

sudo -u "$TARGET_USER" python3 -m venv venv
sudo -u "$TARGET_USER" -H bash -c "source venv/bin/activate && pip install wheel gunicorn psutil && pip install -r requirements/prod.txt"

# Generate .env (django-environ format)
echo "    Writing .env file..."
cat <<EOF | sudo -u "$TARGET_USER" tee "$PROJECT_DIR/SAAS/.env"
DJANGO_SECRET_KEY=$DJANGO_SECRET_KEY
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=$DOMAIN_NAME,127.0.0.1,localhost
DATABASE_URL=postgres://$DB_USER:$DB_PASSWORD@127.0.0.1:5432/$DB_NAME
REDIS_URL=redis://127.0.0.1:6379/0
CELERY_BROKER_URL=redis://127.0.0.1:6379/1
CORS_ALLOWED_ORIGINS=http://$DOMAIN_NAME,https://$DOMAIN_NAME,http://127.0.0.1:3000
EOF

# Migrations & static files
echo "    Running migrations..."
sudo -u "$TARGET_USER" -H bash -c "source venv/bin/activate && export DJANGO_SETTINGS_MODULE=config.settings.production && python manage.py migrate && python manage.py collectstatic --noinput"

# ==========================================================================
# STEP 5: Gunicorn Service
# ==========================================================================
echo ""
echo "==> [5/8] Configuring Gunicorn systemd service..."
cat <<EOF | tee /etc/systemd/system/gunicorn.service
[Unit]
Description=gunicorn daemon for DY LeadFlow Backend
After=network.target

[Service]
User=$TARGET_USER
Group=www-data
WorkingDirectory=$PROJECT_DIR/SAAS
Environment="DJANGO_SETTINGS_MODULE=config.settings.production"
ExecStart=$PROJECT_DIR/SAAS/venv/bin/gunicorn --access-logfile - -k uvicorn.workers.UvicornWorker --proxy-headers --forwarded-allow-ips="*" --workers 3 --timeout 300 --bind unix:$PROJECT_DIR/SAAS/gunicorn.sock config.asgi:application

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl start gunicorn
systemctl enable gunicorn

# Allow passwordless restart for CI/CD pipeline
echo "$TARGET_USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart gunicorn" | tee /etc/sudoers.d/dyleadflow-gunicorn
chmod 0440 /etc/sudoers.d/dyleadflow-gunicorn

# Fix Nginx socket permissions
usermod -a -G "$TARGET_USER" www-data
chmod 710 "/home/$TARGET_USER"

# ==========================================================================
# STEP 6: Next.js Frontend
# ==========================================================================
echo ""
echo "==> [6/8] Setting up Next.js frontend..."
cd "$PROJECT_DIR/leadflow-crm-frontend/leadflow"

sudo -u "$TARGET_USER" -H bash -c "cd $PROJECT_DIR/leadflow-crm-frontend/leadflow && npm install"

cat <<EOF | sudo -u "$TARGET_USER" tee "$PROJECT_DIR/leadflow-crm-frontend/leadflow/.env.local"
NEXT_PUBLIC_API_URL=https://$DOMAIN_NAME/api/v1
EOF

echo "    Building Next.js..."
sudo -u "$TARGET_USER" -H bash -c "cd $PROJECT_DIR/leadflow-crm-frontend/leadflow && npm run build"

sudo -u "$TARGET_USER" -H bash -c "cd $PROJECT_DIR/leadflow-crm-frontend/leadflow && pm2 delete dyleadflow-frontend 2>/dev/null; pm2 start npm --name 'dyleadflow-frontend' -- start"
sudo -u "$TARGET_USER" -H bash -c "pm2 save"
env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u "$TARGET_USER" --hp "/home/$TARGET_USER"

# ==========================================================================
# STEP 7: Nginx Reverse Proxy
# ==========================================================================
echo ""
echo "==> [7/8] Configuring Nginx..."
cat <<EOF | tee /etc/nginx/sites-available/dyleadflow
server {
    listen 80;
    server_name $DOMAIN_NAME;

    # Django static files
    location /static/ {
        alias $PROJECT_DIR/SAAS/staticfiles/;
    }

    # Django media files
    location /media/ {
        alias $PROJECT_DIR/SAAS/media/;
    }

    # Django Backend (API + hidden admin panel)
    location ~ ^/(api|dyleadflow-backend-admin) {
        include proxy_params;
        proxy_pass http://unix:$PROJECT_DIR/SAAS/gunicorn.sock;
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        client_max_body_size 50M;
    }

    # WebSockets
    location /ws/ {
        proxy_pass http://unix:$PROJECT_DIR/SAAS/gunicorn.sock;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Host \$server_name;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # Next.js Frontend (everything else)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

ln -sf /etc/nginx/sites-available/dyleadflow /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

# ==========================================================================
# STEP 8: Firewall
# ==========================================================================
echo ""
echo "==> [8/8] Configuring firewall..."
ufw allow 'Nginx Full'
ufw allow OpenSSH

echo ""
echo "========================================================"
echo "  DEPLOYMENT COMPLETE!"
echo "  Frontend : http://$DOMAIN_NAME"
echo "  Admin    : http://$DOMAIN_NAME/dyleadflow-backend-admin/"
echo ""
echo "  Next steps:"
echo "  1. Create a superuser:"
echo "     cd $PROJECT_DIR/SAAS && source venv/bin/activate"
echo "     DJANGO_SETTINGS_MODULE=config.settings.production python manage.py createsuperuser"
echo ""
echo "  2. (Optional) Enable HTTPS:"
echo "     sudo apt install -y certbot python3-certbot-nginx"
echo "     sudo certbot --nginx -d your-domain.com"
echo "========================================================"
