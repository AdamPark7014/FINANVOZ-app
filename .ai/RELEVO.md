# RELEVO

- **2026-11-16 (claude-code) — Panel admin/ERP y página de venta (pedido de Adam desde el hilo de proyecto). NO desplegado.**
  - Tres pasadas: Cursor hizo la primera (`.ai/encargos/2026-11-16-admin-erp-y-venta.md`, copia en
    `docs/diseno/admin-venta/ENCARGO.md`); Codex no arrancó (`codex exec` no pudo leer archivos en su sandbox de
    Windows); Claude hizo el pulido y la revisión final.
  - Base: `services/proxy/supabase/migrations/20261401000000_admin_erp.sql` (miembros, parámetros, clientes,
    prospectos, ventas con folio FV-0001, bitácora por triggers, comisiones por mes, `admin_resumen`,
    `admin_convertir_prospecto` atómica, `admin_registrar_prospecto` con límite por IP y reparto por turno).
    Huecos cerrados en la pasada final: vendedor que insertaba venta pagada, venta con cliente de otro vendedor,
    venta cobrada editable, folio/autor reescribibles, cancelar sin motivo, trigger de parámetros que bloqueaba al
    service_role, cifras globales visibles al vendedor, cobrado contado en el mes de registro.
  - Edge Function `prospecto` (formulario «Hablar con un asesor»). Variables: `WEB_ORIGEN`, `PROSPECTO_SAL`.
  - Web `apps/web` (`@cartera/web`): venta `/` igual a la muestra aprobada (`docs/diseno/admin-venta/venta.html`),
    panel `/admin` (Resumen, Prospectos, Clientes, Ventas, Vendedores y comisiones, Ajustes), aviso y soporte
    reutilizan los de la calculadora. `/admin?demo` = datos de ejemplo en memoria. Variables `VITE_*` en
    `apps/web/.env.example`.
  - Verificado: `pnpm lint`, `pnpm typecheck`, vitest `proxy` 265 (admin 27), `web` 10, `calculadora` 40, build web;
    capturas 390/1536 de las 7 pantallas sin desborde ni errores de consola; recorrido real en modo de ejemplo
    (prospecto → ganado → venta $6,000 → cobro → cancelación con motivo → ajustes → cliente con RFC → menú móvil).
  - Pendiente de Adam: qué venden de verdad los vendedores, precios y comisión reales (se cambian en Ajustes), el
    dominio «admin» que conservó, y su OK para aplicar la migración, desplegar la función y publicar la web. Las
    cuentas de los vendedores se crean en Supabase Auth y se dan de alta en Vendedores.

- **2026-11-15 (claude-code) — Dependencias al día con Node 26.13.1 / pnpm 10.34.9 (solo parches y menores). NO publicado.**
  - Fuera de la app: eslint 9.39.5, typescript-eslint 8.72, prettier 3.10, vite 7.3.8, vitest 4.1.12, jsdom 27.4,
    fast-check 4.10, fast-xml-parser 5.12, zod 4.6.7, fflate 0.8.3.
  - App (`apps/movil`): expo 57.0.33 y los módulos `expo-*` / `jest-expo` en los parches que pide el SDK 57
    (`pnpm exec expo install …`). Son módulos nativos: la próxima build de desarrollo/tienda debe recompilarse.
    React, React Native, Skia, Reanimated y demás nativos no se tocaron. Expo sugiere TypeScript ~6.0.3: es mayor, no se subió.
  - `better-sqlite3` se queda en 13.0.3: la 13.2.0 siempre compila con node-gyp y aquí no hay Visual Studio. La 13.0.3
    instalada carga bien en Node 26.
  - `apps/movil/jest.setup.ts`: Node 26 trae `ErrorEvent` global y React 19 trataba de usar `window.dispatchEvent` en el
    entorno de jest-expo (3 pruebas de `compartido.test.tsx` caían con «window.dispatchEvent is not a function»; con
    Node 22 pasan). Se borra `ErrorEvent` cuando no hay `dispatchEvent`, como en Node 22. Decisión en `docs/ESTADO.md`.
  - Verificado con Node 26: `pnpm lint`, `pnpm typecheck`, `pnpm test` (3,272), `pnpm --filter movil test:app` (934) y build
    de la calculadora. Aviso de pnpm sin efecto en pruebas: `expo-router` 57.0.31 pide `@expo/metro-runtime` ^57.0.18 y
    `@expo/router-server` lo deja en 57.0.16.
  - Mayores pendientes y su costo: `C:\dev\.ai\dependencias-2026-11.md`.

- **2026-11-14 (claude-code) — Limpieza de documentación (Adam: «quita documentación y unifica»).** Borrados 1 documentos obsoletos sin referencias (auditorías, planes y prompts viejos; están en el historial de git). Índice único del repo: `docs/INDICE.md`; índice de todos los proyectos: `C:\dev\DOCS.md`; memoria compartida de Codex/Claude/Cursor/Grok: `C:\dev\.ai\memoria`.

- **Último turno:** claude-code
- **Fecha:** 2026-11-08
- **Rama:** main

## Hecho el 08-11

- Adam pidió «mejorarla por muchísimo». La laptop estaba igual a `origin/main` (`b851563`): nada sin subir. Los 29
  stashes son del 18-10 o antes y no se tocaron.
- `951243e`/`a7febf9`: O7 solo deja escrito el colchón del 10 % si cabe en lo que hoy queda libre (`colchonInicial`);
  antes el primer «Hoy» abría en $0 y «Te faltan». Verificado: vitest de `servicios/onboarding`, jest de
  `pantallas/onboarding` (40/40), `tsc` de `apps/movil`. Suite completa y Maestro: los corre el CI del push.
- Auditoría con las capturas de Maestro iOS de `b851563` (artefacto `maestro-ios-85`). Cuidado al leerlas: esa build del
  simulador **no** trae `EXPO_PUBLIC_PLUS_SIN_TIENDA` ni dictado, así que el aviso de Plus en las consultas y la falta de
  micrófono en «Dímelo» no ocurren en TestFlight. Lo de Plus sí aplicará cuando haya tienda (H7 sigue abierto).
- Propuesta visual sin construir, esperando a Adam: canvas privado «FinanVoz · El salto» (inicio que dice qué hacer,
  plática en filas compactas, varias cosas de corrido, cierre del día por voz).
- Corrección a lo de abajo: `iOS · TestFlight` y `Android · Play` corrieron en verde sobre `b851563` el 28-10, después
  de escribir «Estado de tiendas». No confirmé en App Store Connect el número de build ni su estado.
- 09-11: Maestro 05 fallaba dos veces seguidas porque `cuenta-*-saldo` ya no sale en el árbol de accesibilidad de iOS
  (va dentro de `accessibilityElementsHidden`; el código no cambió desde el 28-10, en pantalla salía $575). Ahora lee
  la etiqueta de `cuenta-*-accion`. 03 falló una vez y pasó al repetirlo.
- 09-11: Adam pide herramientas «más duras» para diseño y natividad. Propuesta sin construir: mantener los motores en
  TypeScript y pasar lo visible a SwiftUI/Compose (`@expo/ui`, `expo-symbols`, `expo-glass-effect`, Reanimated 4, Skia,
  `expo-widgets`; todas con versión en el SDK 57). Hoy la app no usa ninguna.

## Hecho el 28-10

- **El asistente platica (Adam, 28-10: «ve cómo mejorar los modelos de cada cosa… que tenga igual
  conversaciones»).** Detalle en `docs/06-NLU.md §15`; decisiones, pendientes 153–155 y mediciones en
  `docs/ESTADO.md`. Commits: `385ec34` (golden y evaluación), `6c06af2` (nivel 0, esquema, proxy), `04e1047` (app),
  `fea24e8` (docs).
  - **Turno anterior**: la app guarda el último turno entendido de la sesión (`TurnoAnterior { frase,
    interpretacion }`, nunca lo que contestó: ni cifras ni saldos) y lo manda con la siguiente frase al nivel 0 y a la
    nube (`contexto.anterior`; `OpcionesConversacion` de `servicios/registrar.ts`, `anteriorRef` en
    `pantallas/asistente/useAsistente.ts`). No se guarda: al relanzar la app la plática empieza de cero.
  - **Nivel 0** (`packages/nlu/src/reglas/seguimiento.ts`): seguimientos de consultas («¿y la semana pasada?», «¿y en
    comida?», «¿y en total?», «¿y en la Nu?», «¿y Juan?», «¿por qué?» tras «hoy puedes»), de registros («otra igual»,
    «otro de 95», «no, en efectivo», «con BBVA», «fue ayer», «eran 850», «ponlo en súper», «quítale 10» con la cuenta
    hecha en código, «bórrala») y de «¿me alcanza?» («¿y a 6 meses?», «¿y de contado?», «¿y si espero a la
    quincena?», «¿y de 900?», «ya la compré»), y respuestas a una aclaración (la cifra que faltaba, «$250» de «dos
    cincuenta», «el jueves» de la semana pasada, el periodo de «¿De cuándo?»), también pegadas a la frase de antes
    como las manda la app.
  - **Consultas**: `proximo_ingreso` («¿cuándo me pagan?») y `desglose_hoy` («¿por qué tengo tan poco hoy?», el
    «Cómo lo calculé» en una frase) nuevas y **de Gratis** (`CONSULTAS_GRATIS`); «¿cuánto debo?» = tarjetas;
    «¿cuánto tengo?» = todas las cuentas; «la semana pasada» y «antier» como periodos; pagos que vienen siempre hacia
    adelante («esta semana» = próximos 7 días; sin periodo, hasta el ingreso); «¿cuánto gasté?» sin periodo pregunta
    «¿De cuándo?» con chips. SIMULAR conserva el artículo («unos tenis»: de ahí sale «Si los compras…»).
  - **App**: `nivelCero` aplica también correcciones, anulaciones, duplicados y simulaciones del nivel 0 (antes iban
    a la nube aunque se entendieran; sin red quedaban Por revisar), salvo con frases esperando internet (esperan en la
    cola). El nivel 0 de la app recibe las fechas del ingreso (`fechasDelIngreso` en `servicios/nube.ts`).
  - **Charla** (`packages/nlu/src/charla.ts` decide, `apps/movil/src/asistente/charla.ts` contesta): despedida,
    «ok», «¿cómo estás?», «¿qué le puedo preguntar?», queja, colchón, apartado, libre, pago para no generar intereses
    y «no entendí»/«¿mande?», que repite lo último que dijo el asistente.
  - **Nube**: `contexto_min.anterior` en el contrato (≤ 3,000 caracteres, intención conocida; otra clave = 400) y
    prompt con «# Conversación», 3 ejemplos con turno anterior y la semana pasada calculada en el turno del usuario.
    **Desplegado** el 28-10 (`desplegar-funciones.sh` desde `fea24e8`): `probar-backend` 31/31, prompt nuevo en
    producción (17,809 tokens de entrada).
- **Números** (golden nuevo `fixtures/nlu/golden-conversaciones.jsonl`: 88 conversaciones, 186 turnos):
  - Nivel 0: cobertura 88/183 → **183/183**; precisión 88/92 → **184/184**; seguimientos 13/87 → 85/87 (los 2 son de
    la nube); charla 8/19 → 19/19; conversaciones completas 8/88 → 86/88. Golden principal sigue 162/162; pasos,
    confirmación y reparación al 100 %.
  - Nube (85 seguimientos, Haiku 5.5 por la puerta): 34/85 sin contexto → **85/85** con turno anterior (dos
    corridas; la primera, antes de ajustar el prompt, 80/85: el 85/85 puede ser optimista). 0.000255 → 0.000279–0.000317
    USD por frase. Golden principal con el prompt nuevo: 160/164 en una corrida (163/164 el 26-10); los 4 fallos
    dieron 11/12 al repetirlos 3 veces.
  - Gasto: ~0.20 USD del proyecto `pruebas` (de 3.598 a 3.797 USD según `GET /uso`, cota superior porque es
    compartido). Queda ~0.20 hasta el 1-nov.
- Verificación: `pnpm lint`, `pnpm typecheck`, `pnpm test` (vitest 3268/3268), jest completo 930/934 y las 4 que
  fallaban (frases que ahora resuelve el nivel 0) corregidas y vueltas a correr junto con `src/asistente`,
  `src/pantallas/asistente`, `src/pantallas/me-alcanza` y `src/servicios` (todo en verde). Pruebas viejas que pedían
  la nube o `null` para «cuánto gasté», «la semana pasada», «qué pagos tengo esta semana», «borra lo del cine», «no,
  los tacos fueron en efectivo» y la elección de «$2.50» se actualizaron a lo nuevo.
- Turno anterior (28-10, misma fecha): dirección B+ «Viva» en cinco fases (fundamentos, inicio D1/D7, «Te escucho»
  D2, registro D3 y «¿Me alcanza?» D4, Movimientos D5 y Cuentas D6) y el arreglo de Maestro 02/03; detalle en
  `git log` (`7090f46`…`28da864`), `02 §4` y `§16`.

## Estado de tiendas

- **TestFlight 1.0.0 (14)** desde `dad15f2` (nivel 0 del 26-10 + tema claro + H1/H8/06): VALID e
  `IN_BETA_TESTING` en el grupo interno «Equipo Finanvoz (interno)» (Adam es el único tester). La plática y B+ no
  están en ninguna build.
- **Play**: el AAB que se sube es el 1.0.0 (versionCode 5) desde `dad15f2`; copia en
  `C:\dev\builds\FINANVOZ\1.0.0-5\bundle\release\app-release.aab`. No hay cuenta de servicio: subir es a mano.
- **Maestro de iPhone**: con B+ (`12db214`) pasaban 01, 04, 05, 06, 09 y los no bloqueantes 07 y 08; 02 y 03 se
  arreglaron en `0049d2a`/`28da864`. No he visto la corrida de CI de este push.
- **App Store Connect**: app creada el 22-10; falta ficha, privacidad y revisión (`docs/tienda/IOS-APP-STORE.md`).
- Secretos de firma en GitHub desde el 22-10 (nombres en `docs/tienda/`). Flujos de tiendas solo a mano
  (`ios-testflight.yml`, `android-play.yml`, `workflow_dispatch`).

## Backend y puerta de IA

- Backend propio en el Hetzner: `https://finanvoz-api.zynoratek.com` (Supabase mínimo; `/opt/finanvoz-backend`).
  La IA va por la puerta única (`http://puerta-ia:8080`, token del proyecto en la carpeta local de secretos), Haiku
  5.5 en modo herramienta, `NLU_PROVEEDORES=anthropic`.
- Funciones al día con este turno (28-10, `fea24e8`). Para redesplegar: `bash
  services/proxy/scripts/desplegar-funciones.sh` y después `node services/proxy/scripts/probar-backend.mjs`.
- **Compatibilidad**: la app nueva manda `anterior`; el proxy ya lo acepta. Las builds viejas no lo mandan y siguen
  igual, salvo que si la nube contesta `proximo_ingreso` o `desglose_hoy` el teléfono viejo lo rechaza («No
  entendí»): solo para «¿cuándo me pagan?» y parecidas, que antes tampoco entendía bien.
- Evals de la nube: por la puerta con el token de `pruebas` (Haiku), `--concurrencia 2 --por-minuto 30`, y
  `ANTHROPIC_BASE_URL=https://ia.zynoratek.com` en el comando (el shell trae otro y da 401). Al 28-10 `pruebas` lleva
  ~3.80 de 4 USD (compartido); se renueva el 1-nov. Medir solo con `--solo` o `--solo-seguimientos`.
- Respaldo en la nube apagado hasta tener SMTP; sin respaldos de la base (decisión de Adam).

## Norte de producto (Adam, voz)

App que se siente trivial (hablar y listo) con motores, proxy y libro pesados detrás. Nada fuera de `01-PRD.md` sin
spec: web con el libro, facturar por voz, «todo el planeta» o SAT automático son decisiones de producto y legal.

## A medias — CUIDADO

- **La plática no está en ninguna build** ni probada en teléfono (pendiente 153): hace falta TestFlight y AAB nuevos.
  Solo está probada en vitest, jest y los evals.
- **B+ y el nivel 0 del 26-10 tampoco están en ninguna build.**
- **Ola 7 y la UI de Cursor sin probar en teléfono**: asistente, voz y onboarding por voz solo en jest y en el
  simulador de CI.
- `fixtures/nlu/grabaciones/` siguen siendo las del prompt del 26-10 (`--offline` reproduce esas); no se regrabaron
  para no gastar 0.05 USD más del cupo de `pruebas`.
- M0, dominio `finanvoz.com` y aviso revisado por abogado: Adam (bloquean ficha pública y prueba externa).
- Respaldar las llaves de Android fuera de la PC.

## Siguiente

1. Nueva build (TestFlight y AAB, a mano) con B+ y la plática, y probar en teléfono: «¿cuánto gasté en comida esta
   semana?» → «¿y la semana pasada?»; «coca 25» → «no, en efectivo» → «otra igual»; «¿me alcanza para unos tenis de
   1,200?» → «¿y a 6 meses?» → «ya los compré»; «¿cuándo me pagan?»; «no entendí»; y sin internet.
2. Pendientes 154 (lo que debes a personas) y 155 (seguimientos que todavía van a la nube).
3. Adam decide la auditoría (`docs/diseno/AUDITORIA-PRO-2026-10.md`): propuestas 2–6 esperan su visto bueno.

## No tocar

- Solo `main`; sin ramas, PR ni reset duro sin Adam.
- `LEYENDA_ESTIMACION` (`08 §1`) literal; `packages/core` E*; vectores a mano.
- `PreviaWidget` / `widget.test` salvo pedido explícito.
- Emitir facturas, declaraciones u open banking con la clave del banco sin cambio de spec y legal.
- No subir el tope de `pruebas` en la puerta: lo decide Adam.
- Credenciales fuera del repo (solo los scripts de Adam las leen); este archivo es público: sin correos, llaves ni
  enlaces privados.

## Estimación rápida

FinanVoz código ~95 %; camino a tiendas ~70 % (prueba interna en Play y TestFlight; faltan fichas públicas, dominio y
legal).
