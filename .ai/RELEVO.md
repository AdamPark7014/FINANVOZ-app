# RELEVO

- **Último turno:** cursor
- **Fecha:** 2026-10-17
- **Rama:** main

## Hecho en este turno

- **Personas:** `PISTA_YA_ME_PAGO` en «Ya me pagó»; antes `PISTA_COBRAR`, `PISTA_VOLVER` (TalkBack `02 §19`); pruebas en `personas.test.tsx`.
- **¿Me alcanza?:** `PISTA_CALCULAR` en Calcular (`89f4685`).

## Hecho (acumulado reciente)

- Onboarding/tabs/captura/widget/deducciones/arqueo TalkBack y copy. Ver `git log`.

## A medias — CUIDADO

- Typecheck móvil: otros TS pendientes — no mezclar en commits a11y.
- CI Windows: `publicar-ejemplos`, RNF-01.
- M0 / teléfono / fiscal params: Adam.

## Siguiente paso

1. Adam — M0 / EAS.
2. Centralizar copy O3–O7 restante en `onboarding/textos.ts`.
3. Recordatorio cobrar / más CTAs personas si otro pase M13.

## No tocar

- Solo `main`; sin ramas/PR/reset duro sin Adam.
- `LEYENDA_ESTIMACION` (`08 §1`) sin cambiar palabra.
- `packages/core` E*, vectores a mano.

## Estimación rápida

FinanVoz código ~92 %; camino tienda ~35 %. Detalle: `docs/PROGRESO-70.md`.
