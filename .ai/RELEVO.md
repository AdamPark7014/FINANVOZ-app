# RELEVO

- **Último turno:** cursor
- **Fecha:** 2026-10-17
- **Rama:** main

## Hecho en este turno

- **`696b6c6` fix(movil): pulir UI principal** — empty states y copy Movimientos/Cuentas en `textos.ts` + `EstadoVacio`; chips con `GrupoChips.etiqueta` y `OCULTAR_ETIQUETA_VISIBLE`; tests en `principal.test.tsx`; formulario de movimiento alineado al helper a11y. Sin tocar `PanelRegistrar.tsx`.

## Hecho (acumulado reciente)

- Commits posteriores en main (me-alcanza, ayuda, suscripciones, onboarding). Ver `git log`.

## A medias — CUIDADO

- WIP local (estados-cuenta, me-alcanza test, etc.) — no mezclar sin Adam.
- Otro agente: `PanelRegistrar.tsx`.
- CI Windows: `publicar-ejemplos`, RNF-01.
- M0 / teléfono / fiscal: Adam.

## Siguiente paso

1. Adam — M0 / EAS.
2. Push de `main` si hace falta (`696b6c6` ya en historial local).

## No tocar

- Solo `main`; sin ramas/PR/reset duro sin Adam.
- `packages/core` E*, vectores a mano.
- `apps/movil/src/pantallas/principal/PanelRegistrar.tsx` (otro agente).

## Estimación rápida

FinanVoz código ~92 %; camino tienda ~35 %. Detalle: `docs/PROGRESO-70.md`.
