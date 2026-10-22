# RELEVO

- **Último turno:** claude-code
- **Fecha:** 2026-10-21
- **Rama:** main

## Hecho en este turno

- **Constructores de Mac (iOS simulador) verificados** (corrida 39642147532): `ios.yml` compila `Finanvoz.app` sin
  firma en macOS 26; corrección de Sentry con pnpm (`SENTRY_CLI_EXECUTABLE`). Detalle en `docs/ESTADO.md` 21-10.
- **Camino a tiendas con la cuenta de NEXARA (como ARTA):** `ios-testflight.yml` + `scripts/asc_signing.py` +
  `scripts/subir-secretos-ios.ps1`; `android-play.yml` + `apps/movil/plugins/con-firma-android.js` (9 pruebas) +
  `scripts/crear-llave-android.ps1` (llave ya creada en `%USERPROFILE%\Documents\LLAVES-ANDROID\FINANVOZ`, huella en
  ESTADO) + `scripts/subir-secretos-android.ps1` + `apps/movil/scripts/build-play-aab.ps1`; `app.config.ts` toma
  `APP_VERSION`/`APP_BUILD_NUMBER`; `app.json` con `ios.appleTeamId`, `ios.icon` sin alfa, `buildNumber` y
  `versionCode`; `docs/tienda/IOS-APP-STORE.md`, `PLAY-STORE.md`, `ios/*.txt` medidos por `tienda.test.ts`.
  **Ningún flujo de tienda ha corrido todavía en GitHub** (faltan secretos y las apps en las consolas).
- `apk.yml` gana el input `arquitecturas`; el APK x86_64 (corrida 39659887043) corre en el emulador `nexara_phone`
  (el de cada push es solo arm64 y se cierra al arrancar en x86).
- Verificado: lint, typecheck, vitest plugins 9/9 y tienda 21/21, jest seguridad 10/10 con el `app.json` nuevo.
- **O5 · Pagos fijos más completo** (pedido de Adam al verlo en el emulador): nombre editable, chip «Otro», cada
  mes/quincena/semana/año, «el monto cambia cada vez» para cualquier pago (gas entra al catálogo), «Más opciones»
  con cuenta de salida y «¿Cuántos pagos te faltan?» (→ `hasta`), «Quitar» (`quitarPagoFijo`) y «Al mes suman».
  Lógica pura en `pantallas/onboarding/pagos-fijos.ts` (10 pruebas Vitest), pantalla en
  `app/onboarding/pagos-fijos.tsx`, jest onboarding 11/11, `02 §3` O5 y ESTADO actualizados.

## A medias — CUIDADO

- **Un agente de Claude sigue trabajando (21-10, tarde):** amplía el
  nivel 0 del intérprete (`packages/nlu/src/reglas`, pruebas, `docs/06-NLU.md` §9, banderas `reglas` en
  `fixtures/nlu/golden.jsonl`, fila en ESTADO). **Si hay archivos sin commitear ahí, son suyos: `relevo.ps1 salvar`,
  revisar con `pnpm eval:nlu --nivel reglas` (debe seguir en precisión 100 %), vitest, typecheck y lint, y commitear.**
- **Observaciones en Hoy («Lo que veo»)** (pedido «haz más inteligente la app»): comparativa por categoría vs periodo
  anterior, gasto fuera de lo normal, posible cargo doble, ritmo del periodo y suscripciones del mes; máximo 2,
  «Ya lo vi» en `ajuste observaciones_vistas`, «Ver movimientos» con filtro. `servicios/observaciones.ts` (21 pruebas),
  `pantallas/principal/Observaciones.tsx`, textos con prueba de palabras prohibidas; jest Hoy 81/81, accesibilidad
  6/6, typecheck y lint en verde. `02 §4.3` nuevo y fila en ESTADO. Nunca consejos (`08 §1`).
- **Plan en iPhone sin tienda** (`PantallaPlan` con `Platform.OS === 'ios'`): sin ofertas ni «Restaurar compras» ni
  nombres de tiendas; jest 12/12. Resuelve el hallazgo 2.3.10 de la ficha de iOS.
- **Play Console: app «Finanvoz» creada el 21-10** (id 4974369200915032127, cuenta NEXARA, es-419) con el sí de Adam;
  sin AAB todavía. **App Store Connect**: Chrome sin sesión; Adam entra y luego se crea la app (`com.finanvoz.app`,
  SKU `FINANVOZ-IOS`).
- **Adam:** correr `pwsh -File scripts\subir-secretos-ios.ps1` y `pwsh -File scripts\subir-secretos-android.ps1`;
  respaldar la llave de subida fuera de la PC. Después: Actions → «iOS · TestFlight» y «Android · Play», y subir el
  AAB a prueba interna.
- Intérprete local (nivel 0): `pnpm eval:nlu --nivel reglas` cubre 25 de 155 casos del golden set con precisión
  100 %; el resto depende de la nube (sin Supabase ni llaves). Adam pidió «haz más inteligente la app»: propuesta
  pendiente de su elección (ver conversación / siguiente RELEVO).
- Build de iPhone: Ajustes → Plan dice «Administrar en Google Play» / «Restaurar compras» → ocultar en iOS antes de
  enviar a Apple (2.3.10). Es cambio de código pendiente.
- M0 / dominio `finanvoz.com` / aviso revisado por abogado: Adam (bloquean ficha pública y prueba externa, no la
  interna).

## Siguiente paso

1. APK x86_64 nuevo con el O5 (Actions → «APK Android» → `arquitecturas=x86_64`) y verlo en el emulador.
2. Adam — secretos + apps en consolas; primera corrida de TestFlight y de Play (prueba interna).
3. Adam — M0 antes del 6 nov; cuentas Expo/RevenueCat/PostHog; contador; abogado; pruebas en teléfono.

## No tocar

- Solo `main`; sin ramas/PR/reset duro sin Adam.
- `LEYENDA_ESTIMACION` (`08 §1`) literal.
- `packages/core` E*, vectores a mano.
- `PreviaWidget` / `widget.test` salvo pedido explícito.
- Credenciales: `C:\dev\secrets`, `Documents\LLAVES-ANDROID` (solo los scripts de Adam las leen).

## Estimación rápida

FinanVoz código ~94 %; camino tienda ~55 % (pipelines y fichas listos; faltan secretos, consolas, dominio, legal).
