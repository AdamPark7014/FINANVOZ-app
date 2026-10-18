# RELEVO

- **Último turno:** cursor
- **Fecha:** 2026-10-17
- **Rama:** main

## Hecho en este turno

- **Onboarding O3/O4:** quitado re-export circular `textos.ts` → `tips.ts`; `TIP_INGRESO_SALTAR` y `TIP_CUENTAS_MINIMO` viven otra vez en `textos.ts` ( `tips.ts` sigue reexportando desde ahí).

## Hecho (acumulado reciente)

- Personas/tandas/principal a11y y copy; widget/estados-cuenta tests. Ver `git log`.

## A medias — CUIDADO

- WIP local en personas/principal/ui/tarjetas — revisar `git status` antes de editar.
- CI Windows: `publicar-ejemplos`, RNF-01.
- M0 / teléfono / fiscal: Adam.

## Siguiente paso

1. Adam — M0 / EAS.
2. Commitear o descartar WIP ajeno al onboarding si sigue en el árbol.
3. M11 negocio cuando toque el hito.

## No tocar

- Solo `main`; sin ramas/PR/reset duro sin Adam.
- `LEYENDA_ESTIMACION` (`08 §1`) sin cambiar palabra.
- `packages/core` E*, vectores a mano.

## Estimación rápida

FinanVoz código ~92 %; camino tienda ~35 %. Detalle: `docs/PROGRESO-70.md`.
