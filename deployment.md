# LeadFlow CRM Single VM Deployment Guide

This guide covers the necessary steps to deploy the LeadFlow CRM application (Django backend, Next.js frontend, and PostgreSQL database) onto a single Virtual Machine (VM) running Ubuntu (usually Ubuntu 22.04 LTS).

## Architecture Overview
- **Database:** PostgreSQL (Port 5432, internal access only)
- **Backend (SAAS):** Python/Django running via Gunicorn.
- **Frontend (leadflow-crm-frontend):** Next.js application managed by PM2.
- **Reverse Proxy:** Nginx handling all incoming HTTP/HTTPS traffic, routing API requests to Gunicorn and web requests to PM2.

---

## 1. Initial Server Setup & Dependencies

Connect to your VM via SSH and update the system:
```bash
sudo apt update && sudo apt upgrade -y
```

Install required system packages:
```bash
sudo apt install -y python3-pip python3-dev python3-venv libpq-dev postgresql postgresql-contrib nginx curl bash-completion git
```

Install Node.js and npm (using NodeSource):
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Install PM2 globally to manage the Next.js process:
```bash
sudo npm install -g pm2
```

---

## 2. Database Setup (PostgreSQL)

Login to the Postgres console:
```bash
sudo -u postgres psql
```

Create the database and user (replace `yourpassword` with a strong password):
```sql
CREATE DATABASE leadflow_db;
CREATE USER leadflow_user WITH PASSWORD 'yourpassword';
ALTER ROLE leadflow_user SET client_encoding TO 'utf8';
ALTER ROLE leadflow_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE leadflow_user SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE leadflow_db TO leadflow_user;
\q
```

---

## 3. Clone the Project

We assume you are deploying as a non-root user (e.g., `ubuntu` or `your_user`).

```bash
cd ~
# If using git:
git clone <your-repository-url> saas-project
cd saas-project
```

---

## 4. Backend Setup (Django)

Navigate to the backend directory and set up the virtual environment:
```bash
cd ~/saas-project/SAAS
python3 -m venv venv
source venv/bin/activate
```

Install Python dependencies (adjust if you use `requirements.txt` or `requirements/production.txt`):
```bash
pip install wheel gunicorn
pip install -r requirements.txt 
# if you use a requirements folder: pip install -r requirements/production.txt
```

Create your `.env` file based on `.env.example`:
```bash
nano .env
```
Ensure the following variables reflect production:
```ini
DEBUG=False
SECRET_KEY=your-very-strong-secret-key
ALLOWED_HOSTS=yourdomain.com,your-vm-ip

DB_NAME=leadflow_db
DB_USER=leadflow_user
DB_PASSWORD=yourpassword
DB_HOST=127.0.0.1
DB_PORT=5432
```

Run database migrations and collect static files:
```bash
python manage.py migrate
python manage.py collectstatic --noinput
```

Test Gunicorn briefly to ensure it works:
```bash
gunicorn config.wsgi:application --bind 0.0.0.0:8000
# Press Ctrl+C to stop
```

### 4.1. Set up Gunicorn Systemd Service

Create a systemd service file:
```bash
sudo nano /etc/systemd/system/gunicorn.service
```

Paste the following (replace `username` with your Linux username, e.g., `ubuntu`):
```ini
[Unit]
Description=gunicorn daemon for Leadflow Backend
After=network.target

[Service]
User=username
Group=www-data
WorkingDirectory=/home/username/saas-project/SAAS
ExecStart=/home/username/saas-project/SAAS/venv/bin/gunicorn --access-logfile - --workers 3 --bind unix:/home/username/saas-project/SAAS/gunicorn.sock config.wsgi:application

[Install]
WantedBy=multi-user.target
```

Start and enable Gunicorn:
```bash
sudo systemctl start gunicorn
sudo systemctl enable gunicorn
sudo systemctl status gunicorn
```

---

## 5. Frontend Setup (Next.js)

Navigate to the frontend directory:
```bash
cd ~/saas-project/leadflow-crm-frontend/leadflow
```

Install dependencies:
```bash
npm install
```

Create production `.env` file:
```bash
nano .env.local
```
```ini
# Must point to your public API URL or a reverse proxied path
NEXT_PUBLIC_API_URL=http://yourdomain.com/api
```

Build the application for production:
```bash
npm run build
```

Start the application with PM2:
```bash
pm2 start npm --name "leadflow-frontend" -- start
```

Save PM2 configuration so it restarts on system reboot:
```bash
pm2 save
pm2 startup
# Run the command that PM2 outputs for your specific environment
```

---

## 6. Nginx Reverse Proxy Setup

Create a new Nginx configuration file:
```bash
sudo nano /etc/nginx/sites-available/leadflow
```

Add the following standard configuration. It routes `/api/`, `/admin/`, and `/static/` (backend assets) to Django/Gunicorn, and everything else to the Next.js frontend:

```nginx
server {
    listen 80;
    server_name yourdomain.com your-vm-ip;

    # Backend Static Files
    location /static/ {
        alias /home/username/saas-project/SAAS/staticfiles/; # Ensure this path matches STATIC_ROOT in Django
    }

    # Media Files (if applicable)
    location /media/ {
        alias /home/username/saas-project/SAAS/media/;
    }

    # Django Backend (API & Django Admin)
    location ~ ^/(api|admin) {
        include proxy_params;
        proxy_pass http://unix:/home/username/saas-project/SAAS/gunicorn.sock;
    }

    # Next.js Frontend
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the configuration and check for Nginx syntax errors:
```bash
sudo ln -s /etc/nginx/sites-available/leadflow /etc/nginx/sites-enabled
sudo nginx -t
```

Restart Nginx:
```bash
sudo systemctl restart nginx
```

---

## 7. Security (UFW and SSL)

Allow standard web traffic through the firewall:
```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
```

**Set up SSL with Certbot (Highly Recommended):**
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

Certbot will automatically modify your Nginx configuration to support HTTPS and redirect HTTP traffic to HTTPS.

---

## 8. Final Checks
- Visit `http://yourdomain.com` to see the Next.js frontend.
- Visit `http://yourdomain.com/api/` or `http://yourdomain.com/admin/` to verify the Django backend is responding.
- Verify logging:
  - Gunicorn: `sudo journalctl -u gunicorn`
  - React/PM2: `pm2 logs leadflow-frontend`
  - Nginx: `sudo tail -f /var/log/nginx/error.log`
