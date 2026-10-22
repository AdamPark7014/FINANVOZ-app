# Contenido de la app — declaraciones de Play Console (`PLAY-STORE.md` §5)

Play Console → Política → **Contenido de la app**. Cada bloque, con la respuesta que se marca. Fuente:
`docs/08-CUMPLIMIENTO.md` §3 y `PLAY-STORE.md` §5. Describe la build 1.0.0 (sin nube, sin compras, sin Sentry ni
PostHog); lo que cambia al activar servicios está al final.

## Política de privacidad

URL: `https://adampark7014.github.io/FINANVOZ-app/aviso-de-privacidad.html` (GitHub Pages del repositorio
público, provisional hasta `finanvoz.com/aviso-privacidad`; el texto es el de `apps/calculadora/src/aviso-app.ts`,
alineado con `apps/movil/src/pantallas/onboarding/aviso.ts`, versión `2026-10-m8`). La revisión legal del aviso
sigue siendo de Adam y el abogado (pendientes 4, 26 y 103); la URL no la bloquea.

## Anuncios

**No, mi app no contiene anuncios.**

## Acceso a la app

**Toda la funcionalidad está disponible sin restricciones de acceso.** No hay inicio de sesión ni cuenta. La
captura automática depende de un permiso del sistema que la persona activa desde la app (divulgación destacada
`08 §3.1`); si la revisión pide verla, el video de `PLAY-STORE.md` §5.9 (pendiente 25 de Adam).

## Clasificación del contenido (IARC)

| Pregunta | Respuesta |
| --- | --- |
| Correo electrónico | `gerencia@nexara.com.mx` |
| Categoría | **Utilidad, productividad, comunicación u otros** |
| Violencia, sexo o desnudez, lenguaje, sustancias controladas (drogas, alcohol, tabaco), apuestas (simuladas o reales), humor crudo, horror, contenido descargado o generado por usuarios sujeto a clasificación | **No** a todo |
| ¿La app comparte la ubicación del usuario con otros? | **No** |
| ¿Los usuarios pueden interactuar o intercambiar contenido con otros? | **No** (gastos compartidos necesita la nube, apagada; cuando se active, revisar: solo entre dos personas que se aceptan con un QR) |
| ¿Permite compras digitales (bienes o suscripciones)? | **No** en la 1.0.0 (sin productos configurados aunque el SDK de RevenueCat venga en el paquete). **Sí** cuando Plus esté activo: rehacer el cuestionario |
| ¿Incluye navegador web sin restricciones? | **No** (los enlaces abren el navegador del sistema) |
| ¿Recompensa o promueve apuestas? | **No** |

Resultado esperado: **Para todos** (ESRB Everyone / PEGI 3 / 3+).

## Público objetivo y contenido

| Pregunta | Respuesta |
| --- | --- |
| Grupos de edad objetivo | **Mayores de 18 años** únicamente |
| ¿La tienda y el contenido podrían atraer a menores de forma no intencional? | **No** (finanzas personales: sin personajes, juegos ni lenguaje infantil) |

## Noticias

**No, mi app no es una app de noticias.**

## Apps de rastreo de contactos y estado de COVID-19

**Mi app no es una app de rastreo de contactos ni de estado de COVID-19** (si la consola todavía lo pregunta).

## Seguridad de los datos

Pregunta por pregunta en [`data-safety.md`](data-safety.md). Resumen de la 1.0.0: **no recopila ni comparte datos**;
eliminación desde la app; sin cuenta.

## Apps gubernamentales

**No.**

## Funciones financieras

**Mi app ofrece funciones financieras** → marcar únicamente **Herramientas de administración de finanzas
personales / presupuesto y registro de gastos** (la opción equivalente que ofrezca la consola, p. ej. «Otras
funciones financieras» describiendo «gestión de finanzas personales: presupuesto y registro de gastos»).
**No** a: préstamos personales, préstamos de día de pago, banca y cuentas, plataforma de inversiones o trading,
pagos, transferencias o billetera digital, criptomonedas, seguros, crédito o calificación crediticia. La app no mueve
dinero ni se conecta a cuentas con credenciales bancarias. Si pide una captura de respaldo: Ajustes › Acerca de con el
texto fijo de `08 §1`.

## Salud

**Mi app no es una app de salud** (las deducciones de M12 leen CFDI de gastos médicos, pero la app no trata datos de
salud).

## ID de publicidad

**No, mi app no usa el ID de publicidad.** El manifiesto final no trae `com.google.android.gms.permission.AD_ID`
(comprobado con `aapt dump permissions` en el APK de la corrida 39848463124).

## Permisos de servicio en primer plano

El manifiesto final trae `android.permission.FOREGROUND_SERVICE` **sin tipo** (`FOREGROUND_SERVICE_*`): lo
arrastra una dependencia (notificaciones) y la app no inicia servicios en primer plano; la captura es un servicio de
escucha de notificaciones (`BIND_NOTIFICATION_LISTENER_SERVICE`), no un servicio en primer plano. Con objetivo
Android 14+ Play solo exige la declaración cuando hay un permiso `FOREGROUND_SERVICE_<TIPO>`; no debería
preguntarla. Si la pregunta aparece: «Otro» con la explicación de arriba y un video de la captura automática.

## Permisos con formulario propio

Ninguno: sin SMS, registro de llamadas, ubicación en segundo plano, acceso a todos los archivos ni accesibilidad.
El acceso a notificaciones no tiene formulario, pero exige la divulgación destacada dentro de la app (ya existe,
`08 §3.1`) y la política de privacidad publicada (arriba).

## Qué cambia al activar servicios

| Se activa | Cambia |
| --- | --- |
| Nube (Supabase + IA), Sentry, PostHog | Seguridad de los datos (`data-safety.md` §3) |
| RevenueCat / Plus | Seguridad de los datos (historial de compras) · IARC «compras digitales: Sí» · ficha (párrafo PLUS) |
| Respaldo en la nube (M9) | Seguridad de los datos (cuenta: Sí; correo) · URL pública de eliminación de cuenta |
| Gastos compartidos (M16) | Seguridad de los datos · IARC «interactúan con otros usuarios» (revisar) |
