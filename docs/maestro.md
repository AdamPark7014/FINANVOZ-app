# Maestro — E2E en Android (pendiente 13)

Flujos en `apps/movil/.maestro/`. Usan `testID` de la app (no texto de copy salvo donde no hay ID, p. ej. el botón «Contar mi efectivo» en Cuentas).

| Archivo | Qué cubre | Criterio |
|---|---|---|
| `onboarding.yaml` | O1–O7, termina en Hoy | CA-M2-01 |
| `registrar-gasto-efectivo.yaml` | Onboarding + «coca 25 en efectivo» + saldo $575 | CA-M2-02 |
| `arqueo-basico.yaml` | Lo anterior + arqueo exacto en Cuentas | E7 / CA-M5-05 (humo) |

No hay carpeta `e2e/` en el repo; Maestro es el E2E Android previsto en `docs/03-ARQUITECTURA.md`.

## Requisitos

1. **Build de desarrollo** con `com.finanvoz.app` instalada (no Expo Go):
   - Local: `pnpm --filter movil android` (Metro + dev client).
   - O EAS: `eas build -p android --profile development` e instalar el APK/AAB en el teléfono o emulador.
2. **[Maestro CLI](https://maestro.mobile.dev/getting-started/installing-maestro)** en PATH.
3. Dispositivo visible: `adb devices`.
4. Para **registrar por texto**, el NLU nivel 0 basta (modo avión OK). No hace falta proxy ni Plus.

## Tips Android

- Usa el **dev client** (`com.finanvoz.app`); Expo Go no sirve para estos flujos.
- Deja **un solo** dispositivo en `adb devices` (emulador o teléfono, no ambos).
- En el emulador, pon animaciones en **0×** (Opciones de desarrollador) para menos flakes en `extendedWaitUntil`.
- Si `launchApp` hace timeout al arrancar Metro: `$env:MAESTRO_DRIVER_STARTUP_TIMEOUT = "60000"` y vuelve a correr.
- Tras un fallo a medias, el siguiente run con `clearState: true` (onboarding) limpia datos; si no, `adb shell pm clear com.finanvoz.app`.

## Cómo correr

Desde la raíz del monorepo (`FINANVOZ-app`):

```powershell
# Un flujo
maestro test apps/movil/.maestro/onboarding.yaml

# CA-M2-02 (incluye onboarding)
maestro test apps/movil/.maestro/registrar-gasto-efectivo.yaml

# Arqueo cuadrado tras gasto en efectivo
maestro test apps/movil/.maestro/arqueo-basico.yaml

# Los tres seguidos
maestro test apps/movil/.maestro/
```

Cronometrar onboarding (CA-M2-01, meta ≤ 4 min): anotar la duración que imprime Maestro o usar `Measure-Command { maestro test ... }`.

## Notas por pantalla

- **O6 Captura:** en builds sin módulo nativo de captura (p. ej. solo Metro), el flujo espera `onb-captura-pronto` y el texto «No disponible en este teléfono». Con captura nativa activa, O6 muestra la divulgación: ese camino no está automatizado; en el teléfono puedes tocar «Ahora no» (`onb-captura-ahora-no`) y seguir manualmente, o ampliar el YAML cuando el build de beta sea el de referencia.
- **Hoy tras O7:** puede salir el aviso de MSI «No sé»; `onboarding.yaml` lo cierra con `boton-aviso-entendido` si está visible.
- **Arqueo:** el paso «¿pagaste alguno de estos en efectivo?» solo aparece si hay gastos por asignar de más de 24 h; este flujo no lo ve porque el gasto acaba de registrarse.

## Evidencia para ESTADO (pendiente 13)

- Fecha, dispositivo (modelo Android), build (dev local o EAS).
- Salida de Maestro en verde para los flujos que corras.
- Tiempo del onboarding si cierras CA-M2-01.
