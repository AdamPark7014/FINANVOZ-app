# App Store Connect — Finanvoz (`com.finanvoz.app`)

Equipo de Apple: **NEXARA** (`AHNW9K8745`), el mismo de NEXARA y ARTA. Sin Mac: se compila, firma y sube desde
GitHub Actions (`.github/workflows/ios-testflight.yml`), copiado del esquema de `ARTA-app/docs/store/IOS-APP-STORE.md`.
Lee primero las reglas del texto y la tabla de privacidad de [`README.md`](README.md) y `docs/08-CUMPLIMIENTO.md`
§1, §3 y §4. Los textos que se pegan en la consola están en [`ios/`](ios/) y los mide `apps/movil/src/tienda.test.ts`.

**Estado al 21-10-2026.** En App Store Connect no hay nada todavía: la app no está creada (§2), los secretos no
están cargados (§3) y no hay ninguna build (§4). En el repositorio ya está todo lo que no depende de Adam: el
flujo «iOS · TestFlight», `scripts/asc_signing.py`, `scripts/subir-secretos-ios.ps1`, `app.json` con
`ios.bundleIdentifier com.finanvoz.app`, `appleTeamId AHNW9K8745`, `supportsTablet false`, `buildNumber 1`,
el ícono de App Store sin canal alfa (`apps/movil/assets/icono-ios.png`) y los cinco textos de `ios/`. Lo que
falta, y de quién es, está en §8.

## 0. Qué lleva la build de tienda (1.0.0)

Lo que se escribe en la consola tiene que describir **esta** build, no la especificación completa:

- **Sin cuenta ni inicio de sesión.** Todo corre en el iPhone, con la base cifrada (SQLCipher).
- **Modo nube apagado**: el flujo de TestFlight no recibe llaves de proveedores (`EXPO_PUBLIC_*` vacías →
  `leerConfigNube` → `null`), así que no hay Supabase ni proveedor de IA. El intérprete de voz y texto trabaja
  solo con las reglas locales (nivel 0) y lo que no entiende queda en «Por revisar». Tampoco hay Sentry ni
  PostHog mientras esas variables no entren al flujo.
- **Sin compras.** RevenueCat llega después; sin llave, `crearCompras` devuelve `null` y la app queda en Gratis.
  La pantalla Ajustes → Plan sigue existiendo: describe Plus y dice «Las suscripciones todavía no están
  disponibles en esta versión» (ver el pendiente de §8 sobre esa pantalla en iPhone).
- **Primera versión de iOS**: sin captura de notificaciones (es Android; en el recorrido inicial el paso dice
  «No disponible en este teléfono» y sigue), sin widget (`react-native-android-widget` no se enlaza en iOS) y
  sin estados de cuenta en PDF (M15, solo Android). Gastos compartidos (M16) necesita la nube, apagada aquí.
- **Solo iPhone** (`supportsTablet: false`): el flujo falla si el binario declara iPad. Capturas solo de iPhone (§7).
- Cifrado declarado exento (`ITSAppUsesNonExemptEncryption = NO` en `app.json`).

Si cambia cualquiera de estos puntos (nube, Plus, Sentry, PostHog), cambian en el mismo commit la descripción
(`ios/descripcion.txt`), las notas de revisión, la etiqueta de privacidad (§6) y `tienda.test.ts`.

## 1. Identificadores (los crea el flujo, o a mano)

`scripts/asc_signing.py` (lo corre «iOS · TestFlight» con la llave de App Store Connect) registra el bundle id
`com.finanvoz.app` si no existe, activa **Push Notifications** (la app solo usa avisos locales, pero el perfil
puede traer de más, nunca de menos), busca el certificado de distribución del equipo que llega por secreto,
rehace el perfil **«Finanvoz App Store»** (`IOS_APP_STORE`) y lo instala en el runner. Si prefieres hacerlo a
mano antes: developer.apple.com → Certificates, Identifiers & Profiles → Identifiers → «+» → App IDs → App →
`com.finanvoz.app` con **Push Notifications**. No hace falta ningún App ID adicional (sin extensiones).

## 2. Crear la app (a mano, una vez)

App Store Connect → Apps → «+» → **Nueva app**:

| Campo | Valor |
| --- | --- |
| Plataforma | iOS |
| Nombre | **Finanvoz** (si está tomado: «Finanvoz: gastos y tarjetas», el título de Play) |
| Idioma principal | Español (México) |
| Bundle ID | `com.finanvoz.app` (si aún no aparece en la lista, créalo como en §1 o corre una vez el flujo con `upload` desmarcado) |
| SKU | `FINANVOZ-IOS` |
| Acceso de usuarios | Acceso completo |

La app de NEXARA (`6814597698`) y la de ARTA (`6819117925`) viven en el mismo equipo: no tocarlas.

## 3. Secretos de GitHub (una vez)

**Cargados el 22-10-2026.** Para repetirlo:

```powershell
pwsh -File scripts\subir-secretos-ios.ps1 -IssuerId fe0d58b2-b9ab-4d7c-aecb-e8cbe30af200
```

Reusa el certificado de distribución del equipo (vence el 5-10-2027) y la llave de App Store Connect
`AuthKey_H7VXTV487C.p8` («GitHub Actions ARTA», rol Gestor de apps) de `C:\dev\secrets\arta-ios`: mismo equipo de
Apple. Carga en el repo `AdamPark7014/FINANVOZ-app` `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID`,
`APP_STORE_CONNECT_PRIVATE_KEY`, `CERTIFICATE_PRIVATE_KEY` (`arta_distribution.key`) y
`DISTRIBUTION_CERT_CER_BASE64` (`arta_distribution.cer.base64.txt`); antes comprueba que certificado y llave son
pareja. `C:\dev\secrets\nexara-ios` solo tiene otra llave y su CSR, sin certificado: no sirve. Necesita `gh`
autenticado; ningún valor se imprime. El repositorio es público: el flujo solo corre a mano y los secretos nunca
llegan a corridas de forks.

## 4. TestFlight

**Estado al 22-10-2026:** la build **1.0.0 (3)** está procesada y **válida** en TestFlight (vence el 20-01-2027;
cifrado declarado: no). Las cargas (1) y (2) fallaron: (1) en la validación del flujo, sin manifiesto de privacidad;
(2) rechazada por Apple con ITMS-90683, sin los textos de micrófono y galería. Grupo interno **«Equipo Finanvoz
(interno)»** creado por la API, con acceso a todas las builds. **Falta agregar a Adam como tester**: la API con la
llave de Gestor de apps responde «Tester(s) cannot be assigned», así que se hace en la consola (TestFlight → Equipo
Finanvoz (interno) → Testers → «+» → Adam Del Pozo Ontiveros, el mismo usuario que en el grupo de ARTA). Después llega la
invitación a la app TestFlight del iPhone.

GitHub → Actions → **iOS · TestFlight** → Run workflow (rama `main`):

| Input | Valor |
| --- | --- |
| `version` | Versión de App Store (`CFBundleShortVersionString`), p. ej. `1.0.0`. `app.json` sigue en `0.1.0` hasta cortar producción (pendiente 109); el flujo la pasa por `APP_VERSION` sin tocar el archivo |
| `build` | Número de build (`CFBundleVersion`). Vacío = número de corrida del flujo; siempre mayor que el anterior |
| `upload` | Marcado: sube a TestFlight. Desmarcado: solo archiva y firma; el IPA queda como artefacto `finanvoz-ipa` (14 días) |

Lo que el flujo comprueba antes de archivar (y por qué fallaría en el primer minuto): secretos presentes;
Xcode estable con **SDK de iOS 26 o mayor** (App Store Connect rechaza binarios con SDK anterior); ícono de
1024 **sin canal alfa** (ITMS-90717); `Info.plist` y `PrivacyInfo.xcprivacy` válidos (Expo lo genera en
`prebuild`); binario solo iPhone. Si falla, los logs quedan en el artefacto `ios-testflight-logs`. La build
aparece en App Store Connect → TestFlight unos 15 min después de «Subida entregada».

- **Prueba interna**: usuarios de App Store Connect del equipo (hasta 100), sin revisión. No necesita aviso de
  privacidad público ni ficha: es el camino para probar hoy.
- **Prueba externa** (probadores sin cuenta en ASC, enlace público): la primera build pasa por *Beta App
  Review* (~1 día) y **exige la URL pública del aviso de privacidad**, que todavía no existe (§8). Usa la misma
  información de revisión de §7; en TestFlight → «Información de prueba» va el mismo texto de
  `ios/notas-revision.txt` y «Se requiere iniciar sesión: No».

## 5. Información de la app

| Campo | Valor |
| --- | --- |
| Subtítulo (≤30) | `ios/subtitulo.txt`: `Cuánto puedes gastar hoy` (24) |
| Categoría principal | Finanzas |
| Categoría secundaria | Productividad |
| Derechos de contenido | No contiene contenido de terceros |
| URL del aviso de privacidad | **Pendiente**: `finanvoz.com/aviso-privacidad` (dominio y página son de la sentada 1 de `docs/LANZAMIENTO.md`; el texto es el de `src/pantallas/onboarding/aviso.ts`, sujeto a la revisión legal del pendiente 26). Sin ella no se puede enviar a revisión ni abrir la prueba externa; la prueba interna no la necesita |
| Copyright | `2026 NEW ENGINEERING EXPERTISE AND RESOURCE ADVANCEMENT S.A. DE C.V.` |
| Precio | Gratis (país base México) |
| Disponibilidad | Decisión de Adam: la app está en español de México y modela quincena, MSI y bancos mexicanos. Propuesta: solo México en la 1.0.0; abrir más países es un cambio de ficha, no de código |
| Clasificación por edad | Contestar el cuestionario con la verdad para una app de finanzas personales: **No/Ninguno** en todo (violencia, temas sexuales o desnudos, lenguaje, horror, drogas, alcohol o tabaco, apuestas simuladas o reales, concursos, información médica, acceso web sin restricciones, mensajes o chat entre usuarios, contenido generado por usuarios, anuncios, controles parentales, verificación de edad). No hay navegador dentro de la app: los enlaces (aviso, correo de ayuda) abren Safari o Mail. Resultado esperado: **4+** |
| Cifrado (exportación) | Ya declarado `ITSAppUsesNonExemptEncryption = NO` en `app.json`. La app usa HTTPS y cifrado estándar (AES-256 de SQLCipher y del respaldo `.cartera`), no algoritmos propietarios; si Apple pide detalle, esa es la respuesta |

## 6. Privacidad de la app («Etiqueta de privacidad»)

La etiqueta describe lo que **esta build** manda fuera del teléfono, con la tabla de `08 §3.2` y la de
[`README.md`](README.md) como fuente. Debe coincidir con `PrivacyInfo.xcprivacy` (Expo lo genera en `prebuild`
con las API de motivo obligatorio; hoy no declara tipos de datos recopilados, lo que es coherente con la fila
de abajo).

**Build 1.0.0 sin nube, sin Sentry y sin PostHog:** «¿Recopilas datos de esta app?» → **No**. Nada sale del
iPhone: los movimientos se guardan cifrados en el dispositivo, el respaldo `.cartera` lo exporta la persona a
donde quiera, y el reconocimiento de voz lo hace el sistema de Apple con su propio permiso (no es recopilación
nuestra). Rastreo: No.

**Qué cambia cuando se activen los servicios** (cada fila entra con su llave; todas con *rastreo: No* y
*propósito: Funcionalidad de la app*, salvo donde se indica):

| Servicio que se activa | Categoría → tipo de dato de Apple | Vinculado a la identidad |
| --- | --- | --- |
| Sentry (`EXPO_PUBLIC_SENTRY_DSN`) | Diagnóstico → Datos de fallos (sin montos, comercios, nombres ni texto dictado) | No |
| PostHog (`EXPO_PUBLIC_POSTHOG_KEY`, opt-in en O2 y en Ajustes › Privacidad) | Datos de uso → Interacción con el producto (propósito: Analítica) | No (ID anónimo) |
| Modo nube (Supabase + proveedor de IA) | Información financiera → Otros datos financieros (frases dictadas o escritas que el nivel 0 no entiende; procesadas al momento, no se guardan) · Identificadores → ID de usuario (sesión anónima para la cuota mensual) | Posición conservadora: Sí (ID anónimo); confirmarlo con el abogado (pendiente 103) |
| Respaldo en la nube (M9) | Información de contacto → Correo electrónico · Información financiera → Otros datos financieros (archivo cifrado de extremo a extremo que el servidor no puede abrir) | Sí |
| Modo explicar (Plus, M10) | Lo mismo que el modo nube, más resultados agregados (montos formateados y nombres cortos) | Sí |
| RevenueCat (Plus) | Compras → Historial de compras | Sí |
| Gastos compartidos (M16) | Información financiera → Otros datos financieros (eventos cifrados de extremo a extremo, solo con la otra persona del grupo) | Sí |

**Nunca** se recopila: ubicación, contactos, fotos o videos, datos de salud, historial de navegación o de
búsqueda, datos de audio (la voz no se graba ni se guarda; el sistema la convierte en texto), ni datos
sensibles. Al activar cualquier fila, además de la etiqueta cambian `ios/descripcion.txt` (sección «Tu
privacidad»), `ios/notas-revision.txt`, el centro de privacidad de la app y `PrivacyInfo.xcprivacy`
(`NSPrivacyCollectedDataTypes` vía `ios.privacyManifests` de `app.json`).

## 7. Versión 1.0.0

Los textos están en [`ios/`](ios/), uno por campo, sin el salto de línea final; `tienda.test.ts` los mide y les
aplica las mismas reglas que a los de Play (sin exclamaciones, emojis ni precios; sin «gratis», «mejor», «#1»,
«top», «nuevo» ni «oferta» en subtítulo y texto promocional; nada que suene a asesoría o promesa; texto fijo de
`08 §1`; marca Finanvoz) y dos propias de Apple: **no mencionar Android, Google Play ni widget** (directriz
2.3.10 y porque no van en iPhone) y no hablar de Plus, proveedor de IA ni compras mientras la build no los tenga.

| Campo | Archivo | Límite | Nota |
| --- | --- | --- | --- |
| Texto promocional | `ios/texto-promocional.txt` | 170 | Se puede cambiar sin nueva build |
| Descripción | `ios/descripcion.txt` | 4,000 | Parte de `descripcion-completa.txt` de Play, sin captura automática, widget, Plus ni proveedor de IA, y con «iPhone», Face ID y la respuesta en voz |
| Palabras clave | `ios/palabras-clave.txt` | 100 | Separadas por coma sin espacios; sin el nombre ni la categoría (Apple ya los indexa) |
| Novedades | — | 4,000 | Apple no lo exige en la primera versión. No reutilizar `notas-version-1.0.0.txt` de Play: menciona captura automática, widget y Plus |
| URL de soporte | — | obligatoria | **Pendiente**: página en `finanvoz.com` (sentada 1). Mientras no exista, la versión no se puede enviar a revisión. Dentro de la app, Ajustes › Ayuda ya tiene las 10 preguntas y `gerencia@nexara.com.mx` |
| URL de marketing | — | opcional | `finanvoz.com` cuando exista; no inventar otra |
| Aviso de privacidad | — | obligatoria | Ver §5 |

**Capturas**: solo iPhone, porque la app es solo iPhone. Obligatorias las de **6.9" (1320×2868)**; Apple las
escala a los tamaños menores. **Deben ser de iPhone**: NEXARA fue rechazada por subir capturas de Android, y las
de `capturas.md` (1080×1920) son de Android y no sirven aquí. No hay flujo de capturas (`ios-screenshots.yml`
con UITests como en NEXARA) y los escenarios semilla de `fixtures/escenarios` solo existen en builds de
desarrollo (`__DEV__`), no en la de TestFlight. Opciones, a decidir con Adam: (a) Mac con simulador iPhone 16
Pro Max y build de desarrollo (`expo run:ios`, escenario `e4-01` con `pnpm --filter movil semilla e4-01`), o
(b) iPhone físico con la build de TestFlight y datos capturados a mano siguiendo `capturas.md` (Hoy con el
desglose, registrar por voz, arqueo, tarjeta con meses, privacidad, tema oscuro; sin las de captura automática
ni «¿Me alcanza?», que no están en esta build). Sin marcos ni texto encima que prometa resultados.

**Información para la revisión**: «Se requiere iniciar sesión: **No**» (no hay cuenta). Contacto: Adam, los
mismos datos que NEXARA y ARTA en App Store Connect. Adjuntos: ninguno (Finanvoz es marca propia de NEXARA;
la búsqueda en IMPI es el pendiente 5). Notas: el texto de [`ios/notas-revision.txt`](ios/notas-revision.txt),
en inglés, que dice que no hace falta cuenta, cómo probar el dictado («Hablar» → «tacos ochenta en efectivo»,
o escribirlo), que no hay compras ni nube en esta build, qué permisos se piden y para qué, y que no es un
servicio financiero. Cuando se activen la nube o Plus, esas notas cambian (directriz 3.1.1 para suscripciones:
precio, periodo, prueba y forma de cancelar visibles antes de comprar).

## 8. Estado y pendientes

| # | Qué | Quién | Bloquea |
| --- | --- | --- | --- |
| 1 | ~~Crear la app en App Store Connect (§2)~~ **Hecha el 22-10-2026** con la cuenta NEXARA (Claude in Chrome, con el sí de Adam): App ID `com.finanvoz.app` registrado en Certificates, Identifiers & Profiles (equipo AHNW9K8745, Push Notifications activo) y app «Finanvoz» creada (Apple ID **6825850016**, iOS, Español (México), SKU `FINANVOZ-IOS`, acceso ilimitado). Falta llenar §5–§7 en la consola | — | — |
| 2 | Cargar los secretos con `scripts\subir-secretos-ios.ps1` (§3); confirmar que la llave de ASC tiene rol Admin | Adam (con `gh`) | §4 |
| 3 | Primera corrida de «iOS · TestFlight» con `upload` marcado y prueba interna en un iPhone del equipo | Adam lanza; Claude revisa la corrida | Capturas, prueba externa |
| 4 | Dominio `finanvoz.com` y páginas públicas: aviso de privacidad y soporte (sentada 1 de `LANZAMIENTO.md`, pendientes 12 y 26); revisión legal del aviso (pendientes 4, 26 y 103) | Adam + abogado | Prueba externa, envío a revisión y ficha pública. **No** bloquea la prueba interna |
| 5 | Capturas de iPhone 6.9" (§7) | Adam (+ Claude por Remote Control si hay Mac) | Envío a revisión |
| 6 | Información de la app, clasificación por edad, etiqueta de privacidad y textos de `ios/` capturados en la consola (§5–§7) | Adam | Envío a revisión |
| 7 | Disponibilidad por país (§5) | Adam | Envío a revisión |
| 8 | Ajustes → Plan en iPhone: la pantalla describe Plus y sus textos hablan de Google Play («Administrar en Google Play» (**resuelto el 21-10**: en iOS la pantalla Plan ya no ofrece compras ni nombra tiendas), «Restaurar compras»). Antes de enviar a revisión, decidir si se oculta en iOS o se cambian los textos (2.3.10 y 2.1); no es cambio de ficha, es de código | Adam decide; Claude Code | Envío a revisión |
| 9 | Cuando se activen Sentry, PostHog, nube, RevenueCat o respaldo en la nube: etiqueta (§6), descripción, notas y `tienda.test.ts` en el mismo commit | Claude Code + Adam | Cada activación |
| 10 | Marca «Finanvoz» en IMPI y en las tiendas (pendiente 5) | Adam | Riesgo de 5.2.1 si otro la tiene |
