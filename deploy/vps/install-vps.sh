#!/usr/bin/env bash
set -euo pipefail

APP_USER="${APP_USER:-bizarena}"
APP_DIR="${APP_DIR:-/opt/bizarena}"
DATA_DIR="${DATA_DIR:-/var/lib/bizarena}"
ENV_DIR="${ENV_DIR:-/etc/bizarena}"
ENV_FILE="${ENV_FILE:-$ENV_DIR/bizarena.env}"
SERVICE_FILE="${SERVICE_FILE:-/etc/systemd/system/bizarena.service}"
BACKUP_SERVICE_FILE="${BACKUP_SERVICE_FILE:-/etc/systemd/system/bizarena-backup.service}"
BACKUP_TIMER_FILE="${BACKUP_TIMER_FILE:-/etc/systemd/system/bizarena-backup.timer}"
NGINX_FILE="${NGINX_FILE:-/etc/nginx/conf.d/bizarena.conf}"
PUBLIC_URL="${1:-${BIZ_ARENA_PUBLIC_URL:-http://YOUR-SERVER-IP}}"
CORS_ORIGINS="${BIZ_ARENA_CORS_ORIGINS:-}"
ALLOW_REGISTRATION="${BIZ_ARENA_ALLOW_REGISTRATION:-true}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run with sudo: sudo bash deploy/vps/install-vps.sh https://YOUR-DOMAIN.example" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

if [ ! -f "$SOURCE_DIR/server.js" ] || [ ! -f "$SOURCE_DIR/package.json" ]; then
  echo "Run this script from an extracted BizArena VPS package." >&2
  exit 1
fi

install_packages() {
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs npm nginx unzip curl build-essential python3 make g++
    return
  fi

  if command -v dnf >/dev/null 2>&1; then
    dnf install -y nodejs npm nginx unzip curl gcc-c++ make python3
    return
  fi

  echo "Unsupported package manager. Install Node.js LTS, npm, nginx, unzip, python3, make, and a C++ compiler manually." >&2
  exit 1
}

ensure_runtime() {
  install_packages
  command -v node >/dev/null 2>&1 || { echo "node is missing" >&2; exit 1; }
  command -v npm >/dev/null 2>&1 || { echo "npm is missing" >&2; exit 1; }
  command -v nginx >/dev/null 2>&1 || { echo "nginx is missing" >&2; exit 1; }

  local node_major
  node_major="$(node -p "Number(process.versions.node.split('.')[0])")"
  if [ "$node_major" -lt 20 ]; then
    echo "Node.js 20+ is required. Install Node.js 22 LTS, then rerun this script." >&2
    echo "Current version: $(node --version)" >&2
    exit 1
  fi
}

create_user_and_dirs() {
  if ! id "$APP_USER" >/dev/null 2>&1; then
    useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"
  fi

  mkdir -p "$APP_DIR" "$DATA_DIR" "$DATA_DIR/backups" "$ENV_DIR" "$(dirname "$NGINX_FILE")"
  chown -R "$APP_USER:$APP_USER" "$APP_DIR" "$DATA_DIR"
  chmod 750 "$ENV_DIR"
}

copy_app() {
  tar \
    --exclude="./node_modules" \
    --exclude="./data" \
    --exclude="./dist" \
    --exclude="./graphify-out" \
    -C "$SOURCE_DIR" -cf - . | tar -C "$APP_DIR" -xf -
  chown -R "$APP_USER:$APP_USER" "$APP_DIR"
}

write_env() {
  cat > "$ENV_FILE" <<EOF_ENV
NODE_ENV=production
PORT=3000
BIZ_ARENA_HOST=127.0.0.1
BIZ_ARENA_DEPLOYMENT=cloud
BIZ_ARENA_APP_MODE=server
BIZ_ARENA_STORAGE=sqlite
BIZ_ARENA_DATA_DIR=$DATA_DIR
BIZ_ARENA_SQLITE_PATH=$DATA_DIR/biz-arena.sqlite
BIZ_ARENA_PUBLIC_URL=$PUBLIC_URL
BIZ_ARENA_CORS_ORIGINS="$CORS_ORIGINS"
BIZ_ARENA_ALLOW_REGISTRATION=$ALLOW_REGISTRATION
EOF_ENV
  chmod 640 "$ENV_FILE"
  chown root:"$APP_USER" "$ENV_FILE"
}

install_node_dependencies() {
  cd "$APP_DIR"
  if command -v runuser >/dev/null 2>&1; then
    HOME="$APP_DIR" runuser -u "$APP_USER" -- npm ci --omit=dev
    return
  fi

  if command -v sudo >/dev/null 2>&1; then
    HOME="$APP_DIR" sudo -u "$APP_USER" npm ci --omit=dev
    return
  fi

  echo "Neither runuser nor sudo is available; cannot install npm dependencies as $APP_USER." >&2
  exit 1
}

install_systemd() {
  cp "$APP_DIR/deploy/vps/bizarena.service" "$SERVICE_FILE"
  cp "$APP_DIR/deploy/vps/bizarena-backup.service" "$BACKUP_SERVICE_FILE"
  cp "$APP_DIR/deploy/vps/bizarena-backup.timer" "$BACKUP_TIMER_FILE"
  systemctl daemon-reload
  systemctl enable --now bizarena
  systemctl enable --now bizarena-backup.timer
}

install_nginx() {
  local host
  host="${PUBLIC_URL#*://}"
  host="${host%%/*}"
  host="${host%%:*}"
  if [ -z "$host" ]; then
    host="YOUR-DOMAIN.example"
  fi

  sed "s/YOUR-DOMAIN.example/$host/g" "$APP_DIR/deploy/vps/nginx-bizarena.conf" > "$NGINX_FILE"
  nginx -t
  systemctl enable --now nginx
  systemctl reload nginx
}

open_local_firewall() {
  if command -v ufw >/dev/null 2>&1 && ufw status | grep -qi active; then
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw reload
  fi

  if command -v firewall-cmd >/dev/null 2>&1 && systemctl is-active --quiet firewalld; then
    firewall-cmd --permanent --add-service=http
    firewall-cmd --permanent --add-service=https
    firewall-cmd --reload
  fi
}

print_next_steps() {
  cat <<EOF_NEXT

Biz Arena VPS install complete.

Check service:
  systemctl status bizarena --no-pager
  journalctl -u bizarena -n 80 --no-pager
  systemctl status bizarena-backup.timer --no-pager

Check HTTP:
  curl -fsS http://127.0.0.1:3000/api/health
  curl -fsS $PUBLIC_URL/api/health
  curl -fsS $PUBLIC_URL/api/meta

Create and verify a backup now:
  systemctl start bizarena-backup.service
  journalctl -u bizarena-backup -n 20 --no-pager

Provider panel reminder:
  Make sure TCP 80 and 443 are open in the VPS provider firewall/security group.

After the first teacher account is created:
  sudo sed -i 's/^BIZ_ARENA_ALLOW_REGISTRATION=.*/BIZ_ARENA_ALLOW_REGISTRATION=false/' $ENV_FILE
  sudo systemctl restart bizarena

EOF_NEXT
}

ensure_runtime
create_user_and_dirs
copy_app
write_env
install_node_dependencies
install_systemd
install_nginx
open_local_firewall
print_next_steps
