#!/bin/bash

# ==============================================================================
# LeadFlow CRM Automated Deployment Script (Ubuntu 22.04 LTS)
# 
# Instructions:
# 1. Update the variables below with your deployment details.
# 2. Make the script executable: chmod +x deploy.sh
# 3. Run the script with sudo: sudo ./deploy.sh
# ==============================================================================

# Exit immediately on error
set -e

# --- CONFIGURATION VARIABLES (Update these!) ---
export TARGET_USER="leadflow"                         # The non-root user that owns the project files
export PROJECT_DIR="/home/$TARGET_USER/saas-project" # Path to the cloned repository
export DOMAIN_NAME="yourdomain.com"                  # Domain name or VM IP
export DB_NAME="leadflow_db"
export DB_USER="leadflow_user"
export DB_PASSWORD="StrongDatabasePassword123!"
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
  exit
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

# 1.5. Clone the project if it doesn't exist
echo "--> Cloning Repository..."
if [ ! -d "$PROJECT_DIR" ]; then
    sudo -u $TARGET_USER git clone https://github.com/code4degree-oss/leadflow.git "$PROJECT_DIR"
else
    echo "Directory $PROJECT_DIR already exists, skipping clone."
fi

# 2. PostgreSQL Setup
echo "--> Configuring PostgreSQL..."
# Run postgres commands as the postgres user
sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME};" || echo "DB already exists"
sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';" || echo "User already exists"
sudo -u postgres psql -c "ALTER ROLE ${DB_USER} SET client_encoding TO 'utf8';"
sudo -u postgres psql -c "ALTER ROLE ${DB_USER} SET default_transaction_isolation TO 'read committed';"
sudo -u postgres psql -c "ALTER ROLE ${DB_USER} SET timezone TO 'UTC';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"


# 3. Backend (Django) Setup
echo "--> Setting up Django Backend..."
cd $PROJECT_DIR/SAAS

# Create venv and install dependencies as the target user
sudo -u $TARGET_USER python3 -m venv venv
sudo -u $TARGET_USER -H bash -c "source venv/bin/activate && pip install wheel gunicorn && pip install -r requirements/prod.txt"

# Create .env for Django
echo "--> Creating Backend .env..."
cat <<EOF | sudo -u $TARGET_USER tee $PROJECT_DIR/SAAS/.env
DEBUG=False
SECRET_KEY=$DJANGO_SECRET_KEY
ALLOWED_HOSTS=$DOMAIN_NAME,127.0.0.1,localhost

DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_HOST=127.0.0.1
DB_PORT=5432
EOF

# Run migrations and collect static files
echo "--> Running migrations and collecting static files..."
sudo -u $TARGET_USER -H bash -c "source venv/bin/activate && python manage.py migrate && python manage.py collectstatic --noinput"

# Set up Gunicorn Systemd Service
echo "--> Configuring Gunicorn Systemd Service..."
cat <<EOF | tee /etc/systemd/system/gunicorn.service
[Unit]
Description=gunicorn daemon for Leadflow Backend
After=network.target

[Service]
User=$TARGET_USER
Group=www-data
WorkingDirectory=$PROJECT_DIR/SAAS
ExecStart=$PROJECT_DIR/SAAS/venv/bin/gunicorn --access-logfile - --workers 3 --bind unix:$PROJECT_DIR/SAAS/gunicorn.sock config.wsgi:application

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl start gunicorn
systemctl enable gunicorn

# 4. Frontend (Next.js) Setup
echo "--> Setting up Next.js Frontend..."
cd $PROJECT_DIR/leadflow-crm-frontend/leadflow

# Install node modules
echo "--> Installing Node modules..."
sudo -u $TARGET_USER -H bash -c "npm install"

# Create .env for Next.js
echo "--> Creating Frontend .env..."
# Note: For Server side components, point to the internal API (or via Nginx). 
# For client-side, it usually needs the public URL.
cat <<EOF | sudo -u $TARGET_USER tee $PROJECT_DIR/leadflow-crm-frontend/leadflow/.env.local
NEXT_PUBLIC_API_URL=http://$DOMAIN_NAME/api
EOF

# Build Next.js app
echo "--> Building Next.js application..."
sudo -u $TARGET_USER -H bash -c "npm run build"

# Start PM2
echo "--> Starting PM2 Process for Frontend..."
sudo -u $TARGET_USER -H bash -c "pm2 start npm --name 'leadflow-frontend' -- start"
# Save PM2 state and generate startup script
sudo -u $TARGET_USER -H bash -c "pm2 save"
env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $TARGET_USER --hp /home/$TARGET_USER


# 5. Nginx Reverse Proxy Setup
echo "--> Configuring Nginx..."
cat <<EOF | tee /etc/nginx/sites-available/leadflow
server {
    listen 80;
    server_name $DOMAIN_NAME;

    # Backend Static Files
    location /static/ {
        alias $PROJECT_DIR/SAAS/staticfiles/;
    }

    # Django Backend (API & Admin)
    location ~ ^/(api|admin) {
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

# Enable the Nginx site config
ln -sf /etc/nginx/sites-available/leadflow /etc/nginx/sites-enabled/
# Remove default nginx config to prevent conflicts
rm -f /etc/nginx/sites-enabled/default

# Test and restart Nginx
nginx -t
systemctl restart nginx


# 6. Basic Firewall Setup
echo "--> Configuring UFW Firewall..."
ufw allow 'Nginx Full'
ufw allow OpenSSH
# ufw --force enable 


echo "========================================================"
echo "Deployment Script Completed Successfully!"
echo "Please verify by visiting: http://$DOMAIN_NAME"
echo ""
echo "Note: If you want to enable HTTPS, install certbot and run:"
echo "sudo apt install -y certbot python3-certbot-nginx"
echo "sudo certbot --nginx -d $DOMAIN_NAME"
echo "========================================================"
