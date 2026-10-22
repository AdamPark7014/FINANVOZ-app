# Capturas, gráfico y video (M13)

Las capturas de las dos tiendas salen de un **pipeline**, no de un lote a mano: Maestro toma las pantallas en un
simulador o emulador en es-MX, `scripts/tienda/enmarcar.py` las enmarca al tamaño exacto de cada tienda y el lote
final queda en `docs/tienda/capturas/`. iOS las sube `scripts/tienda/asc-ficha.py` por API; las de Android se
suben por navegador con [`play/ficha.md`](play/ficha.md). Sin datos de ninguna persona: todo sale del recorrido
inicial de la app (quincena de $13,000, efectivo $600, BBVA, tarjeta Oro con meses, renta) más «coca 25 en
efectivo». Sin marcos de teléfono ni texto encima que prometa resultados; los titulares son cortos, en tuteo y sin
exclamaciones.

## Cómo se corre

| Paso | iOS (App Store) | Android (Google Play) |
| --- | --- | --- |
| 1. Capturas crudas | GitHub → Actions → **iOS · Capturas de tienda** (`ios-capturas.yml`). Baja el `Finanvoz.app` de la última corrida verde de «iOS simulador» (o el `run_id` que le pases), crea un **iPhone 16 Pro Max** (6.9", 1320 × 2868) en es-MX con la barra de estado a las 10:00, corre `apps/movil/.maestro/ios` con `--include-tags capturas,recorrido` en claro y los `capturas` en oscuro. Artefacto **`maestro-capturas`** (`claro/`, `oscuro/`) | GitHub → Actions → **Android · Capturas de tienda** (`android-capturas.yml`). Compila el APK x86_64 (o toma el de «APK Android» con `arquitecturas=x86_64` por `run_id`), levanta un **Pixel 7 API 34** (1080 × 2400) con KVM, es-MX, hora de México y barra en modo demo, y corre `scripts/tienda/capturas-android.sh` → `scripts/tienda/maestro/android-capturas.yaml` en claro y oscuro (más cualquier flujo de `apps/movil/.maestro/*.yaml` con `takeScreenshot`). Artefacto **`maestro-capturas-android`** |
| 2. Enmarcar | El mismo flujo corre `enmarcar.py --plataforma ios-6.9` y sube **`capturas-enmarcadas-ios`** (1320 × 2868) | Idem, `--plataforma android-telefono` → **`capturas-enmarcadas-android`** (1080 × 1920) |
| 3. Lote final | Copiar los PNG del artefacto a `docs/tienda/capturas/ios-6.9/` y commitear | Copiar a `docs/tienda/capturas/android-telefono/` y commitear |
| 4. Subir | `py -3 scripts/tienda/asc-ficha.py` (sube el set `APP_IPHONE_67`, que Apple usa para 6.7" y 6.9", con reserva, subida por partes y checksum MD5; idempotente) | Play Console → Ficha principal → Capturas del teléfono (navegador) |

En esta PC, sin el flujo: bajar el artefacto crudo (`gh run download <id> -n maestro-capturas -D <carpeta>`) y
`py -3 scripts/tienda/enmarcar.py --plataforma ios-6.9 --entrada <carpeta>`. Para Android también se puede correr
`capturas-android.sh` contra un emulador local (`ANDROID_SERIAL=emulator-5556 APK=… SALIDA=… MAESTRO=<ruta a maestro.bat> bash scripts/tienda/capturas-android.sh`;
Maestro 2.11.0 corre en Windows con su `maestro.bat`; con `SIN_INSTALAR=1` reutiliza la app ya instalada, útil
porque `adb install` de 80 MB tarda minutos). El AVD de esta PC para eso es `finanvoz-capturas` (Pixel 7, API 34
google_apis x86_64; el APK arm64 corre con la traducción del sistema, más lento). Pillow: `py -3 -m pip install pillow`.
La letra Inter se baja sola a la carpeta temporal del sistema (876 KB; no entra al repositorio).

El orden, los titulares y qué `takeScreenshot` alimenta cada captura están en `scripts/tienda/capturas-plan.json`
(gana el primer nombre que exista; si falta una, el script avisa y sigue):

| # | Archivo final | Titular | Pantalla | `takeScreenshot` (flujo) |
| --- | --- | --- | --- | --- |
| 1 | `01-hoy` | Cuánto puedes gastar hoy | Hoy con el desglose abierto | `hoy-desglose` (`ios/02`, `android-capturas`) o `hoy` |
| 2 | `02-registrado` | Dilo y queda registrado | El aviso «Registré: Coca $25 · … — Deshacer» | `hoy-registrado` (`ios/05`, `android-capturas`) |
| 3 | `03-arqueo` | Tu efectivo, contado | «Deberías traer … en efectivo. ¿Cuánto traes?» | `arqueo` (`ios/04`, `android-capturas`) |
| 4 | `04-tarjeta` | Tarjetas y meses sin sorpresas | Detalle de la tarjeta Oro: corte, límite, pago sin intereses, meses | `tarjeta-oro` (`ios/01`, `android-capturas`) o `tarjeta-nueva` |
| 5 | `05-privacidad` | Lo que sale de tu teléfono, claro | Ajustes › Privacidad | `privacidad` (`ios/03`, `android-capturas`) |
| 6 | `06-hoy-oscuro` | Cuánto puedes gastar hoy | La 1 en tema oscuro | `hoy-desglose` / `hoy` de la carpeta `oscuro/` |

No van hasta que existan en la build: captura automática con la insignia `automático` (Android; necesita el módulo
nativo y un aviso de banco: escenario `e-captura`, solo en builds de desarrollo) y «¿Me alcanza?» de Plus. Los
escenarios semilla de `fixtures/escenarios` (`e4-01`, `e5-10`) solo existen con `__DEV__`; cuando haya un build de
desarrollo en el flujo, el plan vuelve a ellos (Hoy con «$214» y «4 días para tu quincena»).

## Reglas de la imagen

PNG, sin canal alfa en el resultado, tamaños exactos: iOS **1320 × 2868** (Apple escala a los menores; obligatorio
el 6.9"), Android **1080 × 1920** (9:16). Teléfono en español, letra del sistema al 100 %, hora 10:00, batería y
señal llenas, sin notificaciones en la barra. El marco es el degradado de marca (`#14A37F` → `#0A6B57`), titular en
Inter Bold blanco y la captura con esquinas redondeadas y sombra; la pantalla sangra por abajo. Apple exige que las
de iOS sean de iPhone (NEXARA fue rechazada por subir las de Android).

## Gráfico de funciones

`assets/marca/grafico-funciones-1024x500.png`, generado por `py -3 scripts/tienda/grafico-funciones.py`: degradado
de marca, el ícono redondeado y la frase «Cuánto puedes gastar hoy» con la marca encima. Sin capturas encimadas ni
precios; el centro queda libre por si algún día hay video (ahí va el botón de reproducir).

## Video

- **Ficha (opcional):** 30 a 60 s en YouTube, mismo guion que las capturas 1 → 2 → 3 → 4, sin música con derechos de
  terceros. No hay.
- **Revisión de Play (obligatorio, pendiente 25):** la divulgación destacada de `08 §3.1` desde Hoy hasta la captura
  de un movimiento; no es el mismo video de la ficha. Lo graba Adam en un teléfono con una app de banco real.
