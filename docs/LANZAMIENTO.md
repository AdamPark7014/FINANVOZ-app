# Lanzamiento — checklist por sentadas

> Ruta crítica: M0 antes del 6 de noviembre de 2026 (Buen Fin, 13 al 17 de noviembre). Cada fila se cierra con evidencia registrada en `docs/ESTADO.md`; este archivo agrupa el trabajo externo en sentadas y no sustituye el tablero ni los pendientes de ESTADO.
> Nunca pegues llaves, tokens ni la llave privada de plantillas en este archivo ni en el repositorio.

## Sentada 0 — Cambios de código previos (agentes)

| Tarea | Pasos | Depende de | Evidencia de cierre | Desbloquea | Pendientes |
|---|---|---|---|---|---|
| Respuesta OPTIONS de `lista-espera` sin cuerpo | `responder(204, null, origen)` en `_shared/lista-espera.ts` y prueba | — | **Hecho 2026-10-13**: `lista-espera.test.ts` → `responder` | **M0** | 11 |
| `services/proxy/supabase/config.toml` con `verify_jwt = false` solo en `lista-espera` y `webhooks-revenuecat` | Archivo versionado | — | **Hecho 2026-10-13** | M0, M7 | 11, 20 |
| Bloquear `android.permission.READ_MEDIA_IMAGES` (lo trae expo-screen-capture y activaría la política de Fotos y Videos de Play) | `blockedPermissions` en `apps/movil/app.json` | — | **Hecho 2026-10-13**; falta verlo en el manifiesto final (pendiente 112) | M7 | 112 |
| `.env.example` al día | Variables que el código lee hoy | — | **Hecho 2026-10-13** | — | — |
| `app.config.ts` que llene `extra` (`supabaseUrl`, `supabaseAnonKey`, `posthogHost`, `eas.projectId`) desde variables de EAS | Extender `app.json`; `app.json` sigue sin llaves (`masvs.test.ts`) | — | **Hecho 2026-10-17** (código): `apps/movil/app.config.ts` en `main`; falta build `preview` con nube activa (sentada 2) | M3, M7 | 14, 23, 29 |
| `eas.json` con perfiles `development`, `preview` y `production` (app-bundle, `autoIncrement`, `appVersionSource: remote`, `SENTRY_DISABLE_AUTO_UPLOAD` mientras no haya token) | Crear el archivo y documentar las variables por perfil | Cuenta de Expo (sentada 2) | **Hecho 2026-10-17** (código): `apps/movil/eas.json` en `main`; falta `eas init` y `eas build -p android --profile preview` (sentada 2) | M7 | 10, 28, 109 |
| Página web con el aviso de privacidad **de la app** y la URL para pedir el borrado de cuenta | Tercera entrada de Vite en `apps/calculadora` con el texto de `pantallas/onboarding/aviso.ts` | Revisión legal (sentada 5) | URL pública | M7 | 24, 26, 111 |

## Sentada 1 — Publicar M0 (infra externa)

Cierra los pendientes **11** (Supabase + `lista-espera`) y **12** (dominio, Pages, GitHub, primer despliegue). Nada de esto asume cuentas ya creadas: cada paso empieza en blanco hasta que lo marques tú.

### Hecho en el repositorio (no repetir en consola)

| Pieza | Dónde | Notas |
|---|---|---|
| Edge Function `lista-espera`, contrato y pruebas CA-M0-05 | `services/proxy/supabase/functions/` | OPTIONS 204 sin cuerpo; límite 5/h por IP en SQL |
| `verify_jwt = false` solo en `lista-espera` y `webhooks-revenuecat` | `services/proxy/supabase/config.toml` | El despliegue sigue usando la bandera del README |
| Migración de la lista | `services/proxy/supabase/migrations/20261012000000_lista_espera.sql` | `supabase db push` la aplica |
| Calculadora E10, lista de espera, aviso | `apps/calculadora/` | Montos no salen del navegador (CA-M0-07); `aviso-de-privacidad.html` |
| Responsable NEXARA en build | `apps/calculadora/src/responsable.json` | `VITE_RESPONSABLE_*` en GitHub es **opcional** |
| Bloqueo si falta URL o responsable | `apps/calculadora/scripts/verificar-publicacion.mjs` | Lo corre el workflow antes de `vite build` |
| Despliegue a Pages `finanvoz` | `.github/workflows/publicar-calculadora.yml` | Entorno GitHub **`produccion`**; manual (`workflow_dispatch`) |
| CSP en producción | `apps/calculadora/public/_headers` | `vite preview` local **no** aplica estos encabezados |
| Lighthouse móvil ≥ 90 en CI | `.github/workflows/ci.yml` | CA-M0-04 en código; el sitio publicado conviene revisarlo aparte |

### Checklist copy-paste (orden fijo)

Sustituye `<ref>` por el *Project ref* de Supabase (Settings → General). Guarda tokens y sales **fuera** del repositorio.

#### 1 · Supabase CLI (una vez por máquina)

Comandos literales de `services/proxy/README.md` → **M0 · lista-espera**:

```powershell
npm i -g supabase
```

#### 2 · Dominio en Cloudflare

- [ ] Registrar **`finanvoz.com`** en Cloudflare Registrar (cuenta Cloudflare).
- [ ] Evidencia en PowerShell: `Resolve-DnsName finanvoz.com -Type NS` → nameservers de Cloudflare.

#### 3 · Proyecto Supabase y función `lista-espera`

- [ ] Crear proyecto en [Supabase](https://supabase.com/dashboard) (región cercana a México).
- [ ] Enlazar, migraciones, secretos y despliegue (**mismos pasos 2–5 del README**):

```powershell
cd C:\dev\apps\FINANVOZ-app\services\proxy
supabase link --project-ref <ref>
supabase db push
```

Genera **64 caracteres aleatorios** para `LISTA_ESPERA_SAL` (nunca los commitees). Ejemplo en PowerShell:

```powershell
-join ((48..57 + 65..90 + 97..122 | Get-Random -Count 64 | ForEach-Object { [char]$_ }))
```

```powershell
supabase secrets set LISTA_ESPERA_SAL=<pega-los-64> CALCULADORA_ORIGEN=https://finanvoz.com
supabase functions deploy lista-espera --no-verify-jwt
```

- [ ] Anota la URL pública (paso 6 del README):

`https://<ref>.supabase.co/functions/v1/lista-espera` → la usarás en **`VITE_LISTA_ESPERA_URL`**.

- [ ] Preflight CORS (204, `access-control-allow-origin: https://finanvoz.com`):

```powershell
curl.exe -i -X OPTIONS "https://<ref>.supabase.co/functions/v1/lista-espera" `
  -H "Origin: https://finanvoz.com" `
  -H "Access-Control-Request-Method: POST"
```

#### 4 · Cloudflare Pages (proyecto `finanvoz`)

- [ ] Crear el proyecto Pages (rama de producción `main`):

```powershell
cd C:\dev\apps\FINANVOZ-app
npx wrangler pages project create finanvoz --production-branch=main
```

- [ ] En el panel: **Custom domains** → `finanvoz.com` y `www.finanvoz.com` → redirigir `www` al apex.
- [ ] **My Profile → API Tokens** → token con permiso **Account · Cloudflare Pages · Edit** (copiar token).
- [ ] Copiar **Account ID** (barra lateral del dashboard de Cloudflare).

#### 5 · GitHub — entorno `produccion`

Repositorio **FINANVOZ-app** → **Settings → Environments → produccion** (crear si no existe).

| Tipo | Nombre | Valor |
|---|---|---|
| Secret | `CLOUDFLARE_API_TOKEN` | token del paso 4 |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | Account ID del paso 4 |
| Variable | `VITE_LISTA_ESPERA_URL` | `https://<ref>.supabase.co/functions/v1/lista-espera` |

Opcional (si no las pones, el build usa `responsable.json`):

| Variable | Cuándo |
|---|---|
| `VITE_RESPONSABLE_NOMBRE` | Solo si quieres sobreescribir el JSON |
| `VITE_RESPONSABLE_DOMICILIO` | Ídem |
| `VITE_RESPONSABLE_CORREO` | Ídem |

#### 6 · Publicar la calculadora

- [ ] `main` con CI en verde (`pnpm lint`, typecheck, test, oráculo, Lighthouse).
- [ ] GitHub → **Actions** → **Publicar calculadora** → **Run workflow** (usa el entorno `produccion`).
- [ ] El job ejecuta (en este orden): `verificar-publicacion` → `build` → `wrangler pages deploy apps/calculadora/dist --project-name=finanvoz --branch=main`.
- [ ] Evidencia: `curl.exe -I https://finanvoz.com` → **200**.

#### 7 · Humo en producción (cierra M0 en ESTADO)

| # | Qué | Cómo | Esperado |
|---|---|---|---|
| 1 | Calculadora sin red | DevTools → Red; usar solo E10 | 0 peticiones al calcular |
| 2 | Alta válida | Formulario en `https://finanvoz.com` | Mensaje de éxito; en SQL `select * from lista_espera_resumen;` |
| 3 | Límite IP | 6 POST seguidos desde la misma IP (navegador o `curl`) | El 6.º → **429** |
| 4 | Sin consentimiento | POST sin `consentimiento: true` | **400** |
| 5 | CSP | Consola en el sitio publicado (no en `vite preview`) | Sin violaciones de CSP |
| 6 | Lighthouse móvil | Chrome DevTools o PageSpeed en la URL publicada | Rendimiento y accesibilidad ≥ 90 |
| 7 | Limpieza | Editor SQL Supabase | Borrar filas de prueba |

POST de ejemplo (sustituye correo si quieres; `version_aviso` debe coincidir con `apps/calculadora/src/config.ts`, hoy **`2026-10-m8`**):

```powershell
curl.exe -X POST "https://<ref>.supabase.co/functions/v1/lista-espera" `
  -H "Origin: https://finanvoz.com" `
  -H "Content-Type: application/json" `
  -d "{\"correo\":\"tu-correo@ejemplo.mx\",\"consentimiento\":true,\"version_aviso\":\"2026-10-m8\",\"sitio_web\":\"\",\"respuestas\":{\"telefono\":\"android\",\"notificaciones\":\"si\",\"precio\":\"50_99\",\"uso\":\"personal\"}}"
```

**Cierre:** registra URL y fecha en `docs/ESTADO.md` (CA-M0-05, CA-M0-06, CA-M0-07) → **M0** listo. Pendientes **11** y **12** pasan a hecho.

## Sentada 2 — Adam con cuentas: beta cerrada (M3 → M7)

| Tarea | Accesos y materiales | Pasos | Depende de | Evidencia de cierre | Pendientes |
|---|---|---|---|---|---|
| Cuentas de servicio | Correo de NEXARA y tarjeta | Expo/EAS, Google Play Console (**cuenta de organización** NEXARA con D-U-N-S y perfil de pagos; una cuenta personal nueva exige 12 probadores 14 días), RevenueCat, Sentry, PostHog y proveedores de IA | — | Accesos en el gestor de contraseñas | 10 |
| Intérprete en la nube | Supabase y llaves de IA | 1) Activar Anonymous sign-ins 2) `supabase secrets set NLU_PROVEEDORES=… ANTHROPIC_API_KEY=… OPENAI_API_KEY=… NLU_TOPE_GLOBAL_DIARIO=… NLU_SAL_USUARIO=<64>` 3) `supabase functions deploy nlu-interpretar` 4) `pnpm eval:nlu --nivel nube --proveedor X --grabar` con cada proveedor | Sentada 1 | Sin JWT → 401; grabaciones y decisión de modelo en ESTADO | 14 |
| Proveedores de IA sin retención | Consola de cada proveedor | Sin entrenamiento con datos y retención mínima o cero; Gemini solo en proyecto de pago | Cuentas | Nota por proveedor en ESTADO | 27 |
| EAS | Cuenta de Expo | 1) `eas init` 2) Variables por perfil: `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`, `EXPO_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_PLANTILLAS_LLAVES`, URL y llave anon de Supabase, `SENTRY_AUTH_TOKEN` 3) Respaldar la llave de subida fuera del repositorio | Sentada 0 (`eas.json`, `app.config.ts`) | `eas build -p android --profile production` produce un `.aab` | 10, 28 |
| Play Console | Cuenta de organización | 1) App "Finanvoz" `com.finanvoz.app` con Play App Signing 2) **Subir a mano** el primer `.aab` a prueba interna 3) Cuenta de servicio para EAS Submit (fuera del repositorio) 4) Clasificación de contenido, público 18+, sin anuncios 5) Data safety (`08 §3.2` más PostHog, consentimiento y URL de borrado) 6) Declaración de funciones financieras (`08 §3.3`) 7) URL del aviso de la app | EAS y página del aviso (sentada 0) | Prueba interna publicada; formularios completos | 24, 28 |
| Video de la divulgación destacada | Teléfono con build de beta | Desde Hoy hasta la captura de un movimiento (`08 §3.1`) | Build de beta | Video subido a Play | 25 |
| RevenueCat y webhook | RevenueCat, Play y Supabase | 1) Suscripciones de $69 al mes y $599 al año con 14 días gratis 2) Derecho `plus` con `$rc_monthly` y `$rc_annual` 3) `supabase secrets set REVENUECAT_WEBHOOK_SECRET=<64>` 4) `supabase functions deploy webhooks-revenuecat` 5) Webhook con `Authorization: Bearer <secreto>` | Play y Supabase | "Send test event" responde 200 | 20 |
| PostHog | PostHog | Proyecto con "Discard client IP data"; llave `phc_` en EAS; host de la UE solo vía `app.config` | Sentada 0 | Evento de prueba recibido | 23 |
| Pista cerrada | Play | Lista de probadores y `eas submit -p android --profile production` | Todo lo anterior y sentada 5 | 30–50 probadores con opt-in → **CA-M7-06** | 28 |
| Búsqueda de marca | IMPI y tiendas | Clases 9 y 36; Play y App Store | — | Resultado en ESTADO | 5 |

## Sentada 3 — Adam con cuentas: servicios de M9, M10 y M16

| Tarea | Pasos | Depende de | Evidencia de cierre | Pendientes |
|---|---|---|---|---|
| Respaldo | `supabase functions deploy respaldo`; humo (anónimo → 403 `sin_correo`) | Migraciones aplicadas | `curl` documentado | 52 |
| Correo de Auth | Email con "Confirm email", OTP de 6 dígitos y 600 s, plantillas con `{{ .Token }}`, SMTP propio con SPF y DKIM en `finanvoz.com` | Dominio | Correo con código recibido | 53 |
| CA-M9-05 y 07 contra el proyecto real | Dos emuladores (`services/proxy/README.md` → M9) | 52, 53 | Resultado en ESTADO | 55 |
| Llave de plantillas | Par Ed25519 fuera del repositorio; pública en `EXPO_PUBLIC_PLANTILLAS_LLAVES=prod-2026:<hex>` en EAS (producción) | — | Llave pública anotada en ESTADO | 8, 70, 71 |
| Primera publicación de plantillas | Firmar `plantillas.json` (versión ≥ 2) y subirlo con su `.sig` al bucket `plantillas` | 70, 71 | El SHA-256 coincide con el del script | 72 |
| Modo explicar | `supabase functions deploy llm-turno`; humo (Gratis → 403, Plus → 200) | 14 | `curl` documentado | 83 |
| Gastos compartidos | `supabase functions deploy compartido`; humo; `eventos_compartidos` solo guarda blobs | — | Consulta de CA-M16-04 | 142 |
| Data safety con compartidos | Filas de `08 §3.2` y el permiso `CAMERA` | 143 | Formulario actualizado | 144 |

## Sentada 4 — Adam con su teléfono Android (con Claude por Remote Control)

| Tarea | Pasos | Depende de | Evidencia de cierre | Pendientes |
|---|---|---|---|---|
| Base, onboarding y avisos | Cronometrar el onboarding (`maestro test apps/movil/.maestro/onboarding.yaml`; ver `docs/maestro.md`), flujos CA-M2-02 y arqueo básico en el mismo build, abrir la base sin llave (debe fallar), biometría, multitarea, arranque y E4 | — | Mediciones en ESTADO | 13 |
| Captura | Activar en O6, `publicar-ejemplos.mjs`, app no autorizada, supervivencia del servicio | 13 | CA-M5-01, 02 y 08 | 15 |
| Simulador | E8 con K = 1 y N = 10,000 < 150 ms | 13 | Mediciones en ESTADO | 18 |
| Beta en el teléfono | Fila de consentimiento en Supabase, TalkBack y texto al 200 %, exportar y borrar, `adb backup`, secretos sobre el APK | Sentada 2 | CA-M7-05 | 22, 29 |
| Compra real | Comprar Plus con licencia de prueba → `derechos.plan = 'plus'`; cancelar → Gratis al vencer | 20, 28 | CA-M7-01 | 21 |
| Respaldo y criptografía | Build con quick-crypto, vectores `E16.kdf`, scrypt < 3 s, ida y vuelta < 30 s, tarea semanal con el teléfono bloqueado | — | CA-M9-01, 03 y 04 | 44–46, 59, 60 |
| Widget, plantillas y modo explicar | Widget 2×1, plantillas con la llave de prueba, Q13 por voz con Plus | — | CA-M10-03 a 06 | 73, 76, 77, 86 |
| Deducciones y estados de cuenta | Compartir XML, ZIP y PDF desde Gmail, Drive y Archivos; PDF con AES | — | CA-M12-02, CA-M15-* | 96, 97, 120, 121, 126, 127 |
| Gastos compartidos | Dos teléfonos con cámara: QR, E12-20, salir y volver a vincular | 142 | CA-M16-03, 05 y 06 | 140, 141 |
| Mediciones, accesibilidad y MASVS sobre la build firmada | RNF-01 y RNF-11, TalkBack en todo, permisos del manifiesto final | Build de producción | Mediciones y checklist en ESTADO | 107, 110, 112 |

## Sentada 5 — Abogado

| Tarea | Materiales | Depende de | Evidencia de cierre | Pendientes |
|---|---|---|---|---|
| Aviso de la lista de espera (responsable, encargados como Cloudflare, baja) | `Aviso.tsx` y URL publicada | M0 publicado | Visto bueno por escrito | 4 |
| Aviso de la app, consentimiento y términos `2026-10-m7` | `pantallas/onboarding/aviso.ts`, `privacidad/legales.ts` | — | Visto bueno; `VERSION_CONSENTIMIENTO` decidida | 4, 26 |
| Respaldo, correo y restaurar antes de O2 | `08 §2.2` | 26 | Visto bueno | 54, 61 |
| Modo explicar (salen resultados agregados al proveedor) | `08 §2`, Data safety | 26 | Visto bueno | 84 |
| Revisión final, PDF y compartidos | Ficha, Ayuda, `08 §7.2` | Las anteriores | Visto bueno | 103, 125, 143 |

## Sentada 6 — Contador público

| Tarea | Materiales | Evidencia de cierre | Desbloquea | Pendientes |
|---|---|---|---|---|
| Validar `config/fiscal/2026.json`: tarifa anual del art. 152 LISR, deducciones D01–D10, UMA, RESICO y día de pago | Archivo, LISR, INEGI | Nombre, cédula, fecha y SHA-256 en Decisiones; `estado: "validado"` | M12; **bloquea M13** | 6, 90–93 |

## Sentada 7 — Probadores

| Tarea | Depende de | Evidencia de cierre | Pendientes |
|---|---|---|---|
| Unirse a la pista cerrada y usar la app dos semanas | 28 | 30–50 activos | 28 |
| Notificaciones bancarias reales anonimizadas por banco | Beta | Plantillas reales | 3 |
| Estados de cuenta reales anonimizados por banco (fuera del repositorio) | Beta | Analizadores en `reales.json` | 122 |
| Primera cuota de MSI por banco | Beta | Nota en ESTADO | 2 |
| Dudas frecuentes | Beta | `preguntas.ts` actualizado | 108 |

## Sentada 8 — Adam con cuentas: lanzamiento público (M13)

| Tarea | Pasos | Depende de | Evidencia de cierre | Pendientes |
|---|---|---|---|---|
| Ficha de Play | `docs/tienda`: título, descripciones, categoría Finanzas, correo, URL del aviso | 103 | Ficha guardada | 101 |
| Capturas, gráfico y video | `docs/tienda/capturas.md` con escenarios semilla | — | 8 PNG, gráfico y video | 102 |
| Versión 1.0.0 | `app.json` y `package.json`; versionCode remoto en EAS | Sentada 0 | Build de producción | 109 |
| Data safety final | Respaldo, correo, widget, modo explicar y borrado | 54, 84 | Formulario actualizado | 111 |
| Despliegue escalonado | Interna → detener → reanudar → 10 % → 100 %; sesiones sin fallo ≥ 99.5 % | Todo lo anterior | Proceso registrado en ESTADO → **cierra M13** | 104, 106 |
| Tablero y buzón | Métricas de `01 §10`; quién atiende `gerencia@nexara.com.mx` y respuesta tipo ARCO | 23 | Tablero con datos reales; procedimiento escrito | 105, 114 |
