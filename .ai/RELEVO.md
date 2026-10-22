# RELEVO

- **Último turno:** claude-code
- **Fecha:** 2026-10-22
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
  **Ningún flujo de tienda ha corrido todavía en GitHub** (faltan secretos y la app en App Store Connect).
- **Play Console: app «Finanvoz» creada** (id 4974369200915032127, cuenta NEXARA, es-419) con el sí de Adam; sin AAB.
- `apk.yml` gana el input `arquitecturas`; los APK x86_64 corren en el emulador `nexara_phone` (el de cada push es
  solo arm64 y se cierra al arrancar en x86).
- **O5 · Pagos fijos más completo**: nombre editable, chip «Otro», cada mes/quincena/semana/año, «el monto cambia
  cada vez» (gas entra al catálogo), «Más opciones» con cuenta de salida y «¿Cuántos pagos te faltan?» (→ `hasta`),
  «Quitar» y «Al mes suman». `pantallas/onboarding/pagos-fijos.ts` (10 pruebas), jest onboarding 11/11, `02 §3` O5.
- **Plan en iPhone sin tienda** (`PantallaPlan` con `Platform.OS === 'ios'`): sin ofertas ni «Restaurar compras» ni
  nombres de tiendas; jest 12/12. Resuelve el hallazgo 2.3.10 de la ficha de iOS.
- **Observaciones en Hoy («Lo que veo»)** (pedido «haz más inteligente la app»): comparativa por categoría vs periodo
  anterior, gasto fuera de lo normal, posible cargo doble, ritmo del periodo y suscripciones del mes; máximo 2,
  «Ya lo vi» en `ajuste observaciones_vistas`, «Ver movimientos» con filtro. `servicios/observaciones.ts` (21 pruebas),
  `pantallas/principal/Observaciones.tsx`, textos con prueba de palabras prohibidas; jest Hoy 81/81. `02 §4.3` nuevo.
  Nunca consejos (`08 §1`).
- **Intérprete local (nivel 0) ampliado: de 27 a 128 de 155 frases del golden set, precisión 100 %** (663 pruebas en
  `packages/nlu`); `06 §9` reescrito (9.1 piezas, 9.2 producciones, 9.3 lo que sigue en `null`); 103 casos pasan a
  `reglas: true` (solo la bandera). `nivelCero` (`servicios/registrar.ts`) aplica la misma puerta Plus que la nube a
  las consultas. Las pruebas de la app que necesitan una frase «de nube» usan «unas chelas de 80 con la Nu y una coca
  de 25 en efectivo» (sin verbo y con palabra fuera del diccionario: el nivel 0 la deja a la nube); Q11 («esta
  quincena») sigue en la nube.

## A medias — CUIDADO

- Verificación final del 21-10: typecheck, lint, eval nivel 0 (128/128, 100 %), vitest 2460/2461 y jest 505/506 → las dos
  fallas eran `rendimiento.test.ts` (RNF-01, tiempos de E8 en Node: ~109 ms contra el umbral de 100 con Ollama y
  otros procesos cargando la PC; el núcleo no cambió) y `personas.test.tsx` (ya corregida: el aviso usa la
  descripción). Al repetir `rendimiento.test.ts` solo pasó.
- **App Store Connect: app «Finanvoz» creada el 22-10** (Apple ID 6825850016, es-MX, SKU `FINANVOZ-IOS`, acceso
  ilimitado) y App ID `com.finanvoz.app` registrado con Push Notifications en el equipo AHNW9K8745. Falta llenar ficha,
  privacidad y revisión (§5–§7 de `docs/tienda/IOS-APP-STORE.md`).
- **Secretos cargados el 22-10 por Claude** (Adam pidió que corra yo los comandos): los 4 `ANDROID_*` y los 5 de iOS
  (certificado del equipo + llave PEM de `C:\dev\secrets\arta-ios`, llave ASC `H7VXTV487C`, Issuer ID).
- **TestFlight: build 1.0.0 (3) válida** (corrida 39821272914; vence 20-01-2027). Grupo interno «Equipo Finanvoz
  (interno)» creado por la API; **falta agregar a Adam como tester en la consola** (la API responde «Tester(s) cannot
  be assigned»). Las cargas (1) y (2) fallaron: manifiesto de privacidad y textos de permiso (ITMS-90683), ya
  corregidos y vigilados por el flujo.
- **Play: AAB 1.0.0 (código 1) firmado** (corrida 39812387570), copiado a `C:\dev\builds\FINANVOZ\finanvoz-1.0.0-1.aab`
  y `Documents\FINANVOZ-builds\`. **Falta que Adam lo arrastre** a la versión de prueba interna en borrador de Play
  Console (la herramienta del navegador solo sube archivos de hasta 10 MB y Play exige la primera subida a mano);
  luego se llena nombre, notas y testers y se publica en prueba interna. Respaldar `Documents\LLAVES-ANDROID\FINANVOZ`
  fuera de la PC.
- Las observaciones de Hoy y el O5 nuevo solo se han visto en pruebas y en el emulador (sin datos de varios días no
  salen observaciones). Falta verlas con un libro real en el teléfono de Adam.
- M0 / dominio `finanvoz.com` / aviso revisado por abogado: Adam (bloquean ficha pública y prueba externa, no la
  interna).

## Siguiente paso

1. Adam — arrastrar el AAB a Play Console y agregarse como tester en el grupo interno de TestFlight; Claude termina la
   versión de prueba interna en Play (nombre, notas, testers, publicar).
2. Adam — M0 antes del 6 nov; cuentas Expo/RevenueCat/PostHog; contador; abogado; pruebas en teléfono.
3. Código: los 27 casos del golden set que siguen en `null` (`06 §9.3`) se quedan así a propósito; si Adam quiere
   más cobertura sin nube, conviene crecer el golden set con frases reales antes de inventar reglas.

## No tocar

- Solo `main`; sin ramas/PR/reset duro sin Adam.
- `LEYENDA_ESTIMACION` (`08 §1`) literal.
- `packages/core` E*, vectores a mano.
- `PreviaWidget` / `widget.test` salvo pedido explícito.
- Credenciales: `C:\dev\secrets`, `Documents\LLAVES-ANDROID` (solo los scripts de Adam las leen).

## Estimación rápida

FinanVoz código ~95 %; camino tienda ~60 % (pipelines, fichas y apps creadas en Play y App Store Connect; faltan secretos,
dominio, legal).
