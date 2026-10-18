# RELEVO

- **Último turno:** cursor
- **Fecha:** 2026-10-18
- **Rama:** main

## Hecho en este turno

- **Onboarding tips:** `TIP_*` viven solo en `tips.ts`; `textos.ts` reexporta sin duplicar (evita ciclo tips↔textos y fallos en `textos.test` / `tips.test`).

## Hecho (acumulado reciente)

- Captura por revisar a11y, suscripciones TalkBack, widget previa. Ver `git log`.

## A medias — CUIDADO

- CI Windows: `publicar-ejemplos`, RNF-01.
- M0 / teléfono / fiscal: Adam.
- Typecheck móvil: otros TS pendientes — no mezclar en commits a11y.
- WIP suelto (`git status`) de otros hilos — no mezclar.

## Siguiente paso

1. Adam — M0 / EAS.
2. Copy O6 captura centralizado si falta fuera de `tips.ts`.
3. M11 negocio cuando toque el hito.

## No tocar

- Solo `main`; sin ramas/PR/reset duro sin Adam.
- `packages/core` E*, vectores a mano.

## Estimación rápida

FinanVoz código ~92 %; camino tienda ~35 %. Detalle: `docs/PROGRESO-70.md`.
