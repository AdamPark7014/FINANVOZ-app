#!/usr/bin/env bash
# Corre EN EL SERVIDOR (lo llama scripts/desplegar-backend.sh después de subir los archivos a $DIR/.subida):
#   1. Pone en su lugar compose, Kong, init de la base, enrutador `main` y funciones (cambio atómico de carpeta).
#   2. docker compose up -d y espera a que los seis contenedores estén sanos; reinicia functions (código nuevo).
#   3. Aplica en orden las migraciones pendientes, cada una en su transacción, y las anota en
#      supabase_migrations.schema_migrations (la tabla de `supabase db push`). PostgREST recarga el esquema.
# No imprime secretos.
set -euo pipefail

DIR="${1:-/opt/finanvoz-backend}"
SUBIDA="$DIR/.subida"
cd "$DIR"

# ── 1. Archivos ──────────────────────────────────────────────────────────────────────────────────────────────────
mkdir -p volumes/api volumes/db
# Kong arma su configuración al arrancar: si cambió kong.yml o el entrypoint, se reinicia abajo.
kong_antes="$(cat volumes/api/kong.yml volumes/api/kong-entrypoint.sh 2>/dev/null | sha256sum)"
cp "$SUBIDA/deploy/docker-compose.yml" docker-compose.yml
cp "$SUBIDA/deploy/volumes/api/kong.yml" "$SUBIDA/deploy/volumes/api/kong-entrypoint.sh" volumes/api/
cp "$SUBIDA/deploy/volumes/db/roles.sql" "$SUBIDA/deploy/volumes/db/jwt.sql" volumes/db/
rm -rf volumes/.functions-nuevo
mv "$SUBIDA/functions" volumes/.functions-nuevo
cp -r "$SUBIDA/deploy/volumes/functions/main" volumes/.functions-nuevo/main
rm -rf volumes/functions.anterior
if [ -d volumes/functions ]; then mv volumes/functions volumes/functions.anterior; fi
mv volumes/.functions-nuevo volumes/functions
rm -rf volumes/functions.anterior
rm -rf migraciones
mv "$SUBIDA/migrations" migraciones

# ── 2. Contenedores ──────────────────────────────────────────────────────────────────────────────────────────────
docker compose up -d --remove-orphans --quiet-pull 2>&1 | grep -v -E '^ (Container|Network|Volume) ' || true
docker restart finanvoz-functions >/dev/null
if [ "$kong_antes" != "$(cat volumes/api/kong.yml volumes/api/kong-entrypoint.sh | sha256sum)" ]; then
  docker restart finanvoz-kong >/dev/null && echo "finanvoz-kong reiniciado (configuración nueva)"
fi
for c in finanvoz-db finanvoz-auth finanvoz-rest finanvoz-storage finanvoz-kong finanvoz-functions; do
  s=ninguno
  for _ in $(seq 1 60); do
    s="$(docker inspect -f '{{.State.Health.Status}}' "$c" 2>/dev/null || echo ninguno)"
    [ "$s" = healthy ] && break
    sleep 2
  done
  echo "$c: $s"
  [ "$s" = healthy ] || { echo "$c no quedó sano; revisa: docker logs $c" >&2; exit 1; }
done

# ── 3. Migraciones ───────────────────────────────────────────────────────────────────────────────────────────────
psql_db() { docker exec -i finanvoz-db psql -v ON_ERROR_STOP=1 -U postgres -d postgres -X -q "$@"; }
psql_db <<'SQL'
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key, statements text[], name text
);
SQL
for archivo in migraciones/*.sql; do
  base="$(basename "$archivo" .sql)"
  version="${base%%_*}"
  nombre="${base#*_}"
  if [ "$(psql_db -At -c "select 1 from supabase_migrations.schema_migrations where version = '$version'")" = 1 ]; then
    echo "migración $base: ya estaba"
    continue
  fi
  {
    echo 'begin;'
    cat "$archivo"
    echo
    echo "insert into supabase_migrations.schema_migrations (version, name) values ('$version', '$nombre');"
    echo 'commit;'
  } | psql_db
  echo "migración $base: aplicada"
done
psql_db -c "notify pgrst, 'reload schema'"
rm -rf "$SUBIDA"
echo "listo"
