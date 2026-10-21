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

## A medias — CUIDADO

- **O5 · Pagos fijos: personalización del formulario** (pedido de Adam 21-10): nombre propio editable, chip
  «Otro», frecuencia (mes/quincena/semana/año), «cambia cada vez» para cualquier pago, cuenta de salida, fin por
  número de pagos, quitar de la lista y total mensual. Si ves cambios sin commitear en
  `apps/movil/app/onboarding/pagos-fijos.tsx`, `src/pantallas/onboarding/pagos-fijos.ts`, `textos.ts`,
  `servicios/onboarding.ts` o `docs/02-UX.md` §3, son de ese trabajo: `relevo.ps1 salvar`, no pisar.
- **Adam:** correr `pwsh -File scripts\subir-secretos-ios.ps1` y `pwsh -File scripts\subir-secretos-android.ps1`;
  crear «Finanvoz» en App Store Connect (`com.finanvoz.app`, SKU `FINANVOZ-IOS`) y en Play Console; respaldar la
  llave de subida fuera de la PC. Después: Actions → «iOS · TestFlight» y «Android · Play».
- Build de iPhone: Ajustes → Plan dice «Administrar en Google Play» / «Restaurar compras» → ocultar en iOS antes de
  enviar a Apple (2.3.10). Es cambio de código pendiente.
- M0 / dominio `finanvoz.com` / aviso revisado por abogado: Adam (bloquean ficha pública y prueba externa, no la
  interna).

## Siguiente paso

1. Terminar O5 (arriba), APK x86_64 nuevo y verlo en el emulador; commit con pruebas.
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
