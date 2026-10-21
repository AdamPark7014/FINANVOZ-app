# RELEVO

- **Último turno:** claude-code
- **Fecha:** 2026-10-21
- **Rama:** main

## Hecho en este turno

- **Constructores de Mac en GitHub (`.github/workflows/ios.yml`):** Adam hizo público el repositorio para que
  los corredores macOS no cuesten. `macos-latest` (macOS 26 arm64, Xcode 26) hace `expo prebuild --platform ios`,
  `pod install` (caché de Pods por `pnpm-lock.yaml` + `app.json`) y compila Release para el simulador sin firma;
  sube `finanvoz-ios-simulador.zip` y, si falla, `xcodebuild.log`. Se dispara a mano y en cada push a `main`
  (ignora `docs/**` y `*.md`), igual que `apk.yml`.
- `apps/movil/app.json`: sección `ios` (`bundleIdentifier com.finanvoz.app`, `supportsTablet: false`,
  `ITSAppUsesNonExemptEncryption: false`). Sin ella prebuild se detiene a preguntar. MASVS sigue en verde.
- `eslint.config.js` ignora `.ai/**`: `pnpm lint` en la raíz vuelve a pasar con borradores de Ollama presentes.
- Decisión anotada en `docs/ESTADO.md` (fila 2026-10-21, M14).
- Verificado en local tras `pnpm install --frozen-lockfile` (faltaba `expo-speech`, agregado por 9b36513 sin
  reinstalar): typecheck en verde, jest 499/499, `expo export --platform ios` genera el bundle (2687 módulos),
  lint en verde. Vitest: la corrida completa en paralelo con jest tumbó 13 archivos por timeouts de PGlite y de
  rendimiento; repetidos solos → ver línea de abajo.
- Vitest (13 archivos repetidos solos): 13/13 archivos, 77/77 pruebas en 17 s. No hay nada roto en `main`.

## A medias — CUIDADO

- Corrida 1 del workflow iOS (39636154250, 36 min): prebuild, `pod install`, compilación nativa y bundle de Metro
  **pasaron** en Xcode 26 con `node_modules` de pnpm. Falló solo la fase «Upload Debug Symbols to Sentry»:
  `sentry-xcode-debug-files.sh` resuelve `@sentry/cli` con `set -e` antes de mirar `SENTRY_DISABLE_AUTO_UPLOAD`, y
  con pnpm ese paquete no está en `node_modules/@sentry/cli`. Arreglo: paso que exporta `SENTRY_CLI_EXECUTABLE`
  resuelto vía `@sentry/react-native` (ambos scripts se saltan la búsqueda si viene puesto). Corrida 2 pendiente de
  verificar; si vuelve a fallar, el registro completo queda en el artefacto `xcodebuild-log`.
- El `.app` del simulador no sirve para un iPhone físico: eso exige cuenta de Apple (M14, Adam).
- M0 / EAS: Adam.

## Siguiente paso

1. Revisar la corrida «iOS simulador» en Actions; corregir el workflow si algo no compila en Xcode 26.
2. Adam — M0 (pendientes 11 y 12: Supabase + `finanvoz.com`), antes del 6 nov.
3. Adam — cuentas Expo/Play/RevenueCat/PostHog, contador (`config/fiscal/2026.json`), abogado, pruebas en teléfono.
4. Código que queda: plantillas y analizadores PDF con datos reales de probadores; iPhone (v2, ya con builder).

## No tocar

- Solo `main`; sin ramas/PR/reset duro sin Adam.
- `LEYENDA_ESTIMACION` (`08 §1`) literal.
- `packages/core` E*, vectores a mano.
- `PreviaWidget` / `widget.test` salvo pedido explícito.

## Estimación rápida

FinanVoz código ~94 %; camino tienda ~36 %. Detalle: `docs/PROGRESO-70.md`.
