#!/usr/bin/env bash
# Despliegue completo e idempotente del backend propio de FinanVoz en el Hetzner (finanvoz-api.zynoratek.com).
# Corre desde la PC (Git Bash) y abre solo dos conexiones ssh (el servidor corta ráfagas de conexiones):
#   1. Escribe /opt/finanvoz-backend/.env (chmod 600) con los secretos de C:\dev\secrets\finanvoz-backend\ y el
#      token de la puerta de IA (C:\dev\secrets\puerta-ia\finanvoz.token, si existe). No imprime ningún valor.
#      ANTHROPIC_BASE_URL: http://puerta-ia:8080 si ese contenedor está en la red `proxy`; si no, https://ia.zynoratek.com.
#   2. Sube deploy/, las migraciones y las funciones, y corre deploy/aplicar.sh en el servidor: archivos en su lugar,
#      docker compose up -d, espera a que todo esté sano y aplica las migraciones pendientes en orden.
#
#   bash services/proxy/scripts/desplegar-backend.sh
#
# Variables opcionales: FINANVOZ_SSH, FINANVOZ_DIR, FINANVOZ_SECRETOS, FINANVOZ_TOKEN_IA, FINANVOZ_ANTHROPIC_BASE_URL.
# SMTP (para encender la cuenta de respaldo): archivo smtp.env en la carpeta de secretos con líneas SMTP_*=...
# El archivo de Traefik (/opt/traefik/config/finanvoz-backend.yml) no lo toca este script: ver deploy/README.md.
set -euo pipefail

aqui="$(cd "$(dirname "$0")" && pwd)"
proxy="$(cd "$aqui/.." && pwd)"
dir="${FINANVOZ_DIR:-/opt/finanvoz-backend}"
secretos="${FINANVOZ_SECRETOS:-/c/dev/secrets/finanvoz-backend}"
token_ia="${FINANVOZ_TOKEN_IA:-/c/dev/secrets/puerta-ia/finanvoz.token}"
read -r -a ssh_cmd <<<"${FINANVOZ_SSH:-ssh -i $HOME/.ssh/id_ed25519_nexara_hetzner -p 2222 -o ConnectTimeout=15 -o ConnectionAttempts=3 root@5.78.215.109}"

for s in POSTGRES_PASSWORD JWT_SECRET ANON_KEY SERVICE_ROLE_KEY S3_PROTOCOL_ACCESS_KEY_ID S3_PROTOCOL_ACCESS_KEY_SECRET \
  NLU_SAL_USUARIO LISTA_ESPERA_SAL REVENUECAT_WEBHOOK_SECRET; do
  [ -s "$secretos/$s" ] || { echo "falta el secreto $secretos/$s" >&2; exit 1; }
done
leer() { tr -d '\r\n' <"$secretos/$1"; }
llave_ia=""
if [ -s "$token_ia" ]; then llave_ia="$(tr -d '\r\n' <"$token_ia")"; fi
echo "ANTHROPIC_API_KEY: $([ -n "$llave_ia" ] && echo "…${llave_ia: -4}" || echo 'VACÍA (falta el token de la puerta de IA)')"

# ── 1. .env (conexión 1) ─────────────────────────────────────────────────────────────────────────────────────────
base_fija="${FINANVOZ_ANTHROPIC_BASE_URL:-}"
{
  cat <<EOF
# Generado por services/proxy/scripts/desplegar-backend.sh — no editar a mano ni copiar a git.
SUPABASE_PUBLIC_URL=https://finanvoz-api.zynoratek.com
SITE_URL=https://finanvoz.com
JWT_EXPIRY=3600
POSTGRES_PASSWORD=$(leer POSTGRES_PASSWORD)
JWT_SECRET=$(leer JWT_SECRET)
ANON_KEY=$(leer ANON_KEY)
SERVICE_ROLE_KEY=$(leer SERVICE_ROLE_KEY)
S3_PROTOCOL_ACCESS_KEY_ID=$(leer S3_PROTOCOL_ACCESS_KEY_ID)
S3_PROTOCOL_ACCESS_KEY_SECRET=$(leer S3_PROTOCOL_ACCESS_KEY_SECRET)
NLU_PROVEEDORES=anthropic
NLU_TOPE_GLOBAL_DIARIO=2000
NLU_SAL_USUARIO=$(leer NLU_SAL_USUARIO)
LISTA_ESPERA_SAL=$(leer LISTA_ESPERA_SAL)
CALCULADORA_ORIGEN=https://finanvoz.com
REVENUECAT_WEBHOOK_SECRET=$(leer REVENUECAT_WEBHOOK_SECRET)
ANTHROPIC_API_KEY=$llave_ia
EOF
  if [ -s "$secretos/smtp.env" ]; then tr -d '\r' <"$secretos/smtp.env"; fi
} | "${ssh_cmd[@]}" "set -e; umask 077; mkdir -p '$dir'; cd '$dir'; cat > .env.nuevo
  base='$base_fija'
  if [ -z \"\$base\" ]; then
    if docker inspect -f '{{json .NetworkSettings.Networks.proxy}}' puerta-ia 2>/dev/null | grep -q IPAddress; then
      base=http://puerta-ia:8080
    else
      base=https://ia.zynoratek.com
    fi
  fi
  echo \"ANTHROPIC_BASE_URL=\$base\" >> .env.nuevo
  mv .env.nuevo .env; chmod 600 .env
  echo \".env escrito ($dir/.env, 600); ANTHROPIC_BASE_URL=\$base\""

# ── 2. Archivos, contenedores y migraciones (conexión 2) ─────────────────────────────────────────────────────────
tar -cf - \
  -C "$proxy" deploy/docker-compose.yml deploy/aplicar.sh deploy/volumes/api deploy/volumes/db deploy/volumes/functions/main \
  -C "$proxy/supabase" --exclude='*.test.ts' --exclude='__pruebas__' --exclude='node_modules' migrations functions |
  "${ssh_cmd[@]}" "set -e; rm -rf '$dir/.subida'; mkdir -p '$dir/.subida'; tar -xf - -C '$dir/.subida'
    bash '$dir/.subida/deploy/aplicar.sh' '$dir'"
echo "Listo: https://finanvoz-api.zynoratek.com"
