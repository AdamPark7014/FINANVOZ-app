# Seguridad de los datos (Data safety) — respuestas tal cual las pide Play Console

Play Console → Política → Contenido de la app → **Seguridad de los datos**. Fuente: `docs/08-CUMPLIMIENTO.md` §3.2
y `PLAY-STORE.md` §5.7. Las respuestas describen la **build 1.0.0 que sale de «Android · Play»**: sin
`EXPO_PUBLIC_SUPABASE_*`, sin proveedor de IA, sin Sentry ni PostHog y sin RevenueCat con llave. Nada sale del
teléfono. Si alguna de esas llaves entra a la build, el cuestionario se rehace con la tabla del final **en el mismo
commit** (`PLAY-STORE.md` §8, fila 10).

Comprobado en el APK de la corrida 39848463124 (`aapt dump permissions`): `INTERNET` (solo para la nube, apagada),
`RECORD_AUDIO`, `CAMERA`, `USE_BIOMETRIC`, `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`, `FOREGROUND_SERVICE`
(sin tipo), `com.android.vending.BILLING` (el SDK de RevenueCat viene en el paquete aunque no tenga llave) y
`com.google.android.c2dm.permission.RECEIVE` (expo-notifications). **No** trae `AD_ID`, ubicación, contactos,
almacenamiento, SMS ni registro de llamadas.

## 1. Descripción general

| Pregunta de la consola | Respuesta |
| --- | --- |
| ¿Tu app recopila o comparte alguno de los tipos de datos de usuario requeridos? | **No** |
| ¿Todos los datos de usuario que recopila tu app se encriptan en tránsito? | No aplica (no se recopilan). Si la consola la deja activa: **Sí** |
| ¿Tu app permite que los usuarios creen una cuenta? | **No** («Mi aplicación no permite que los usuarios creen una cuenta»). Cambia a Sí con el respaldo en la nube (M9: correo + código) |
| ¿Proporcionas una forma de que los usuarios soliciten que se borren sus datos? | **Sí**: dentro de la app, Ajustes › Privacidad › «Borrar todos mis datos» (confirmación escribiendo BORRAR), sin pedirlo a nadie; y por correo a `gerencia@nexara.com.mx`. Si la consola pide URL de solicitud de eliminación: `https://adampark7014.github.io/FINANVOZ-app/soporte.html` (pregunta «¿Cómo descargo o borro mis datos?») |
| ¿Tu app se sometió a una revisión de seguridad independiente? | **No** (opcional; MASVS L1 interno es el pendiente 112) |

Con «No» en la primera pregunta, Play muestra «No se recopilan datos» y no pide tipos de datos. Lo que **no** cuenta
como recopilación y por qué:

| Dato | Por qué no se declara |
| --- | --- |
| Movimientos, saldos, cuentas, tarjetas | Se procesan y guardan cifrados en el dispositivo (SQLCipher); Play exime lo que no sale del teléfono |
| Texto de las notificaciones bancarias (captura automática) | Se lee y procesa en el teléfono; no se transmite |
| Voz | La convierte en texto el reconocimiento del sistema; la app no graba ni guarda audio |
| Respaldo `.cartera` | Archivo cifrado que la persona exporta a donde quiera (Play exime la transferencia iniciada por el usuario a un destino que él elige) |
| Cámara | Solo lee un QR en el teléfono; no toma ni guarda fotos |
| Avisos locales de tarjetas | Programados en el teléfono; `c2dm.RECEIVE` viene con expo-notifications pero no hay servidor de push |

## 2. Prácticas de seguridad (si la consola las muestra)

| Pregunta | Respuesta |
| --- | --- |
| Los datos se encriptan en tránsito | Sí (HTTPS; hoy no hay tráfico) |
| Puedes solicitar que se borren los datos | Sí |
| Se compromete a seguir la Política de Familias de Play | No aplica (público 18+) |

## 3. Cuando se active cada servicio (rehacer el cuestionario con esto)

Tipos de datos de Play, en el orden del formulario. Todas las filas: *compartido: No* (los terceros actúan como
encargados), *procesamiento efímero* donde se indica.

| Servicio que se activa | Categoría → tipo de dato de Play | ¿Recopilado? | ¿Opcional? | Finalidad |
| --- | --- | --- | --- | --- |
| Sentry (`EXPO_PUBLIC_SENTRY_DSN`) | Información y rendimiento de la app → Registros de fallos (sin montos, comercios, nombres ni texto dictado) | Sí | Obligatorio | Estadísticas |
| PostHog (`EXPO_PUBLIC_POSTHOG_KEY`, opt-in en O2 y Ajustes › Privacidad) | Actividad en la app → Interacciones en la app | Sí | Opcional | Estadísticas |
| Modo nube (Supabase + proveedor de IA) | Información financiera → Otra información financiera (frases que el nivel 0 no entiende; procesamiento efímero) · ID de dispositivo u otros IDs → identificador anónimo de la app | Sí | Obligatorio para esa función | Funciones de la app |
| Modo explicar (Plus) | Lo mismo que el modo nube, más resultados agregados (montos formateados y nombres cortos; pendiente 84 en el aviso) | Sí | Opcional | Funciones de la app |
| Respaldo en la nube (M9) | Información personal → Dirección de correo electrónico · Información financiera → Otra información financiera (archivo cifrado de extremo a extremo; posición conservadora) | Sí | Opcional | Funciones de la app, administración de la cuenta |
| RevenueCat (Plus) | Información financiera → Historial de compras | Sí | Obligatorio para Plus | Funciones de la app |
| Gastos compartidos (M16) | Información financiera → Otra información financiera (eventos cifrados de extremo a extremo, solo con la otra persona del grupo) | Sí | Opcional | Funciones de la app |

Con cualquiera de esas filas: «¿Recopila?» pasa a **Sí**, encriptado en tránsito **Sí**, eliminación **Sí**, y con el
respaldo en la nube «permite crear cuenta» pasa a **Sí** con la URL pública de eliminación de la cuenta (pendiente en
`finanvoz.com`). **Nunca** se recopila: ubicación, contactos, calendario, fotos o videos, archivos de audio, salud y
estado físico, historial web, SMS ni registro de llamadas.
