# Backend propio (Supabase mínimo) en el Hetzner

La app no usa Supabase Cloud: Auth, PostgREST, Storage y las Edge Functions de `services/proxy/supabase` corren en el servidor de Adam, detrás de Traefik, en **`https://finanvoz-api.zynoratek.com`**. Es el mismo contrato que un proyecto de Supabase (`/auth/v1`, `/rest/v1`, `/storage/v1`, `/functions/v1`, llave `anon` + JWT de la sesión), así que la app y las funciones no cambian: la build solo recibe `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY` (variables del repositorio en GitHub).

```
teléfono ──https──▶ Traefik (red proxy) ──▶ finanvoz-kong:8000 ──┬─▶ finanvoz-auth:9999      GoTrue (anónimos)
                                                                  ├─▶ finanvoz-rest:3000      PostgREST (RLS)
                                                                  ├─▶ finanvoz-storage:5000   Storage (archivos en volumen)
                                                                  └─▶ finanvoz-functions:9000 edge-runtime ──▶ puerta-ia:8080 (Claude)
                                     finanvoz-db (supabase/postgres 17, sin puertos publicados, red finanvoz_internal)
```

| Contenedor | Imagen | Memoria (límite) |
|---|---|---|
| `finanvoz-db` | `supabase/postgres:17.6.1.136` | 1 GB |
| `finanvoz-auth` | `supabase/gotrue:v2.197.0` | 256 MB |
| `finanvoz-rest` | `postgrest/postgrest:v14.18` | 256 MB |
| `finanvoz-storage` | `supabase/storage-api:v1.81.0` | 512 MB |
| `finanvoz-functions` | `supabase/edge-runtime:v1.77.4` | 1 GB |
| `finanvoz-kong` | `kong/kong:3.9.3` | 512 MB |

Versiones tomadas del `docker/docker-compose.yml` (+ `docker-compose.kong.yml`) de `supabase/supabase` en octubre de 2026. Fuera: Studio, Realtime, analytics, vector, imgproxy, meta y pooler. En reposo usan ~0.5 GB de RAM entre todos.

## Archivos

| Archivo | Qué es |
|---|---|
| `docker-compose.yml` | Los seis servicios. Hosts por nombre de contenedor (Kong y functions también están en `proxy`, donde otros proyectos tienen `db`, `api`…) |
| `.env.example` | Variables del `.env` del servidor, sin valores |
| `volumes/api/kong.yml` | Rutas de Kong: recorte del oficial a auth, rest, storage y functions |
| `volumes/api/kong-entrypoint.sh` | Entrypoint oficial de Kong (sustituye las llaves en `kong.yml`) |
| `volumes/db/roles.sql`, `jwt.sql` | Init de la base: contraseñas de `authenticator`, `supabase_auth_admin`, `supabase_storage_admin` y `jwt_exp` |
| `volumes/functions/main/index.ts` | Enrutador del edge-runtime (ver «Diferencias») |
| `aplicar.sh` | Corre en el servidor: pone los archivos, `docker compose up -d`, espera a que todo esté sano y aplica migraciones pendientes |
| `traefik-finanvoz-backend.yml` | Copia de `/opt/traefik/config/finanvoz-backend.yml` (Traefik lo recarga solo) |

En el servidor todo vive en `/opt/finanvoz-backend` (`.env` con `chmod 600`, `volumes/functions` con el código, `migraciones/`). Volúmenes Docker: `finanvoz-backend_db-data`, `_db-config`, `_storage-data` (respaldos y plantillas) y `_deno-cache`. **No hay respaldos de la base** (decisión de Adam para el Hetzner): `docker compose down -v` o borrar esos volúmenes borra usuarios, cupos, consentimientos y respaldos cifrados para siempre.

## Secretos

Un archivo por valor en `C:\dev\secrets\finanvoz-backend\` (nunca en git): `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `POSTGRES_PASSWORD`, `NLU_SAL_USUARIO`, `LISTA_ESPERA_SAL`, `REVENUECAT_WEBHOOK_SECRET`, `S3_PROTOCOL_ACCESS_KEY_ID`, `S3_PROTOCOL_ACCESS_KEY_SECRET`. Los crea `node services/proxy/scripts/generar-secretos-backend.mjs` (no pisa los existentes). `ANON_KEY` y `SERVICE_ROLE_KEY` son JWT HS256 con `role` `anon` / `service_role` firmados con `JWT_SECRET`; si cambia `JWT_SECRET` hay que regenerar las dos, volver a desplegar y poner la `anon` nueva en GitHub (y todas las sesiones de los teléfonos se invalidan).

La llave de Claude es el token de proyecto de la puerta de IA (`C:\dev\secrets\puerta-ia\finanvoz.token`), con `ANTHROPIC_BASE_URL=http://puerta-ia:8080` (el script usa `https://ia.zynoratek.com` si el contenedor `puerta-ia` no está en la red `proxy`).

## Desplegar

```bash
bash services/proxy/scripts/desplegar-backend.sh     # todo: .env, compose, funciones, migraciones pendientes (idempotente)
bash services/proxy/scripts/desplegar-funciones.sh   # solo el código de las funciones, como esté en disco
node services/proxy/scripts/probar-backend.mjs       # prueba de humo de punta a punta (--sin-ia: sin llamar a Claude)
```

`desplegar-backend.sh` abre solo dos conexiones ssh (el servidor corta ráfagas cuando entran varios agentes a la vez). Las migraciones se anotan en `supabase_migrations.schema_migrations`, igual que `supabase db push`: una migración nueva en `supabase/migrations/` se aplica sola en el siguiente despliegue; una ya aplicada no se vuelve a correr (no edites migraciones aplicadas). Cambiar una variable (por ejemplo, la llave de la IA) = actualizar el archivo de secretos y correr `desplegar-backend.sh`.

Traefik: `traefik-finanvoz-backend.yml` va en `/opt/traefik/config/finanvoz-backend.yml` (certificado de Let's Encrypt por HTTP-01; el DNS comodín `*.zynoratek.com` ya apunta al servidor).

## Diferencias con Supabase Cloud

- **`verify_jwt` por función.** El enrutador `main` verifica el JWT (HS256 con `JWT_SECRET`) en todas las funciones salvo las de `FUNCIONES_SIN_JWT` (`lista-espera,webhooks-revenuecat`, lo mismo que `supabase/config.toml`). Sin encabezado responde 401 `UNAUTHORIZED_NO_AUTH_HEADER`, con otro cuerpo que el de la función (el cliente ya se fija en el estado).
- **`SUPABASE_URL` de las funciones.** Hablan con Kong por la red interna (`http://finanvoz-kong:8000`), salvo `respaldo` (`FUNCIONES_URL_PUBLICA`), que recibe el dominio público porque firma URLs de Storage que el teléfono usa directo (`respaldo-nube.ts` exige que empiecen con `<url>/storage/v1/`).
- **CORS.** Kong no agrega CORS a `/functions/v1`: cada función responde el suyo (lista-espera solo permite `CALCULADORA_ORIGEN`), como en la nube.
- **Mapa de importaciones** por función (`<función>/deno.json`), como `supabase functions deploy`.
- **Sin panel.** SQL con `docker exec -it finanvoz-db psql -U postgres`; registros con `docker logs finanvoz-functions` (las funciones solo registran metadatos, regla 9).
- **Límites de Auth por cliente:** `GOTRUE_RATE_LIMIT_HEADER=X-Forwarded-For` (Traefik reemplaza el encabezado que manda el cliente); 60 altas anónimas por hora por IP.

## Correo y cuenta de respaldo (apagado)

El respaldo en la nube (M9) solo funciona con una **sesión de correo**: la app vincula el correo al usuario anónimo con `PUT /auth/v1/user` + código y entra en otro teléfono con `/auth/v1/otp`. Sin SMTP no sale ningún correo, así que hoy la app no puede activar el respaldo (el resto de la nube sí funciona; la prueba de humo valida el respaldo con un usuario de correo creado por la API de administración). Para encenderlo:

1. Archivo `C:\dev\secrets\finanvoz-backend\smtp.env` con `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_ADMIN_EMAIL` (remitente) y `SMTP_SENDER_NAME`.
2. Plantillas con el código: GoTrue self-hosted lee las plantillas de una URL (`GOTRUE_MAILER_TEMPLATES_EMAIL_CHANGE`, `GOTRUE_MAILER_TEMPLATES_MAGIC_LINK`) y los asuntos de `GOTRUE_MAILER_SUBJECTS_*`; los textos están en `services/proxy/README.md` (M9 · Desplegar, paso 4). Las de fábrica mandan un enlace, no el `{{ .Token }}` que pide la app.
3. `desplegar-backend.sh`.

## Operación

- Estado: `docker ps --filter name=finanvoz-` y `docker stats --no-stream $(docker ps -q --filter name=finanvoz-)`.
- Reiniciar todo: `cd /opt/finanvoz-backend && docker compose restart`. Apagar sin borrar datos: `docker compose down` (nunca `-v`).
- Anónimos huérfanos: `scripts/limpiar-anonimos.mjs` con `SUPABASE_URL=https://finanvoz-api.zynoratek.com` y `SUPABASE_SERVICE_ROLE_KEY` (del archivo de secretos).
- Plus de prueba para un usuario: `insert into derechos (usuario_id, plan) values ('<uuid>', 'plus') on conflict (usuario_id) do update set plan = excluded.plan;`.
- Node en Windows con `NODE_USE_SYSTEM_CA=1` puede fallar con `UNABLE_TO_GET_ISSUER_CERT` contra este dominio (toma como raíz el intermedio YR1 que Windows guardó); `probar-backend.mjs` ya lo evita. Los teléfonos no se ven afectados.
