# RELEVO

- **Último turno:** cursor
- **Fecha:** 2026-10-17
- **Rama:** main

## Hecho en este turno

- **Onboarding:** prueba O5/O7 en `textos.test.ts` fija copy de `TIP_PAGOS_SALTAR` y `TIP_COLCHON_SIN_POR_AHORA` (02 §14, botones «Saltar» / «Sin colchón»).

## Hecho (acumulado reciente)

- Tabs `ROL_ACCESIBILIDAD_BOTON_PESTANA`, plan `tituloPantalla`, movimientos `etiquetaVacioMovimientos`, personas/deducciones TalkBack. Ver `git log`.

## A medias — CUIDADO

- Typecheck móvil: otros TS pendientes (`MesesYPagos`, `ConfirmacionRegistro`, etc.) — no mezclar en commits a11y.
- CI Windows: `publicar-ejemplos`, RNF-01.
- M0 / teléfono / fiscal params: Adam.

## Siguiente paso

1. Adam — M0 / EAS.
2. Centralizar copy O3–O7 restante en `onboarding/textos.ts`.
3. M11 negocio cuando toque el hito.

## No tocar

- Solo `main`; sin ramas/PR/reset duro sin Adam.
- `LEYENDA_ESTIMACION` (`08 §1`) sin cambiar palabra.
- `packages/core` E*, vectores a mano.

## Estimación rápida

FinanVoz código ~92 %; camino tienda ~35 %. Detalle: `docs/PROGRESO-70.md`.
