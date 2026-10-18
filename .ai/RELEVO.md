# RELEVO

- **Último turno:** cursor
- **Fecha:** 2026-10-18
- **Rama:** main

## Hecho en este turno

- **Onboarding tips:** `TIP_*` canónicos en `tips.ts`; `textos.ts` solo reexporta (sin duplicar ni ciclo tips↔textos). Tests `tips.test.ts` + `textos.test.ts` (incl. O6 `TIP_CAPTURA_AHORA_NO`) en verde.

## Hecho (acumulado reciente)

- PreviaWidget a11y, TalkBack Hoy, suscripciones. Ver `git log`.

## A medias — CUIDADO

- CI Windows: `publicar-ejemplos`, RNF-01.
- M0 / teléfono / fiscal: Adam.
- Typecheck móvil: otros TS pendientes — no mezclar en commits a11y.
- WIP suelto en otros archivos — revisar `git status` antes de editar.

## Siguiente paso

1. Adam — M0 / EAS.
2. M11 negocio cuando toque el hito.

## No tocar

- Solo `main`; sin ramas/PR/reset duro sin Adam.
- `packages/core` E*, vectores a mano.

## Estimación rápida

FinanVoz código ~92 %; camino tienda ~35 %. Detalle: `docs/PROGRESO-70.md`.
