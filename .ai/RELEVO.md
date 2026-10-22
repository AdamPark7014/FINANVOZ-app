# RELEVO

- **Último turno:** claude-code
- **Fecha:** 2026-10-22
- **Rama:** main

## Hecho en este turno

- **Tarjetas, tandas, compartido, arqueo, captura y estados de cuenta en iPhone (B-3)**: compra a meses sin tarjeta
  ofrece «Agregar tarjeta» (vuelve con la nueva elegida), errores del formulario de tarjeta junto al campo y al botón,
  «Registrar pago»/«Guardar saldo»/«Cancelar» en cada panel, confirmación en fila antes de quitar/anular, arqueo con
  «Cambiar» por paso y «Confirmar» (los chips solo eligen), compartido con `canGoBack`, «Abrir Ajustes» sin cámara y
  sin nube no ofrece crear/escanear, tandas con tarjeta tocable y chips de primera fecha, personas se desmarcan,
  captura y PDF con textos de iPhone (`PdfNoDisponible`), `avisos/anunciar.ts` = `useAnunciarEnIos` sobre `ui/`.
  Pruebas de tandas/tarjetas aceptan la segunda línea del aviso; CA-M4-04 adaptada a los chips de hora de B-2b.
  typecheck limpio, jest 24 suites 222/222 (compartido falla por tiempo solo bajo carga). Decisiones para ESTADO:
  cuenta dividida no repite persona por chip (solo dictado «×2»); «Volver» siempre sale en compartido; `TarjetaArqueo`
  de Hoy sigue guardando con un toque (`02 §7`) y `confirmarArqueo` no tiene Deshacer.
- **Intérprete de montos y lectores por paso (V-A)**: A0 («treinta y un mil»), A1 («8 mil 500»), A2 («85 pesos con 50
  centavos»), D1 (coma en el ciclo de tarjeta); `interpretarMonto` (`reglas/monto-dictado.ts`) exportado de
  `@cartera/nlu`; `packages/nlu/src/pasos/` (`interpretarPaso`: ingreso, efectivo, cuentas, tarjeta, pagos fijos,
  colchón, tanda; 20 instituciones con los ids de `captura.bancos.json`); golden V01–V09, `golden-pasos.jsonl` +
  `contexto-onboarding.json`, `pnpm eval:nlu --pasos` (87/87 cobertura, 88/88 precisión); nivel 0 aplica `configurar`
  desde Hoy, colchón/ingreso/saldo devuelven `confirmar_ajuste` (se guardan con `confirmarAjuste()`), compromisos sin
  artículo. vitest nlu 841/841, eval reglas 135/135, eslint limpio. **Pendiente**: `PanelRegistrar` no muestra
  `confirmar_ajuste` (sale del switch sin tarjeta); exportar `confirmarAjuste`/`PropuestaAjuste`/`AjusteGuardado` en
  `servicios/index.ts`; la conciliación de saldo duplica `corregirSaldoCuenta` de `cuentas-propias.ts` (B-2b).
- **Hoy y Movimientos para iPhone (B-1)**: mensaje honesto sin nube («Lo guardé en Por revisar…»), aviso con Deshacer
  sobre el área segura y el alto real de la barra, botones que tumbaban la app ahora atrapan el error, detalle con
  «Cerrar» y «Corregir» (formulario precargado → `aplicarCorreccion`), fecha Hoy · Ayer · Elegir (7 días, sin futuro),
  «Borrar» en pantalla, «Tu día pasa de $214 a $194» cuando cambia la cifra, candado y «¿Me alcanza?» ocultos si
  `abrirPlan` es null, vacío de Movimientos con «Registrar un movimiento», «Configurar mi ingreso», «Ajustes» desde
  Hoy, respuestas como chips, anuncios VoiceOver. jest principal 110/111 (la roja es `riesgo` por un id de Ajustes de
  B-2b). Rompe 2 aserciones de `tandas.test.tsx` (segunda línea del aviso): B-3 las ajusta.
- **Voz compartida y teclado de iPhone (V-B)**: `ProveedorDictado` único en `_layout.tsx` (un micrófono a la vez, ignora
  el «abortado/fin» del anterior), `useMicrofono`, `BotonMicrofono` (ícono 48 dp o pastilla «Dímelo»), motor falso
  compartido en `voz/__pruebas__`; `CampoMonto` con `dictable`/`admiteCero` (entendido, aproximado, $0, error, «Abrir
  Ajustes» si niegan permiso); `Pantalla`/`CampoTexto`: `KeyboardAvoidingView` en pies fijos, scroll que sigue al
  teclado, barra «Listo» sobre teclados numéricos; audio iOS `playAndRecord`+`defaultToSpeaker` y `decirEnVoz` con
  sesión propia; `ui/anunciar.ts` para VoiceOver. jest ui+voz 81/81, vitest 25/25. **Sin probar en iPhone real.**
- **Plus de prueba sin tienda (B-2a, decisión 1 del plan)**: `EXPO_PUBLIC_PLUS_SIN_TIENDA='1'` + sin tienda →
  `extra.plusSinTienda` (siempre booleano desde `app.config.ts`), `ProveedorPlan` lo marca en memoria (nada en la
  base), `suscripciones/build.ts` lo lee; pantalla Plan «Plus de prueba» sin tiendas, candado solo texto y `PuertaPlus`
  sin «Conocer Plus» cuando no hay tienda; «¿Me alcanza?» sin «14 días gratis» sin tienda; deducciones: importar y ver
  facturas para todos, puerta solo en la estimación. `ios-testflight.yml`, `android-play.yml` y `apk.yml` la encienden
  (quitarla antes de la tienda pública). vitest 30/30, jest plan/deducciones/me-alcanza 55/55, typecheck limpio.
- **Plan mega robusto** (`docs/PLAN-MEJORA-2026-10.md`): diagnóstico, Olas 1–7 y carril T con dueño por archivo, 6
  decisiones de Adam. **Flujos Maestro de iPhone** (`apps/movil/.maestro/ios`: 01–08 + `subflujos/`, ids en vez de
  textos, etiquetas `ios/recorrido/capturas/bug-conocido/voz`) y `ios-maestro.yml` (corre tras «iOS simulador» con el
  artifact, simulador es-MX, excluye `bug-conocido,voz`). `apps/movil/.gitignore` ya no ignora `.maestro/ios/`.

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

- **ORIGEN SE MOVIÓ (22-10, tarde): PR #24–#26 de un hilo de Claude en la nube** (`claude/project-thread-6edvv8`,
  fusionados por Adam 14:02–14:37) con el mismo plan (`docs/PLAN-UX-VOZ.md`): teclado iPhone, micrófono en cada
  `CampoMonto` (`ContextoDictadoCampos`), `reglas/campos.ts`, «O dímelo» en O3 y O5, textos por plataforma. Los
  commits locales 8fea7c8…c6770f9 **no están subidos**: se integran con `git merge origin/main` según
  `docs/PLAN-MEJORA-2026-10.md` §5 cuando B-2b y B-3 terminen. No hagas `pull --rebase` con el árbol sucio.
- **Ocho agentes en vuelo el 22-10 (tarde), nada commiteado de ellos**: V-A (`packages/nlu` montos y pasos), V-B
  (`src/voz`, `src/ui` teclado iOS), B-1 (`pantallas/principal`, movimientos), B-2a (plan, suscripciones,
  `ios-testflight.yml`), B-2b (cuentas, ajustes, privacidad), B-3 (tarjetas, tandas, compartido), T-1
  (`docs/tienda`, `scripts/tienda`, `apps/calculadora`, workflows nuevos de capturas), D-1
  (`docs/diseno/mockups-asistente.html`). Si entras y hay archivos sin commitear en esas rutas, son suyos: `salvar`,
  no pisar. El coordinador verifica (typecheck, lint, vitest, jest por carpeta, eval 100 %) y commitea por paquete.

- Verificación final del 21-10: typecheck, lint, eval nivel 0 (128/128, 100 %), vitest 2460/2461 y jest 505/506 → las dos
  fallas eran `rendimiento.test.ts` (RNF-01, tiempos de E8 en Node: ~109 ms contra el umbral de 100 con Ollama y
  otros procesos cargando la PC; el núcleo no cambió) y `personas.test.tsx` (ya corregida: el aviso usa la
  descripción). Al repetir `rendimiento.test.ts` solo pasó.
- **App Store Connect: app «Finanvoz» creada el 22-10** (Apple ID 6825850016, es-MX, SKU `FINANVOZ-IOS`, acceso
  ilimitado) y App ID `com.finanvoz.app` registrado con Push Notifications en el equipo AHNW9K8745. Falta llenar ficha,
  privacidad y revisión (§5–§7 de `docs/tienda/IOS-APP-STORE.md`).
- **Secretos cargados el 22-10 por Claude** (Adam pidió que corra yo los comandos): los 4 `ANDROID_*` y los 5 de iOS
  (certificado del equipo + llave PEM de `C:\dev\secrets\arta-ios`, llave ASC `H7VXTV487C`, Issuer ID).
- **TestFlight: build 1.0.0 (3) válida** (corrida 39821272914; vence 20-01-2027), grupo interno «Equipo Finanvoz
  (interno)» con Adam (ad.pozo.ont@icloud.com) **invitado** (agregado desde la consola: la API con la llave de Gestor
  de apps responde «Tester(s) cannot be assigned»). Las cargas (1) y (2) fallaron: manifiesto de privacidad y textos
  de permiso (ITMS-90683), ya corregidos y vigilados por el flujo.
- **Play: prueba interna publicada el 22-10** — versión 1 (1.0.0) «Disponible para testers internos», lista de testers
  «Equipo Finanvoz» (solo ad.pozo.ont@gmail.com), enlace https://play.google.com/apps/internaltest/4700319243165565858 .
  Los testers ven el nombre temporal «com.finanvoz.app (unreviewed)» hasta la primera revisión. El AAB vive en
  `C:\dev\builds\FINANVOZ\` y `Documents\FINANVOZ-builds\`. La siguiente subida a Play puede ir por API o a mano: la
  herramienta de Chrome no sube archivos de más de 10 MB. **Respaldar `Documents\LLAVES-ANDROID\FINANVOZ` fuera de la
  PC.**
- Las observaciones de Hoy y el O5 nuevo solo se han visto en pruebas y en el emulador (sin datos de varios días no
  salen observaciones). Falta verlas con un libro real en el teléfono de Adam.
- M0 / dominio `finanvoz.com` / aviso revisado por abogado: Adam (bloquean ficha pública y prueba externa, no la
  interna).

## Siguiente paso

1. Adam — instalar desde TestFlight (iPhone) y desde el enlace de prueba interna (Android) y probar en sus teléfonos;
   lo que encuentre se corrige y se sube como build 4 / código 2.
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

FinanVoz código ~95 %; camino tienda ~70 % (prueba interna publicada en Play y build válida en TestFlight; faltan fichas públicas,
dominio, legal).
