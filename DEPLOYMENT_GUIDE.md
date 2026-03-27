# LeadFlow CRM — Deployment Guide 🚀

A simple, step-by-step guide to deploy LeadFlow on any Ubuntu server (Azure, AWS, DigitalOcean, etc.)

---

## What You Need Before Starting

- An Ubuntu 22.04 or 24.04 server (VM) with a public IP address
- A user account on the server with sudo access (e.g., `leadflow`)
- Ability to SSH into the server from your terminal

---

## Part 1: First-Time Server Setup (Do This Once)

### Step 1 — Log into your server
Open your terminal (PowerShell on Windows) and connect:
```bash
ssh leadflow@YOUR_SERVER_IP
```

### Step 2 — Download the project
```bash
cd ~
git clone https://github.com/code4degree-oss/leadflow.git saas-project
```

### Step 3 — Edit the config (important!)
Open the setup script and change the variables at the top to match your server:
```bash
nano ~/saas-project/deploy/setup.sh
```

Change these lines:
```bash
TARGET_USER="leadflow"              # Your Linux username
DOMAIN_NAME="YOUR_SERVER_IP"        # Your IP or domain name
DB_PASSWORD="a-strong-password"     # Pick a strong database password
DJANGO_SECRET_KEY="a-random-string" # Pick a long random string
```
Save the file: Press `CTRL + X`, then `Y`, then `Enter`.

### Step 4 — Run the setup script
```bash
cd ~/saas-project/deploy
chmod +x setup.sh
sudo ./setup.sh
```
☕ Sit back — this takes 5-10 minutes. It installs everything automatically:
- PostgreSQL database
- Python virtual environment + Django dependencies
- Node.js + Next.js frontend build
- Nginx web server
- Gunicorn backend service
- PM2 frontend process manager
- Firewall rules

### Step 5 — Create your admin login
```bash
cd ~/saas-project/SAAS
source venv/bin/activate
DJANGO_SETTINGS_MODULE=config.settings.production python manage.py createsuperuser
```
It will ask you for an email and password. Remember these — you'll use them to log in!

### Step 6 — Open your browser and check!
- **Frontend:** `http://YOUR_SERVER_IP` — You should see the LeadFlow login page
- **Django Admin:** `http://YOUR_SERVER_IP/leadflow-backend-admin/` — Database admin panel

🎉 **Your app is now live!**

---

## Part 2: Auto-Deploy with GitHub (Optional but Recommended)

This makes it so every time you push code to GitHub, your server updates automatically. No more manual SSH!

### Step 1 — Copy the sync script to your server
From your **local Windows terminal** (not the SSH session):
```powershell
scp "deploy/auto-sync.sh" leadflow@YOUR_SERVER_IP:/home/leadflow/saas-project/deploy/auto-sync.sh
```

### Step 2 — Allow Gunicorn to restart without password
On your **server terminal (SSH)**:
```bash
echo "leadflow ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart gunicorn" | sudo tee /etc/sudoers.d/leadflow-gunicorn
sudo chmod 0440 /etc/sudoers.d/leadflow-gunicorn
```

### Step 3 — Add secrets to GitHub
Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions**.

Click "New repository secret" and add these **one by one**:

| Name              | Value                        |
|-------------------|------------------------------|
| `SERVER_HOST`     | Your server's IP address     |
| `SERVER_USER`     | `leadflow`                   |
| `SERVER_PASSWORD` | Your SSH login password      |

### Step 4 — Push code and watch it deploy!
Now every time you run:
```bash
git add .
git commit -m "your changes"
git push origin main
```
Go to GitHub → **Actions** tab → Watch your code deploy automatically! ✅

---

## Part 3: Useful Commands (Keep This Handy)

### Check if services are running
```bash
sudo systemctl status gunicorn    # Backend status
pm2 status                        # Frontend status
sudo systemctl status nginx       # Web server status
```

### Restart services manually
```bash
sudo systemctl restart gunicorn   # Restart backend
pm2 restart leadflow-frontend     # Restart frontend
sudo systemctl restart nginx      # Restart web server
```

### View error logs
```bash
sudo journalctl -u gunicorn --no-pager -n 50     # Backend logs
pm2 logs leadflow-frontend --lines 50             # Frontend logs
sudo tail -n 50 /var/log/nginx/error.log          # Nginx logs
```

### Run Django commands
```bash
cd ~/saas-project/SAAS
source venv/bin/activate
export DJANGO_SETTINGS_MODULE=config.settings.production

python manage.py migrate                # Apply database changes
python manage.py collectstatic --noinput # Collect static files
python manage.py createsuperuser        # Create admin user
python manage.py shell                  # Django shell
```

### Update code manually (without CI/CD)
```bash
cd ~/saas-project
git pull origin main

# Update backend
cd SAAS
source venv/bin/activate
pip install -r requirements/prod.txt
DJANGO_SETTINGS_MODULE=config.settings.production python manage.py migrate
DJANGO_SETTINGS_MODULE=config.settings.production python manage.py collectstatic --noinput
sudo systemctl restart gunicorn

# Update frontend
cd ~/saas-project/leadflow-crm-frontend/leadflow
npm install
npm run build
pm2 restart leadflow-frontend
```

---

## Part 4: Common Problems & Fixes

### "502 Bad Gateway" in browser
**Cause:** Gunicorn crashed or Nginx can't reach it.
```bash
# Check if Gunicorn is running
sudo systemctl status gunicorn

# If it's dead, restart it
sudo systemctl restart gunicorn

# If it keeps crashing, check the logs
sudo journalctl -u gunicorn --no-pager -n 100
```

### "Permission denied" for socket
**Cause:** Nginx can't access Gunicorn's socket file.
```bash
sudo usermod -a -G leadflow www-data
sudo chmod 710 /home/leadflow
sudo systemctl restart nginx
```

### Database migration errors
**Cause:** PostgreSQL 15+ doesn't give permissions automatically.
```bash
sudo -u postgres psql -d leadflow_db -c "GRANT ALL ON SCHEMA public TO leadflow_user;"
```

### Frontend shows old version
**Cause:** Next.js needs to be rebuilt after code changes.
```bash
cd ~/saas-project/leadflow-crm-frontend/leadflow
npm run build
pm2 restart leadflow-frontend
```

### Can't log in (wrong credentials)
**Cause:** You need to create a superuser first.
```bash
cd ~/saas-project/SAAS
source venv/bin/activate
DJANGO_SETTINGS_MODULE=config.settings.production python manage.py createsuperuser
```

---

## Part 5: Add HTTPS (When You Have a Domain)

Once you point a domain name (like `app.yourcompany.com`) to your server's IP:
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d app.yourcompany.com
```
Certbot will automatically configure HTTPS for you. Free SSL, auto-renewing!

After enabling HTTPS, update `SAAS/config/settings/production.py`:
```python
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
```
Then restart: `sudo systemctl restart gunicorn`

---

## File Structure Reference

```
~/saas-project/
├── SAAS/                          # Django Backend
│   ├── .env                       # Backend secrets (auto-generated)
│   ├── config/settings/
│   │   ├── base.py                # Shared settings
│   │   ├── development.py         # Local dev settings
│   │   └── production.py          # Production settings (used on server)
│   ├── manage.py                  # Django management
│   ├── requirements/
│   │   ├── base.txt               # Core packages
│   │   └── prod.txt               # Production packages
│   ├── staticfiles/               # Collected static files (auto-generated)
│   └── venv/                      # Python virtual environment
│
├── leadflow-crm-frontend/
│   └── leadflow/
│       ├── .env.local             # Frontend secrets (API URL, Maps key)
│       ├── pages/                 # Next.js pages
│       └── node_modules/          # Node packages
│
├── deploy/
│   ├── setup.sh                   # Full server setup (run ONCE)
│   ├── auto-sync.sh               # Fast CI/CD update script
│   └── README.md                  # Technical deployment reference
│
└── .github/workflows/
    └── deploy.yml                 # GitHub Actions pipeline
```

---

> **Questions?** Check the logs first, restart the services, and if nothing works — read the error message carefully. 99% of deployment issues are permissions, missing packages, or wrong environment variables.
