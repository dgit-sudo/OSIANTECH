#!/usr/bin/env bash
# OSIANTECH Express Deploy Checklist (DigitalOcean VM, CLI only)
# Safe for VM with existing services (e.g., Telegram bot) by:
# - using app port 3000 (internal)
# - using Nginx reverse proxy on 80/443
# - managing app with PM2 under unique process name: osiantech

set -euo pipefail

# ============================================================
# Before running:
# 1) Replace these placeholders:
#    - YOUR_VM_IP
#    - yourdomain.com
#    - you@example.com
# 2) Ensure DNS A records are set:
#    - @ -> YOUR_VM_IP
#    - www -> YOUR_VM_IP
# ============================================================

# 0) SSH into VM
# ssh root@YOUR_VM_IP

# 1) Base packages
apt update
apt install -y curl git nginx ufw

# 2) Install Node.js LTS
curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
apt install -y nodejs
node -v
npm -v

# 3) Create app directory and clone repo
mkdir -p /var/www
cd /var/www
if [ ! -d OSIANTECH/.git ]; then
  git clone https://github.com/dgit-sudo/OSIANTECH.git
fi
cd OSIANTECH

# 4) Install app deps (production)
npm install --omit=dev

# 5) Create/prepare env file
# You can provide an env source file path as first arg or via ENV_SOURCE
# e.g. `ENV_SOURCE=/path/to/my.env ./VM_DEPLOY_CHECKLIST.sh` or
# `./VM_DEPLOY_CHECKLIST.sh /path/to/my.env`.
ENV_SOURCE="${ENV_SOURCE:-${1:-}}"

if [ -f .env ]; then
  echo ".env already exists — leaving as-is."
else
  if [ -n "$ENV_SOURCE" ] && [ -f "$ENV_SOURCE" ]; then
    echo "Copying env from $ENV_SOURCE -> .env"
    cp "$ENV_SOURCE" .env
  elif [ -f .env.example ]; then
    echo "Copying .env.example -> .env"
    cp .env.example .env
  else
    echo "No .env.example found — creating placeholder .env."
    cat > .env <<'ENV'
# Placeholder .env — replace values with production credentials
PORT=3000
SESSION_SECRET=change_me_now
# Example optional variables that may be used by this checklist:
# DOMAIN=yourdomain.com
# ADMIN_EMAIL=you@example.com
# VM_IP=YOUR_VM_IP
# MONGO_URI=your_prod_mongo_uri
# RAZORPAY_KEY_ID=...
# RAZORPAY_KEY_SECRET=...
ENV
  fi
fi

# Load a minimal set of variables from .env (DOMAIN, ADMIN_EMAIL, VM_IP).
# This is tolerant of comments and empty lines; values with spaces are supported if quoted.
DOMAIN=""
ADMIN_EMAIL=""
VM_IP=""
while IFS='=' read -r key rawval; do
  key=$(echo "$key" | tr -d ' \t\r')
  case "$key" in
    DOMAIN) eval DOMAIN=$(printf "%s" "$rawval") ;;
    ADMIN_EMAIL) eval ADMIN_EMAIL=$(printf "%s" "$rawval") ;;
    VM_IP) eval VM_IP=$(printf "%s" "$rawval") ;;
  esac
done < <(grep -v '^\s*#' .env | sed -n 's/\s*$//; s/\s*=\s*/=/p')

echo "Prepared .env. Domain: ${DOMAIN:-<not set>}, Admin email: ${ADMIN_EMAIL:-<not set>}"
echo "Edit /var/www/OSIANTECH/.env now with production values if needed, then save and exit."
read -r -p "Press Enter after .env is updated..." _

# 6) Ensure app listens on env PORT (already expected)
grep -n "process.env.PORT" server.js || echo "Verify server.js uses process.env.PORT || 3000"

# 7) Install PM2 and start app
npm install -g pm2
pm2 start server.js --name osiantech --time || pm2 restart osiantech
pm2 status
pm2 logs osiantech --lines 20 --nostream

# 8) Make PM2 persistent across reboot
pm2 save
pm2 startup systemd -u root --hp /root || true
pm2 save

# 9) Nginx config (replace domain values below)
cat >/etc/nginx/sites-available/osiantech <<NGINX
server {
  listen 80;
  server_name ${DOMAIN:-yourdomain.com} www.${DOMAIN:-yourdomain.com};

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }
}
NGINX

ln -s /etc/nginx/sites-available/osiantech /etc/nginx/sites-enabled/osiantech 2>/dev/null || true
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
systemctl enable nginx

# 10) Firewall
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
ufw status

# 11) SSL via Let's Encrypt
apt install -y certbot python3-certbot-nginx
certbot --nginx -d "${DOMAIN:-yourdomain.com}" -d "www.${DOMAIN:-yourdomain.com}" --redirect -m "${ADMIN_EMAIL:-you@example.com}" --agree-tos --no-eff-email

# 12) Verify
curl -I http://127.0.0.1:3000 || true
curl -I http://yourdomain.com || true
curl -I https://yourdomain.com || true

# 13) Update flow (future)
cat <<'EOF'
Update commands:
cd /var/www/OSIANTECH
git pull origin main
npm install --omit=dev
pm2 restart osiantech
pm2 status
pm2 logs osiantech --lines 50

Telegram bot coexistence:
- Use different PM2 process name, e.g. telegram-bot
- Do not bind bot to port 3000
- Check all processes with: pm2 list
EOF

echo "Deployment checklist finished."
