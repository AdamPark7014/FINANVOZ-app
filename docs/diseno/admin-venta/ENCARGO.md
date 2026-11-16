# Encargo · Panel admin/ERP y página de venta de Finanvoz (pasada 1: Cursor codifica)

Pedido de Adam (16-11-2026): panel admin/ERP para él (dueño) y sus dos vendedores, y una página de venta, nivel
Apple: dos clics a cualquier lado, limpio, cada módulo con su porqué; backend robusto. Muestra visual aprobada:
canvas «Finanvoz · Admin y página de venta» (descripción abajo). Repo: este (`C:\dev\apps\FINANVOZ-app`), pnpm.

## Reglas duras
- Trabaja en `main`. **Sin commit, sin push, sin ramas, sin worktrees.** No toques `apps/movil/` ni migraciones ya
  existentes (solo una migración nueva). No borres archivos. Ninguna llave ni secreto en el repo (repo público).
- Copy en español de México, tuteo, verbo primero, sin exclamaciones, dinero `$1,500` (sin centavos si son .00).
- Tema claro. Tokens de la app: acento `#0E8A6E`, acento oscuro `#0A6B57`, fondo `#F6F7F5`, superficie `#FFFFFF`,
  texto `#0F1A16`, secundario `#4A5852`, borde `#E3E8E5`, línea interna `#EDF0EE`. Inter (cuerpo) + Inter Tight
  (títulos). Radios: control 8, tarjeta 14, botón píldora 999. Un solo botón primario por pantalla. Cifras tabulares.
  Defínelos UNA vez como variables CSS en `apps/web/src/estilos/tokens.css`; cero hex sueltos en componentes.
- Objetivos táctiles ≥ 44 px, inputs de 16 px, foco visible, `aria-label` en botones de solo ícono, sin emojis
  (íconos SVG de trazo). Funciona a 390 px y 1536 px sin scroll horizontal (tablas: columnas secundarias bajo el
  nombre en móvil).
- Estados en cada pantalla: cargando (esqueleto), vacío (porqué + acción), error (qué falló + Reintentar), sin permiso.

- **Dinero en centavos enteros** (regla 1 de `CLAUDE.md`): en la base todas las columnas de dinero son `bigint`
  con sufijo `_centavos` (donde abajo dice `numeric(12,2)` usa `bigint ... _centavos`; porcentajes en puntos base
  `int`, 1500 = 15 %); en TypeScript enteros, formato `$1,500` solo en la UI. Fechas civiles `'YYYY-MM-DD'`.
- Lee `CLAUDE.md` del repo (reglas no negociables y convenciones) antes de empezar.

## 1. Base de datos: `services/proxy/supabase/migrations/20261401000000_admin_erp.sql`
Postgres de Supabase (roles `anon`, `authenticated`, `service_role`; `auth.uid()`). RLS activo en todo.
- `admin_miembros(usuario_id uuid pk references auth.users on delete cascade, nombre text, rol text check in
  ('dueno','vendedor'), activo bool default true, meta_mensual numeric(12,2) default 0, comision_pct numeric(5,2)
  null  -- null = usa el parámetro general, creado_en timestamptz)`.
- Función `admin_rol()` (security definer, stable): rol del `auth.uid()` activo o null.
- `admin_parametros(clave text pk, valor jsonb, actualizado_en, actualizado_por uuid)`. Semillas (marcadas como
  valores iniciales que Adam ajusta): `precio_plus_mensual` 99, `precio_plus_anual` 990, `precio_licencia_mes` 20,
  `comision_pct` 15, `iva_pct` 16, `dominio_publico` "" . Solo el dueño escribe; ambos roles leen.
- `admin_clientes(id uuid pk, nombre text 1..200, rfc text null (validar formato RFC 12/13 en mayúsculas),
  tipo text check in ('persona','negocio','institucion'), contacto text, telefono text, correo text,
  vendedor_id uuid references admin_miembros, notas text, creado_en, actualizado_en)`.
- `admin_prospectos(id, nombre, contacto, telefono, correo, origen check in ('pagina','referido','lista_espera',
  'llamada','otro'), interes check in ('plus','licencias','otro'), etapa check in ('nuevo','contactado','demo',
  'propuesta','ganado','perdido') default 'nuevo', motivo_perdida text null, vendedor_id, siguiente_paso text,
  siguiente_paso_en date, cliente_id uuid null references admin_clientes, creado_en, actualizado_en)`.
- `admin_ventas(id, folio text unique generado 'FV-0001' con secuencia, cliente_id not null, vendedor_id not null,
  producto check in ('plus_mensual','plus_anual','licencias'), cantidad int > 0, meses int > 0, precio_unitario
  numeric(12,2) >= 0, total numeric(12,2) generado = cantidad*meses*precio_unitario para licencias y
  cantidad*precio_unitario para plus, estado check in ('por_cobrar','pagada','cancelada') default 'por_cobrar',
  vence_en date, pagada_en timestamptz, cancelada_motivo text, creado_en, creado_por)`.
  Regla: el precio unitario por omisión sale de `admin_parametros` (trigger si viene null).
- `admin_bitacora(id bigserial, tabla, registro_id, accion, antes jsonb, despues jsonb, usuario_id, creado_en)`
  llenada por triggers de insert/update/delete en clientes, prospectos, ventas, parametros y miembros. Nadie
  la cambia; solo el dueño la lee.
- RLS: el dueño ve y cambia todo. Un vendedor ve y crea solo clientes/prospectos/ventas con `vendedor_id =
  auth.uid()`; no puede reasignar a otro, no puede marcar `pagada` ni `cancelada` (solo el dueño cobra o cancela; un
  trigger lo hace cumplir aunque la política deje pasar el update), no borra nada. Sin rol = nada. `anon` = nada.
- Vistas `security_invoker`: `admin_comisiones_mes` (por vendedor y mes: vendido, cobrado, por cobrar, comisión =
  cobrado × pct del miembro o el general), y función `admin_resumen(p_mes date)` → jsonb con ingreso cobrado del mes
  (por producto), por cobrar, ventas, prospectos por etapa, tasa de cierre, Plus activos (de `public.derechos` si
  existe: plan='plus' y vigente) y usuarios activos 7 días si hay dato; respeta el rol (vendedor = solo lo suyo).
- `admin_registrar_prospecto(p_huella_ip, p_nombre, p_contacto, p_telefono, p_correo, p_interes, p_mensaje,
  p_limite_por_hora)` security definer, solo `service_role`, con límite por IP como `20261012000000_lista_espera.sql`
  (tabla de intentos que se limpia a 24 h). Asigna vendedor por turno (el vendedor activo con menos prospectos
  abiertos; empate: el más antiguo sin asignación). Origen 'pagina'.

## 2. Edge Function `prospecto`
`services/proxy/supabase/functions/prospecto/index.ts` + lógica probada en `functions/_shared/admin/prospecto.ts`,
copiando la forma de `lista-espera` (validación, honeypot `sitio_web` = bot → 200 sin guardar, tamaño máximo, CORS
con origen de variable `WEB_ORIGEN`, huella de IP con sal `PROSPECTO_SAL`, nada personal en logs).

## 3. Web: `apps/web` (nuevo paquete `@cartera/web`, Vite + React 19 + TypeScript, como `apps/calculadora`)
Agrégalo al proyecto de vitest de la raíz (`vitest.config.ts`). Dependencia nueva justificada: `@supabase/supabase-js`
(sesión del admin con correo y contraseña de Supabase Auth). Variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
en `.env.example` del paquete. Router propio mínimo (History API) o `react-router` si lo justificas.

**Página de venta `/`** idéntica en estructura a la muestra: encabezado (logo, Cómo funciona, Para tu negocio,
Precios, Privacidad, «Descargar gratis»), héroe «Dile qué gastaste. Te dice cuánto te queda.» con maqueta de teléfono
hecha en HTML/CSS (cifra del día $412, burbuja «Tacos 80 en efectivo», respuesta del asistente, orbe del micrófono),
botones App Store/Google Play, «Dos toques. Nada más.» (Registra, Pregunta, Duerme tranquilo), Para tu negocio con
tabla de ejemplo RESICO marcada «Ejemplo ilustrativo», Precios (Gratis $0 / Plus con precio de los parámetros
públicos `src/config.ts` / «Para tu equipo o clientes» → abre el formulario «Hablar con un asesor» en una hoja),
Privacidad (3 columnas), pie con Aviso de privacidad, Soporte y Calculadora. El formulario manda a la Edge Function
`prospecto` y muestra estados enviado/error/límite.

**Panel `/admin`** (login → Resumen). Barra lateral (se vuelve barra superior desplegable en móvil): Resumen,
Prospectos, Clientes, Ventas, Vendedores y comisiones, Ajustes (los dos últimos: Vendedores visible para ambos pero
el vendedor solo se ve a sí mismo; Ajustes solo dueño). Cada módulo abre con una línea de su porqué:
- Resumen: «Lo que entró este mes y lo que falta cobrar». Tira de 4 cifras (ingreso cobrado del mes con desglose
  Plus/licencias, por cobrar, prospectos abiertos, tasa de cierre), últimas ventas, vendedores con barra de meta y
  «Pendiente hoy» (ventas por vencer, prospectos con siguiente paso hoy o vencido).
- Prospectos: «Quién puede comprar y qué sigue con cada uno». Lista por etapa (pestañas con conteo), cada fila con
  siguiente paso y fecha; cambiar etapa en 1 toque; «Ganado» convierte en cliente y abre «Registrar venta».
- Clientes: lista con búsqueda; ficha con ventas.
- Ventas: tabla con filtros Por cobrar/Pagadas/Canceladas; «Registrar venta» en hoja (cliente, producto, cantidad,
  meses, precio sugerido de parámetros, vence); el dueño ve «Marcar pagada» y «Cancelar» (con motivo).
- Vendedores y comisiones: por mes, vendido/cobrado/comisión y meta; el dueño da de alta/edita miembros (por
  usuario_id de Auth existente), meta y % de comisión.
- Ajustes (dueño): parámetros editables con la nota «Valores iniciales; ajústalos».
Acceso a datos en `apps/web/src/admin/datos.ts` (una sola capa) para que las pantallas no llamen a Supabase directo.

## 4. Pruebas (todas fuera de `apps/movil/app/`)
- `services/proxy/supabase/functions/_shared/admin/rls.test.ts` con PGlite como
  `_shared/compartido/__pruebas__/servidor.ts` (dobles de `auth.*` y roles): dueño ve todo; vendedor A no ve lo de B;
  vendedor no marca pagada ni reasigna; anon nada; folios consecutivos; total calculado; precio por omisión;
  bitácora escrita; comisión del mes; `admin_resumen` por rol; reparto por turno; límite por IP.
- `_shared/admin/prospecto.test.ts`: validación, honeypot, tamaño, CORS.
- `apps/web`: pruebas de componentes con Testing Library (venta renderiza secciones y formulario; Resumen con
  datos falsos de la capa `datos.ts`, estados vacío/error).

## Terminado cuando
`pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm vitest run --project web` (o el nombre que pongas) y
`pnpm vitest run services/proxy/supabase/functions/_shared/admin` pasan, y `pnpm --filter @cartera/web build`
compila. Deja al final un resumen de archivos creados y de lo que no pudiste terminar. Sin commit.
