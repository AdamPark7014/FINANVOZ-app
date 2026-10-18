# RELEVO

- **Último turno:** cursor
- **Fecha:** 2026-10-18
- **Rama:** main

## Hecho en este turno

- **EscanerQr TalkBack:** instrucción visual fuera del árbol; botón «Permitir la cámara» con `etiquetaAccesible` completa + pista; test en `compartido.test.tsx`.
- **FormularioGastoCompartido (turno previo/rescate):** `PISTA_GUARDAR_GASTO_COMPARTIDO`, live region resumen con `importantForAccessibility="yes"`.

## Hecho (acumulado reciente)

- PreviaWidget, captura, Cuentas TalkBack. Ver `git log`.

## A medias — CUIDADO

- WIP paralelo fuera de `compartido/` (onboarding, ajustes, Chip, etc.) — no mezclar en commits de compartido.
- M0 / EAS: Adam.

## Siguiente paso

1. Adam — M0 / EAS.
2. TalkBack botones grupo (Saldar, Anular) o `TarjetaConfirmarCompartido` cancelar.

## No tocar

- Solo `main`; sin ramas/PR/reset duro sin Adam.
- `LEYENDA_ESTIMACION` (`08 §1`) literal.
- `packages/core` E*, vectores a mano.

## Estimación rápida

FinanVoz código ~92 %; camino tienda ~35 %. Detalle: `docs/PROGRESO-70.md`.
