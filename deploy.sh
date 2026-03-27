#!/bin/bash

# ==============================================================================
# LeadFlow CRM Automated Deployment Script (Ubuntu 22.04 / 24.04 LTS)
# ==============================================================================

# Exit immediately on error
set -e

# --- CONFIGURATION VARIABLES (Update these!) ---
export TARGET_USER="leadflow"
export PROJECT_DIR="/home/$TARGET_USER/saas-project"
export DOMAIN_NAME="20.18.160.17"
export DB_NAME="leadflow_db"
export DB_USER="leadflow_user"
export DB_PASSWORD="leadflow123"
export DJANGO_SECRET_KEY="replace-this-with-a-very-secret-string"

echo "========================================================"
echo "Starting Installation and Deployment process..."
echo "Target User: $TARGET_USER"
echo "Project Dir: $PROJECT_DIR"
echo "Domain/IP:   $DOMAIN_NAME"
echo "========================================================"

# Check if script is run as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run this script with sudo."
  exit 1
fi

# 1. System Updates & Dependencies
echo "--> Updating system and installing dependencies..."
apt update && apt upgrade -y
apt install -y python3-pip python3-dev python3-venv libpq-dev postgresql postgresql-contrib nginx curl bash-completion git ufw

# Install Node.js & npm (NodeSource 20.x)
if ! command -v node &> /dev/null; then
    echo "--> Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi

# Install PM2
if ! command -v pm2 &> /dev/null; then
    echo "--> Installing PM2 globally..."
    npm install -g pm2
fi

# 2. Clone the project if it doesn't exist
echo "--> Cloning Repository..."
if [ ! -d "$PROJECT_DIR" ]; then
    sudo -u "$TARGET_USER" git clone https://github.com/code4degree-oss/leadflow.git "$PROJECT_DIR"
else
    echo "Directory $PROJECT_DIR already exists, skipping clone."
fi

# 3. PostgreSQL Setup
echo "--> Configuring PostgreSQL..."
sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME};" || echo "DB already exists"
sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';" || echo "User already exists"
sudo -u postgres psql -c "ALTER ROLE ${DB_USER} SET client_encoding TO 'utf8';"
sudo -u postgres psql -c "ALTER ROLE ${DB_USER} SET default_transaction_isolation TO 'read committed';"
sudo -u postgres psql -c "ALTER ROLE ${DB_USER} SET timezone TO 'UTC';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"
# Fix for PostgreSQL 15+: grant schema permissions
sudo -u postgres psql -d "${DB_NAME}" -c "GRANT ALL ON SCHEMA public TO ${DB_USER};"

# 4. Backend (Django) Setup
echo "--> Setting up Django Backend..."
cd "$PROJECT_DIR/SAAS"

# Create venv and install dependencies
sudo -u "$TARGET_USER" python3 -m venv venv
sudo -u "$TARGET_USER" -H bash -c "source venv/bin/activate && pip install wheel gunicorn psutil && pip install -r requirements/prod.txt"

# Create .env for Django (using django-environ variable names)
echo "--> Creating Backend .env..."
cat <<EOF | sudo -u "$TARGET_USER" tee "$PROJECT_DIR/SAAS/.env"
DJANGO_SECRET_KEY=$DJANGO_SECRET_KEY
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=$DOMAIN_NAME,127.0.0.1,localhost
DATABASE_URL=postgres://$DB_USER:$DB_PASSWORD@127.0.0.1:5432/$DB_NAME
REDIS_URL=redis://127.0.0.1:6379/0
CELERY_BROKER_URL=redis://127.0.0.1:6379/1
CORS_ALLOWED_ORIGINS=http://$DOMAIN_NAME,https://$DOMAIN_NAME,http://127.0.0.1:3000
EOF

# Run migrations and collect static files (using production settings)
echo "--> Running migrations and collecting static files..."
sudo -u "$TARGET_USER" -H bash -c "source venv/bin/activate && export DJANGO_SETTINGS_MODULE=config.settings.production && python manage.py migrate && python manage.py collectstatic --noinput"

# 5. Gunicorn Systemd Service
echo "--> Configuring Gunicorn Systemd Service..."
cat <<EOF | tee /etc/systemd/system/gunicorn.service
[Unit]
Description=gunicorn daemon for Leadflow Backend
After=network.target

[Service]
User=$TARGET_USER
Group=www-data
WorkingDirectory=$PROJECT_DIR/SAAS
Environment="DJANGO_SETTINGS_MODULE=config.settings.production"
ExecStart=$PROJECT_DIR/SAAS/venv/bin/gunicorn --access-logfile - --workers 3 --bind unix:$PROJECT_DIR/SAAS/gunicorn.sock config.wsgi:application

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl start gunicorn
systemctl enable gunicorn

# 6. Frontend (Next.js) Setup
echo "--> Setting up Next.js Frontend..."
cd "$PROJECT_DIR/leadflow-crm-frontend/leadflow"

echo "--> Installing Node modules..."
sudo -u "$TARGET_USER" -H bash -c "cd $PROJECT_DIR/leadflow-crm-frontend/leadflow && npm install"

# Create .env for Next.js
echo "--> Creating Frontend .env..."
cat <<EOF | sudo -u "$TARGET_USER" tee "$PROJECT_DIR/leadflow-crm-frontend/leadflow/.env.local"
NEXT_PUBLIC_API_URL=http://$DOMAIN_NAME/api/v1
EOF

# Build Next.js app
echo "--> Building Next.js application..."
sudo -u "$TARGET_USER" -H bash -c "cd $PROJECT_DIR/leadflow-crm-frontend/leadflow && npm run build"

# Start PM2
echo "--> Starting PM2 Process for Frontend..."
sudo -u "$TARGET_USER" -H bash -c "cd $PROJECT_DIR/leadflow-crm-frontend/leadflow && pm2 delete leadflow-frontend 2>/dev/null; pm2 start npm --name 'leadflow-frontend' -- start"
sudo -u "$TARGET_USER" -H bash -c "pm2 save"
env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u "$TARGET_USER" --hp "/home/$TARGET_USER"

# 7. Nginx Reverse Proxy Setup
echo "--> Configuring Nginx..."
cat <<EOF | tee /etc/nginx/sites-available/leadflow
server {
    listen 80;
    server_name $DOMAIN_NAME;

    # Backend Static Files
    location /static/ {
        alias $PROJECT_DIR/SAAS/staticfiles/;
    }

    # Media Files
    location /media/ {
        alias $PROJECT_DIR/SAAS/media/;
    }

    # Django Backend (API & Admin)
    location ~ ^/(api|leadflow-backend-admin) {
        include proxy_params;
        proxy_pass http://unix:$PROJECT_DIR/SAAS/gunicorn.sock;
    }

    # Next.js Frontend
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

ln -sf /etc/nginx/sites-available/leadflow /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

# 8. Firewall Setup
echo "--> Configuring UFW Firewall..."
ufw allow 'Nginx Full'
ufw allow OpenSSH

echo "========================================================"
echo "Deployment Script Completed Successfully!"
echo "Please verify by visiting: http://$DOMAIN_NAME"
echo "========================================================"
