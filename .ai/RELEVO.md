# RELEVO

- **Último turno:** cursor
- **Fecha:** 2026-10-17
- **Rama:** main

## Hecho en este turno

- **Onboarding O3/O4:** copy ingreso/cuentas en `onboarding/textos.ts`; pantallas importan desde ahí. Sin reexport circular `textos` ↔ `tips` (`43574fd`).

## Hecho (acumulado reciente)

- O5/O7 en textos, cuentas atajos, tabs TalkBack. Ver `git log`.

## A medias — CUIDADO

- WIP ajeno en móvil (personas, principal, widget) — no mezclar.
- CI Windows: `publicar-ejemplos`, RNF-01.
- M0 / teléfono / fiscal: Adam.

## Siguiente paso

1. Adam — M0 / EAS.
2. Tips O2/O6 en `textos` si se quiere un solo módulo.

## No tocar

- Solo `main`; sin ramas/PR/reset duro sin Adam.
- `packages/core` E*, vectores a mano.

## Estimación rápida

FinanVoz código ~92 %; camino tienda ~35 %. Detalle: `docs/PROGRESO-70.md`.
