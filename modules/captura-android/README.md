# `@cartera/captura-android`

Módulo Expo (Kotlin) del `NotificationListenerService`. Especificación en `docs/07-CAPTURA.md` §2; pruebas con adb en `docs/spikes/S1-S2.md` y `scripts/publicar-ejemplos.mjs`. Núcleo JVM: `gradle -p nucleo-jvm test`.

## Tip — apps no autorizadas

Las notificaciones cuyo paquete no está en la lista blanca se descartan en nativo al leer solo `packageName`: no entran en `cola.jsonl` ni se guardan título ni texto (RF-CAP-02 / regla 10, CA-M5-02). En diagnóstico solo aumenta `no_autorizadas`, sin registrar el paquete. Para validar en depuración: publica con una etiqueta que no sea un banco (`cmd notification post -t 'Hola' otra_cosa 'Te deposité $500'`) y comprueba que `--cola` no crece y que `--resumen` refleja el contador. En **release**, `com.android.shell` también es no autorizada (adb no simula bancos); eso solo aplica al build de depuración.
