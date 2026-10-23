#!/usr/bin/env bash
# Vuelve a desplegar las Edge Functions en el backend propio (finanvoz-api.zynoratek.com), tal como estén en disco.
# Sube services/proxy/supabase/functions (sin pruebas) y el enrutador deploy/volumes/functions/main a
# /opt/finanvoz-backend/volumes/functions (cambio atómico de carpeta) y reinicia finanvoz-functions.
# Una sola conexión ssh. No toca secretos ni la base: si cambió una variable (llave o URL de la IA), usa
# desplegar-backend.sh, que reescribe el .env y recrea lo necesario.
#
#   bash services/proxy/scripts/desplegar-funciones.sh
#
# Variables opcionales: FINANVOZ_SSH (destino ssh, por omisión el Hetzner), FINANVOZ_DIR (/opt/finanvoz-backend).
set -euo pipefail

aqui="$(cd "$(dirname "$0")" && pwd)"
proxy="$(cd "$aqui/.." && pwd)"
dir="${FINANVOZ_DIR:-/opt/finanvoz-backend}"
read -r -a ssh_cmd <<<"${FINANVOZ_SSH:-ssh -i $HOME/.ssh/id_ed25519_nexara_hetzner -p 2222 -o ConnectTimeout=15 -o ConnectionAttempts=3 root@5.78.215.109}"
[ -f "$proxy/deploy/volumes/functions/main/index.ts" ] || { echo "falta deploy/volumes/functions/main/index.ts" >&2; exit 1; }

tar -cf - \
  -C "$proxy/supabase/functions" --exclude='*.test.ts' --exclude='__pruebas__' --exclude='node_modules' . \
  -C "$proxy/deploy/volumes/functions" main |
  "${ssh_cmd[@]}" "set -e
    cd '$dir/volumes'
    rm -rf .functions-nuevo functions.anterior; mkdir .functions-nuevo
    tar -xf - -C .functions-nuevo
    if [ -d functions ]; then mv functions functions.anterior; fi
    mv .functions-nuevo functions
    rm -rf functions.anterior
    echo \"funciones: \$(ls functions | tr '\n' ' ')\"
    docker restart finanvoz-functions >/dev/null
    for _ in \$(seq 1 30); do
      [ \"\$(docker inspect -f '{{.State.Health.Status}}' finanvoz-functions)\" = healthy ] && break; sleep 2
    done
    echo \"finanvoz-functions: \$(docker inspect -f '{{.State.Health.Status}}' finanvoz-functions)\""
