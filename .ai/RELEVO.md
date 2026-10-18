# RELEVO

- **Último turno:** cursor
- **Fecha:** 2026-10-17
- **Rama:** main

## Hecho en este turno

- **Onboarding O5/O7:** copy de pagos fijos y colchón en `onboarding/textos.ts`; pantallas importan desde ahí. Tips O3–O7 en `textos.ts`; `tips.ts` solo reexporta (sin ciclo con `textos`). Sugerencia 10 %: `sugerenciaMontoColchon10` en `colchon-textos.ts`. Commit **`34ffca6`** en `origin/main`.

## Hecho (acumulado reciente)

- O3/O4 centralizados (`43574fd`), tabs/personas/captura TalkBack. Ver `git log`.

## A medias — CUIDADO

- WIP local ajeno (principal, deducciones, etc.) — no mezclar.
- Typecheck móvil / CI Windows pendientes.
- M0 / teléfono / fiscal: Adam.

## Siguiente paso

1. Adam — M0 / EAS.
2. Tips O2/O6 en `textos` si se busca un solo módulo.

## No tocar

- Solo `main`; sin ramas/PR/reset duro sin Adam.
- `packages/core` E*, vectores a mano.

## Estimación rápida

FinanVoz código ~92 %; camino tienda ~35 %. Detalle: `docs/PROGRESO-70.md`.
