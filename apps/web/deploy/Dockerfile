# Página de venta + panel admin de FinanVoz.
# Contexto de build: raíz del monorepo (C:\dev\apps\FINANVOZ-app).
#   docker build -f apps/web/deploy/Dockerfile --build-arg VITE_SUPABASE_URL=... .

FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/
# Solo el workspace web (sin movil ni nativos).
# `cartera` (la raíz) aporta TypeScript y @types/node; `@cartera/web...` la web y sus dependencias.
RUN pnpm install --frozen-lockfile --filter cartera --filter "@cartera/web..." \
 && test -d apps/web/node_modules/vite

COPY tsconfig.base.json ./
COPY apps/web apps/web
# Aviso de privacidad y soporte se importan del código de la calculadora (una sola fuente legal).
COPY apps/calculadora/src apps/calculadora/src

ARG VITE_SUPABASE_URL=
ARG VITE_SUPABASE_ANON_KEY=
ARG VITE_PROSPECTO_URL=
ARG VITE_APP_STORE_URL=
ARG VITE_PLAY_STORE_URL=
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_PROSPECTO_URL=$VITE_PROSPECTO_URL \
    VITE_APP_STORE_URL=$VITE_APP_STORE_URL \
    VITE_PLAY_STORE_URL=$VITE_PLAY_STORE_URL

RUN pnpm --filter @cartera/web build

FROM nginx:1.27-alpine AS runtime
ARG VITE_SUPABASE_URL=
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
COPY apps/web/deploy/nginx.conf /etc/nginx/templates/default.conf.template
# Cabeceras de seguridad en un archivo aparte: nginx no hereda `add_header` dentro de un `location` que define
# los suyos, así que cada `location` lo incluye.
COPY apps/web/deploy/cabeceras.inc /etc/nginx/templates/cabeceras.inc.template
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
# Sustituye ${VITE_SUPABASE_URL} en CSP al arrancar (imagen oficial nginx).
ENV NGINX_ENVSUBST_FILTER=VITE_SUPABASE_URL
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
