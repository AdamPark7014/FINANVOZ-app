# Google Play — Finanvoz (`com.finanvoz.app`)

Cuenta de desarrollador: **NEXARA** (la misma de `mx.nexara.mobile.nativeapp` y de ARTA). Mismo esquema que
`ARTA-app/docs/store/PLAY-STORE.md` y `NEXARA-app/docs/PLAY-STORE-CHECKLIST.md`. Lee primero las reglas del texto
y la tabla de privacidad de [`README.md`](README.md) y `docs/08-CUMPLIMIENTO.md` §3 (divulgación destacada §3.1,
Data safety §3.2, declaraciones §3.3).

**Estado al 21-10-2026.** En Play Console no hay nada todavía: la app no está creada, no hay AAB subido y la
ficha, las capturas, el video, Data safety y la revisión legal siguen como pendientes de Adam (`docs/ESTADO.md`
→ Pendientes 24, 25, 101–104, 109, 111 y 112). En el repositorio están los textos de la ficha (`titulo.txt`,
`descripcion-corta.txt`, `descripcion-completa.txt`, `notas-version-1.0.0.txt`), el plan de capturas
(`capturas.md`), `app.json` con `android.package com.finanvoz.app` y `versionCode 1`, `app.config.ts` que toma
versión y build de `APP_VERSION` / `APP_BUILD_NUMBER`, el flujo «Android · Play» con sus scripts (§1) y
`apps/movil/eas.json` con el perfil `production` (app-bundle).

## 0. Qué lleva la build de tienda (1.0.0)

- **Sin cuenta ni inicio de sesión.** Todo corre en el teléfono, con la base cifrada (SQLCipher) y
  `allowBackup: false`.
- **Modo nube apagado** en estas primeras builds (sin `EXPO_PUBLIC_SUPABASE_*` ni proveedor de IA): el
  intérprete de voz y texto trabaja con las reglas locales (nivel 0) y lo que no entiende queda en «Por
  revisar». Sentry y PostHog solo si sus variables entran a la build; hoy no.
- **Sin compras.** RevenueCat llega después; sin llave, la app queda en Gratis y Ajustes → Plan dice «Las
  suscripciones todavía no están disponibles en esta versión».
- **Captura automática** de avisos bancarios: existe, pero solo si la persona activa el acceso a notificaciones
  desde la pantalla de divulgación destacada de `08 §3.1` (paso 6 del recorrido inicial o Ajustes → Captura
  automática). Las apps que no marque se descartan en código nativo sin guardarse.
- Widget «Hoy puedes», avisos locales de tarjetas, respaldo cifrado a archivo (el respaldo en la nube necesita
  la nube), estados de cuenta en PDF sin analizadores de bancos reales todavía (pendiente 122: la pantalla lo
  dice) y gastos compartidos (necesita la nube).
- Permisos del manifiesto: `RECORD_AUDIO`, `USE_BIOMETRIC`, `CAMERA`, `POST_NOTIFICATIONS` (expo-notifications),
  acceso a notificaciones (`BIND_NOTIFICATION_LISTENER_SERVICE` del módulo de captura). Bloqueados en `app.json`:
  `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `READ_MEDIA_IMAGES` (activaría la política de Fotos y
  Videos); verificar en el manifiesto final (pendiente 112).

Si cambia cualquiera de estos puntos, cambian en el mismo commit la ficha, Data safety (§5.7), el centro de
privacidad, el aviso y `tienda.test.ts`.

## 1. El paquete

- **Llave de subida**: `finanvoz-upload.jks` + `key.properties`, en `%USERPROFILE%\Documents\LLAVES-ANDROID\FINANVOZ`
  (fuera de git, como ARTA y NEXARA; `pnpm --filter movil secretos` revisa que nada entre al paquete). La crea
  **una sola vez** `pwsh -File scripts\crear-llave-android.ps1` (keytool del JDK 17, RSA 2048, alias
  `finanvoz-upload`, contraseña aleatoria que nunca se imprime; se niega a sobrescribir). **No regenerarla**:
  Play la registra como llave de subida en la primera subida; con la firma gestionada por Google, si se pierde
  o se filtra se pide en Play Console un cambio de llave de subida (la app no se pierde), pero mientras tanto no
  se puede publicar. Custodia: Adam, con una copia fuera de esta máquina.
- **Flujo «Android · Play»** (`.github/workflows/android-play.yml`, solo a mano): inputs `version`
  (versionName, forma MAYOR.MENOR.PARCHE) y `build` (`versionCode` entero; vacío = número de la corrida).
  Hace `expo prebuild` con el config plugin `apps/movil/plugins/con-firma-android.js` (firma `release` con la
  llave de subida) y `gradlew bundleRelease`; deja el artefacto **`finanvoz-aab`**. Secretos del repositorio
  `ANDROID_UPLOAD_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` y `ANDROID_KEY_PASSWORD`,
  que carga `pwsh -File scripts\subir-secretos-android.ps1` desde esa carpeta con `gh` (nada se imprime). Sin
  llaves de proveedores: modo nube apagado, como en `apk.yml`.
- **A mano, en esta PC**: `pwsh -File apps\movil\scripts\build-play-aab.ps1 -Version 1.0.0 -Build N` hace lo
  mismo con `key.properties` local, comprueba con keytool que el AAB va firmado con la llave de subida (no la
  de debug) y lo deja en `%USERPROFILE%\Documents\FINANVOZ-builds\finanvoz-<version>-<build>.aab`
  (`-WhatIf` solo muestra los pasos). Alternativa: `eas build -p android --profile production` con
  `apps/movil/eas.json` (sentada 2 de `LANZAMIENTO.md`).
- **`versionCode` creciente**: `app.json` trae `android.versionCode 1`; el flujo lo pasa por `APP_BUILD_NUMBER`
  (entero) sin commitear un número por subida. Play nunca acepta uno repetido ni menor. La versión (`APP_VERSION`)
  sube a `1.0.0` al cortar producción (pendiente 109); `app.json` sigue en `0.1.0` hasta entonces.
- `apk.yml` (**APK Android**, firmado con la llave de depuración) sirve para probar en el teléfono, **no** para Play.
- Antes de subir: descomprimir el AAB y correr `pnpm --filter movil secretos <carpeta>`; revisar permisos del
  manifiesto final; MASVS L1 repetido (pendiente 112).

## 2. Crear la app (a mano, una vez)

Play Console → **Crear app**:

| Campo | Valor |
| --- | --- |
| Nombre | **Finanvoz** (en la ficha se cambia por `titulo.txt`: «Finanvoz: gastos y tarjetas») |
| Idioma predeterminado | Español (México) – es-MX |
| App o juego | App |
| Gratis o pagada | Gratis (no se puede cambiar a pagada después; Plus sería suscripción dentro de la app) |
| Declaraciones | Políticas del programa para desarrolladores y leyes de exportación de EE. UU.: aceptar |

**Firma de apps de Google Play**: aceptar la firma gestionada por Google (la llave de subida es
`finanvoz-upload.jks`). Si el tablero de la cuenta pide la prueba cerrada previa (12 probadores durante 14 días,
regla para cuentas personales nuevas), hacerla en la pista cerrada antes de producción; con la cuenta de
organización de NEXARA no debería aparecer.

## 3. Prueba interna (lo primero)

Prueba y lanzamiento → **Prueba interna** → Crear versión → subir el `.aab` (artefacto `finanvoz-aab` o el de
`build-play-aab.ps1`) → notas «Primera versión» → Testers: lista de correos (hasta 100; Adam y probadores de la
sentada 7) → copiar el enlace de suscripción y mandarlo. La prueba interna no pasa revisión, no necesita la
ficha completa ni la política de privacidad publicada, y es donde se ensaya el despliegue escalonado
(detener y reanudar, CA-M13-03, pendiente 104). Con el AAB instalado desde Play: `adb backup` no trae la base,
permisos del manifiesto, `strings` sin secretos (pendiente 112).

## 4. Ficha de Play Store (para prueba cerrada o producción)

| Campo | Valor |
| --- | --- |
| Nombre de la app (≤30) | `titulo.txt` |
| Descripción breve (≤80) | `descripcion-corta.txt` |
| Descripción completa (≤4,000) | `descripcion-completa.txt` (ver la nota de abajo sobre Plus) |
| Novedades (≤500) | `notas-version-1.0.0.txt` |
| Ícono 512×512 | Pendiente: exportar desde `assets/marca` (PNG de 32 bits, sin transparencia en el fondo) |
| Gráfico de funciones 1024×500 | Pendiente, según `capturas.md` («Cuánto puedes gastar hoy», sin capturas encimadas ni precios) |
| Capturas de teléfono | 2 a 8, PNG 1080×1920, de un Android con los escenarios semilla (`capturas.md`, pendiente 102). Las de Plus («¿Me alcanza?») no van hasta que Plus esté activo |
| Video de la ficha | Opcional (YouTube); distinto del video de revisión de §5.9 |
| Categoría | Finanzas |
| Etiquetas | Finanzas personales, Presupuesto (las que ofrezca la consola) |
| Correo de contacto | **Pendiente de Adam** (el pendiente 101 propone `gerencia@nexara.com.mx`, el mismo del aviso y de Ajustes › Ayuda); Play lo muestra en la ficha |
| Sitio web | Pendiente: `finanvoz.com` (sentada 1) |
| Política de privacidad | Pendiente: `finanvoz.com/aviso-privacidad` (§5.1) |

**Sobre `descripcion-completa.txt` y `notas-version-1.0.0.txt`**: describen la app completa, con el párrafo
PLUS («Prueba gratis de 14 días. El cobro lo hace Google Play…») y la viñeta de Plus en las novedades. La build
1.0.0 no tiene compras: al subir la ficha, Adam decide si quita ese párrafo y esa viñeta hasta que RevenueCat
esté activo (Play puede objetar funciones anunciadas que no existen; `tienda.test.ts` no exige ese párrafo).
La sección «Tu privacidad» menciona al proveedor de inteligencia artificial y las estadísticas opcionales: son
ciertas para la app completa; con la nube apagada no sale nada, así que no contradicen a Data safety.

## 5. Contenido de la app (declaraciones obligatorias)

### 5.1 Política de privacidad
URL pública **pendiente** (`finanvoz.com/aviso-privacidad`, tercera entrada de Vite en `apps/calculadora` con
el texto de `src/pantallas/onboarding/aviso.ts`; sentada 0 y 1 de `LANZAMIENTO.md`, pendientes 12 y 26) y
revisión legal del aviso **pendiente** (abogado, pendientes 4, 26 y 103). Bloquea la ficha pública, la prueba
cerrada con ficha y producción; **no** bloquea la prueba interna. Dentro de la app ya se lee en O2 y en
Ajustes › Privacidad.

### 5.2 Anuncios
No contiene anuncios.

### 5.3 Acceso a la app
«**Toda la funcionalidad está disponible sin restricciones de acceso**»: no hay inicio de sesión ni cuenta.
La captura automática depende de un permiso del sistema que la persona activa desde la app; para que la
revisión la vea, el video de §5.9.

### 5.4 Clasificación de contenido (IARC)
Correo de contacto el de §4. Categoría: app (no juego), «Utilidad, productividad, comunicación u otros» si la
consola lo pide así. Violencia, sexo, lenguaje, drogas, apuestas, contenido descargado sujeto a clasificación,
ubicación compartida, recompensas, navegador: **No**. Usuarios interactúan o intercambian contenido: **No**
(gastos compartidos en pareja queda apagado con la nube; cuando se active, revisar la pregunta: solo entre dos
personas que se aceptan con un QR). Compras digitales: **No** en esta build (**Sí** cuando Plus esté activo;
rehacer el cuestionario). Resultado esperado: «Para todos» / 3+.

### 5.5 Público objetivo
**18 años o más**. No está dirigida a niños y no los atrae (finanzas personales).

### 5.6 Otras declaraciones
Noticias: no. Apps gubernamentales: **no**. Salud: no es app de salud (las deducciones de M12 leen CFDI de
gastos médicos, pero la app no trata datos de salud). COVID-19: no. Servicio en primer plano: no (la captura es
un servicio de escucha de notificaciones, no un servicio en primer plano; si el manifiesto final trajera
`FOREGROUND_SERVICE`, declararlo). Permisos con formulario propio (SMS, registro de llamadas, ubicación en
segundo plano, todos los archivos, accesibilidad): ninguno.

### 5.7 Seguridad de los datos (Data safety, `08 §3.2`)

Para la build 1.0.0 **sin nube, Sentry ni PostHog**: ¿Recopila o comparte datos? **Recopila: No · Comparte:
No**. Nada sale del teléfono: movimientos, saldos y cuentas se procesan en el dispositivo; el texto de las
notificaciones bancarias se procesa en el teléfono y no se envía; la voz la convierte en texto el reconocimiento
del sistema (no se graba ni se guarda audio); el respaldo `.cartera` lo exporta la persona a donde quiera; la
cámara solo lee un QR (sin fotos). Eliminación: la persona borra todo desde Ajustes › Privacidad («Borrar todos
mis datos») sin pedirlo a nadie.

Cuando se active cada servicio, entran estas filas (el formulario final es el pendiente 111 de Adam):

| Servicio | Tipo de dato | Recopilado | Compartido | Obligatorio | Propósito |
| --- | --- | --- | --- | --- | --- |
| Sentry | Información de la app y rendimiento → Registros de fallos (sin montos, comercios, nombres ni texto) | Sí | No (encargado) | Obligatorio | Analítica |
| PostHog (opt-in) | Actividad en la app → Interacciones en la app | Sí | No | Opcional | Analítica |
| Modo nube | Información financiera → Otra información financiera (frases que el nivel 0 no entiende; procesadas de forma efímera) · ID de usuario anónimo | Sí | No (encargados: Supabase y proveedor de IA) | Obligatorio para esa función | Funcionalidad de la app |
| Respaldo en la nube (M9) | Información personal → Correo electrónico · Información financiera → Otra información financiera (archivo cifrado de extremo a extremo; posición conservadora de `08 §3.2`) | Sí | No | Opcional | Funcionalidad de la app, administración de la cuenta |
| Modo explicar (Plus) | Lo mismo que el modo nube, más resultados agregados (pendiente 84 en el aviso; falta Data safety) | Sí | No | Opcional | Funcionalidad de la app |
| RevenueCat (Plus) | Compras → Historial de compras | Sí | No | Obligatorio para Plus | Funcionalidad de la app |
| Gastos compartidos (M16) | Información financiera → Otra información financiera (eventos cifrados de extremo a extremo, solo con la pareja) | Sí | No | Opcional | Funcionalidad de la app |

Cifrado en tránsito: Sí. Solicitud de eliminación: Sí (Borrar todo en la app, correo de contacto y, con
respaldo en la nube, «Borrar cuenta de respaldo» y una URL pública de eliminación de datos, pendiente en
`finanvoz.com`). Métodos de cuenta: «Mi aplicación no permite que los usuarios creen una cuenta» hasta M9 (la
cuenta de respaldo es correo + código). **Nunca** se recopila: ubicación, contactos, calendario, fotos o videos,
archivos de audio, salud, historial web, SMS ni registro de llamadas.

### 5.8 Declaración de funciones financieras (`08 §3.3`)
**Mi app ofrece funciones financieras** → gestión de finanzas personales: presupuesto y registro de gastos. Sin
préstamos ni crédito, sin banca ni cuentas, sin inversiones ni valores, sin pagos, transferencias ni billetera,
sin criptomonedas, sin seguros. La app no mueve dinero ni se conecta a cuentas con credenciales bancarias.
Captura de pantalla de respaldo si la consola la pide: Ajustes › Acerca de con el texto fijo de `08 §1`.

### 5.9 Divulgación destacada del acceso a notificaciones (`08 §3.1`, RF-PRI-02)
El acceso a notificaciones no tiene formulario propio en la consola, pero exige divulgación destacada dentro
de la app antes de abrir el ajuste del sistema y la política de privacidad publicada. La pantalla ya existe
(O6 y Ajustes → Captura automática, palabra por palabra `08 §3.1` con la marca Finanvoz): «Registrar tus compras
automáticamente … Solo leemos las apps que marques. Las demás notificaciones se ignoran en tu teléfono y no se
guardan. El contenido se procesa en tu teléfono y no se envía a nuestros servidores. Puedes desactivarlo cuando
quieras en Ajustes. [Activar] [Ahora no]». **Video pendiente 25** (Adam): desde Hoy hasta la captura de un
movimiento, en YouTube no listado; se pega en «Acceso a la app» o en las notas para la revisión cuando Play lo
pida. No es el mismo video de la ficha.

## 6. Eliminación de datos
Sin cuenta: la persona exporta (JSON, CSV o `.cartera`) y borra todo desde Ajustes › Privacidad; «Borrar todos
mis datos» pide escribir BORRAR y destruye la llave. Cuando exista el respaldo en la nube, Play pedirá además la
URL pública para pedir el borrado de la cuenta (pendiente en `finanvoz.com`, sentada 0 de `LANZAMIENTO.md`).

## 7. Orden
1. Llave de subida y secretos (§1) → 2. Crear la app (§2) → 3. Prueba interna con el AAB (§3) y las pruebas
del teléfono (pendientes 29, 110, 112) → 4. Ficha (§4) y contenido (§5) cuando existan la URL del aviso y la
revisión legal → 5. Prueba cerrada → 6. Producción escalonada (10 % → 100 %, pendientes 104 y 106).

## 8. Estado y pendientes

| # | Qué | Quién | Bloquea |
| --- | --- | --- | --- |
| 1 | Generar la llave de subida con `scripts\crear-llave-android.ps1` (una vez), guardar una copia fuera de la PC y cargar los secretos con `scripts\subir-secretos-android.ps1` | Adam (llave y custodia) | §1, §3 |
| 2 | Crear la app en Play Console (§2) | Adam | Todo lo demás |
| 3 | Primera subida a prueba interna y probadores (§3) | Adam | Pruebas en el teléfono, despliegue escalonado |
| 4 | Dominio y páginas públicas (`finanvoz.com`, aviso, eliminación de datos) y revisión legal del aviso (pendientes 4, 12, 26, 103) | Adam + abogado | Ficha pública, prueba cerrada y producción. **No** la prueba interna |
| 5 | Ficha: textos (§4, pendiente 101), correo de contacto, ícono 512, gráfico 1024×500, capturas (pendiente 102) | Adam (+ Claude por Remote Control para capturas) | Producción |
| 6 | Data safety (§5.7, pendientes 24 y 111) y declaración de funciones financieras (§5.8) | Adam | Producción |
| 7 | Video de la divulgación destacada (§5.9, pendiente 25) | Adam | Revisión de producción |
| 8 | Decidir si el párrafo PLUS y la viñeta de Plus salen de la ficha hasta que RevenueCat esté activo (§4) | Adam | Ficha |
| 9 | Versión 1.0.0 al cortar producción (pendiente 109); `versionCode` creciente por subida | Claude Code + Adam | Producción |
| 10 | Cuando se activen Sentry, PostHog, nube, RevenueCat, respaldo en la nube o gastos compartidos: Data safety, ficha, aviso, centro de privacidad y `tienda.test.ts` en el mismo commit | Claude Code + Adam | Cada activación |
