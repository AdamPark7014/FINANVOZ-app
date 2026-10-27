# RELEVO

- **Último turno:** claude-code
- **Fecha:** 2026-10-26
- **Rama:** main

## Hecho en este turno

- **Intérprete «perfeccionado» (encargo de Adam: que entienda bien, rápido, sin trabarse y barato).** Números en
  `docs/ESTADO.md` (Decisiones 26-10, M3) y `services/proxy/README.md` → Medición del 26-10-2026:

  | Métrica | Antes (`fce19b9`) | Después |
  |---|---|---|
  | Nivel 0 (teléfono, sin red, gratis), precisión 100 % | 147/164 (89.6 %) | 162/164 (98.8 %) |
  | Frases del golden que van a la nube | 17 (10.4 %) | 2 (1.2 %): M02, V09 |
  | Nube, caso completo (golden completo, Haiku 5.5) | 161/164 (98.2 %) | 163/164 (99.4 %) |
  | Nube p50 / p95 | 1.14 / 1.65 s | 1.18 / 1.89 s |
  | p95 de una frase del golden (mezcla) | ~1.1 s | < 1 ms |
  | USD por 1,000 frases dichas | 0.027 | ~0.003 |

- **Nivel 0** (`packages/nlu/src/reglas/`, va dentro de la app: **hace falta otra build** para que llegue al teléfono):
  diccionario ampliado y «conocidas sin categoría» (chelas, gas, pastel, celular, propina, enganche…), DESC de destino
  («croquetas para el perro» → mascotas, «regalo para mi sobrina», «tacos al pastor», «enganche del coche»), verbos
  cargué/cooperé/me tomé/almorcé, un monto dicho antes para varias cosas → un gasto, parte sin monto → pregunta,
  «dos cincuenta» → pregunta con las dos opciones, «le di/pasé MONTO a PERSONA» → gasto (familiar → apoyo familiar),
  «me pagaron X por un trabajo» → honorarios, cuentas divididas con «éramos N» y «Caro y Juan me deben su parte».
  Ante la duda sigue preguntando o dejando la frase a la nube (regla 12). Spec en `06 §3.1` y `§9.1`–`§9.3`; 15 banderas
  `reglas` del golden a `true`; pruebas de la app que forzaban la nube con «chelas» usan «micheladas».
- **Nube** (`services/proxy/.../nlu/`): prompt afinado (destino solo si se dice, «como N» sin preguntar, dividida sin
  nombres sin preguntar, diccionario igual al del nivel 0); `stop_reason: max_tokens` → reintento que pide respuesta
  más corta; reintento sin turno vacío. Sigue Haiku 5.5 `low`: Sonnet no hace falta (fallos variables, 15/15 al repetir).
- **Funciones del proxy desplegadas y probadas** (26-10, `services/proxy/scripts/desplegar-funciones.sh`):
  `probar-backend.mjs` 31/31; `nlu-interpretar` 200 en 1.13 s. Nota: lo desplegado antes ya era idéntico a `fce19b9`
  (el reintento de 4 s sí estaba en producción; la nota anterior del RELEVO estaba vieja).
- **Grabaciones reales** de la nube en `fixtures/nlu/grabaciones/anthropic/claude-haiku-5-5.jsonl`: `pnpm eval:nlu
  --offline` reproduce 163/164 en CI (CA-M3-06 y CA-M3-01 cumplen con Anthropic).
- `pnpm eval:nlu --por-minuto N`: espacia las llamadas (el proyecto `pruebas` de la puerta tiene 60/min, compartidas
  con los evals de otras apps). Gasto de evals de este turno: ~0.12 USD.

## Estado de tiendas

- **TestFlight 1.0.0 (14)** desde `dad15f2` (nivel 0 nuevo + tema claro + H1/H8/06): VALID e `IN_BETA_TESTING` en el
  grupo interno «Equipo Finanvoz (interno)» (acceso a todas las builds, Adam es el único tester), consultado por API el
  26-10. La 13 (`fce19b9`, tema claro sin el nivel 0 nuevo) queda superada.
- **Play**: el AAB que se sube es el 1.0.0 (versionCode 5) desde `dad15f2` (corrida 40410380877), firmado con la llave
  de subida (SHA-256 8F:67:…:05:00 comprobada); copia en `C:\dev\builds\FINANVOZ\1.0.0-5\bundle\release\app-release.aab`.
  El 4 queda superado.
- **Maestro de iPhone en `dad15f2`**: pasan 02, 04, 05, 06, 07, 08 y 09. Fallan 01 («Debes»: el desplazamiento deja la
  tarjeta arriba, fuera de pantalla) y 03 (`ajustes-terminos` está en pantalla y en el árbol, pero Maestro no lo da por
  visible al final de la lista): fallos del flujo, no de la app (capturas revisadas).
- **App Store Connect**: app creada el 22-10 (es-MX, SKU `FINANVOZ-IOS`); falta ficha, privacidad y revisión (§5–§7 de
  `docs/tienda/IOS-APP-STORE.md`). Ficha de Play en `docs/tienda/play/`.
- **Play**: no hay cuenta de servicio; subir a la prueba interna es a mano en la consola.
- Secretos de firma de iOS y Android cargados en GitHub el 22-10 (nombres en `docs/tienda/`; los valores viven fuera
  del repo). Flujos: `ios-testflight.yml`, `android-play.yml`.

## Backend y puerta de IA

- Backend propio en el Hetzner: `https://finanvoz-api.zynoratek.com` (Supabase mínimo; compose en
  `/opt/finanvoz-backend`, plantilla en `services/proxy/deploy/`). La IA va por la puerta única
  (`ANTHROPIC_BASE_URL=http://puerta-ia:8080`, token del proyecto en la carpeta local de secretos, nunca en el repo),
  Haiku 5.5 en modo herramienta, `NLU_PROVEEDORES=anthropic` (sin alterno: el 2.º intento es con Claude).
- Funciones al día con este turno (26-10). Para redesplegar: `bash services/proxy/scripts/desplegar-funciones.sh` y
  después `node services/proxy/scripts/probar-backend.mjs`.
- Evals de la nube: por la puerta con el token de `pruebas` (Haiku; nunca Opus de juez), `--concurrencia 2
  --por-minuto 30`. Al 26-10 el proyecto `pruebas` lleva ~3.6 de 4 USD del mes (también lo usan otras apps).
- Respaldo en la nube apagado hasta tener SMTP; sin respaldos de la base (decisión de Adam).

## Norte de producto (Adam, voz)

App que se siente trivial (hablar y listo) con motores, proxy y libro pesados detrás. Nada fuera de `01-PRD.md` sin
spec: web con el libro, facturar por voz, «todo el planeta» o SAT automático son decisiones de producto y legal.

## A medias — CUIDADO

- **El nivel 0 nuevo no está en ninguna build**: hace falta otra de TestFlight y otro AAB para probarlo en teléfono.
- **Ola 7 y la UI de Cursor sin probar en teléfono**: asistente, voz y onboarding por voz solo se han visto en jest y
  en el simulador de CI.
- **Maestro de iPhone nunca ha estado en verde**: pasan 02, 04, 05, 07, 08 y 09; 01 y 03 fallan por tiempos.
- M0, dominio `finanvoz.com` y aviso revisado por abogado: Adam (bloquean ficha pública y prueba externa).
- Respaldar las llaves de Android fuera de la PC.

## Siguiente

1. Nueva build (TestFlight y AAB) con el nivel 0 nuevo y probar en teléfono frases como «unas chelas, 340 en
   efectivo», «le pasé 200 a mi jefa», «croquetas para el perro 640 con la oro» sin internet.
2. Adam prueba la build de `fce19b9` (tema claro, H1, H8, H10).
3. Adam decide la auditoría (`docs/diseno/AUDITORIA-PRO-2026-10.md`): propuestas 2–6 esperan su visto bueno.

## No tocar

- Solo `main`; sin ramas, PR ni reset duro sin Adam.
- `LEYENDA_ESTIMACION` (`08 §1`) literal; `packages/core` E*; vectores a mano.
- `PreviaWidget` / `widget.test` salvo pedido explícito.
- Emitir facturas, declaraciones u open banking con la clave del banco sin cambio de spec y legal.
- Credenciales fuera del repo (solo los scripts de Adam las leen); este archivo es público: sin correos, llaves ni
  enlaces privados.

## Estimación rápida

FinanVoz código ~95 %; camino a tiendas ~70 % (prueba interna en Play y TestFlight; faltan fichas públicas, dominio y
legal).
