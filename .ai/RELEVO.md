# RELEVO

- **Último turno:** claude-code
- **Fecha:** 2026-10-28
- **Rama:** main

## Hecho en este turno

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
