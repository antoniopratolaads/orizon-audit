#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# ORIZON Audit Suite — one-shot bootstrap for a fresh Ubuntu droplet (DO).
#
# Usage (copy/paste in the droplet console as root):
#
#   export REPO_URL="https://github.com/<user>/<repo>.git"
#   bash <(curl -fsSL https://raw.githubusercontent.com/<user>/<repo>/main/deploy/bootstrap.sh)
#
# Or, if cloned manually:
#   cd /opt/orizon && ./deploy/bootstrap.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_URL="${REPO_URL:-}"
APP_DIR="${APP_DIR:-/opt/orizon}"
BRANCH="${BRANCH:-main}"

log() { printf "\033[1;36m▶\033[0m %s\n" "$*"; }
ok()  { printf "\033[1;32m✓\033[0m %s\n" "$*"; }
err() { printf "\033[1;31m✗\033[0m %s\n" "$*" >&2; }

if [[ $EUID -ne 0 ]]; then
  err "Esegui come root (sudo -i oppure usa l'account root del droplet)."
  exit 1
fi

# 1. Dependencies
log "Installing Docker + Compose + apache2-utils (htpasswd) + git"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg git apache2-utils >/dev/null
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
"deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null
fi
systemctl enable --now docker >/dev/null
ok "Docker installato"

# 2. Clone or update repo
if [[ -n "${REPO_URL}" && ! -d "${APP_DIR}/.git" ]]; then
  log "Clone ${REPO_URL} → ${APP_DIR}"
  mkdir -p "$(dirname "${APP_DIR}")"
  git clone --branch "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
elif [[ -d "${APP_DIR}/.git" ]]; then
  log "Repo already present, git pull"
  git -C "${APP_DIR}" fetch --all
  git -C "${APP_DIR}" reset --hard "origin/${BRANCH}"
else
  err "REPO_URL non impostato e ${APP_DIR} non esiste. Export REPO_URL o clona manualmente."
  exit 1
fi
ok "Repo sincronizzato in ${APP_DIR}"

cd "${APP_DIR}"

# 3. Ensure /opt/orizon/deploy/.htpasswd exists (generates credentials on first run)
HTPASSWD_FILE="${APP_DIR}/deploy/.htpasswd"
CREDS_FILE="${APP_DIR}/deploy/CREDENTIALS.txt"
if [[ ! -f "${HTPASSWD_FILE}" ]]; then
  log "Genero credenziali Basic Auth"
  USER="orizon"
  PASS="$(openssl rand -base64 18 | tr -dc 'A-Za-z0-9' | head -c 20)"
  htpasswd -bcB "${HTPASSWD_FILE}" "${USER}" "${PASS}" >/dev/null
  umask 077
  cat > "${CREDS_FILE}" <<EOF
ORIZON Audit Suite — Basic Auth credentials
Data: $(date -u +%Y-%m-%dT%H:%M:%SZ)

URL:      http://$(curl -fsSL https://ifconfig.me || echo "<IP-DROPLET>")/
Username: ${USER}
Password: ${PASS}

Cambia la password con:
  htpasswd -B ${HTPASSWD_FILE} ${USER}
EOF
  chmod 600 "${CREDS_FILE}"
  ok "Credenziali create in ${CREDS_FILE}"
else
  ok "htpasswd già presente (non tocco)"
fi

# 4. ANTHROPIC_API_KEY (optional env fallback; primary storage is still Settings page)
ENV_FILE="${APP_DIR}/.env"
if [[ ! -f "${ENV_FILE}" ]]; then
  cat > "${ENV_FILE}" <<EOF
# Optional: set this to have a server-wide fallback if no key is saved in Settings.
# ANTHROPIC_API_KEY=sk-ant-...
EOF
fi

# 5. Build + run
log "Build + up docker compose"
docker compose -f "${APP_DIR}/docker-compose.yml" build
docker compose -f "${APP_DIR}/docker-compose.yml" up -d

# 6. Show status + credentials
sleep 2
log "Stato container:"
docker compose -f "${APP_DIR}/docker-compose.yml" ps

if [[ -f "${CREDS_FILE}" ]]; then
  echo
  ok "Deploy completato. Credenziali Basic Auth:"
  echo
  cat "${CREDS_FILE}"
fi
