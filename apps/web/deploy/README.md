# Despliegue de `apps/web` (venta + panel admin)

Sirve la página de venta (`/`) y el panel (`/admin`) detrás de Traefik en la red `proxy` del Hetzner. **Nada de esto se ejecuta solo por existir el paquete:** hace falta el OK de Adam (dominio, variables y aplicar la migración del ERP).

## Qué falta decidir

1. **Dominio** del sitio (marcador `__DOMINIO__` en `traefik-finanvoz-web.yml`). Mientras esté vacío en Ajustes (`dominio_publico`), no publiques.
2. URL pública de Supabase (`VITE_SUPABASE_URL`) y llave anónima (`VITE_SUPABASE_ANON_KEY`).
3. URL de la Edge Function `prospecto` (`VITE_PROSPECTO_URL`) y, si ya hay tiendas, `VITE_APP_STORE_URL` / `VITE_PLAY_STORE_URL`.
4. Aplicar la migración `20261401000000_admin_erp.sql` y desplegar la función `prospecto` **antes** de abrir el panel a vendedores.

## Variables (build)

| Variable | Uso |
|---|---|
| `VITE_SUPABASE_URL` | Auth + PostgREST del panel; también entra a la CSP de nginx |
| `VITE_SUPABASE_ANON_KEY` | Llave pública (anon); RLS protege los datos |
| `VITE_PROSPECTO_URL` | Formulario «Hablar con un asesor» |
| `VITE_APP_STORE_URL` / `VITE_PLAY_STORE_URL` | Botones de tienda (vacío = deshabilitados) |

Copia `apps/web/.env.example` a un `.env` fuera del repo en el servidor (`/opt/finanvoz-web/.env`).

## Pasos de despliegue

En el servidor (con Docker y red `proxy` ya creadas, igual que el backend):

```bash
# 1. Código
cd /opt/finanvoz-web
# (sincroniza este repo o copia apps/web/deploy + el monorepo necesario para el build)

# 2. Traefik: sustituye el dominio y copia el archivo al directorio de reglas dinámicas
sed 's/__DOMINIO__/TU_DOMINIO/g' apps/web/deploy/traefik-finanvoz-web.yml \
  > /ruta/a/traefik/dynamic/finanvoz-web.yml

# 3. Build y arranque (sin puertos publicados)
docker compose -f apps/web/deploy/docker-compose.yml --env-file .env up -d --build
```

## Vuelta atrás

```bash
docker compose -f apps/web/deploy/docker-compose.yml down
# Quita o renombra el YAML de Traefik para que deje de enrutar el host.
```

La imagen anterior sigue en el daemon (`docker images finanvoz-web`) si quieres volver a etiquetarla y `up` otra vez.

## Verificación posterior

```bash
curl -sI https://TU_DOMINIO/ | head
curl -sI https://TU_DOMINIO/admin | head
curl -sI https://TU_DOMINIO/aviso-de-privacidad.html | head
curl -sI https://TU_DOMINIO/soporte.html | head
```

Revisa: `200`, redirección HTTP→HTTPS, `Content-Security-Policy` con la URL de Supabase, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Permissions-Policy` sin micrófono ni cámara. En el navegador: `/admin?demo` funciona sin servidor; con sesión real, Resumen y Actividad (solo dueño).

## Local (sin desplegar)

```bash
pnpm --filter @cartera/web build
pnpm --filter @cartera/web verificar-publicacion
```
