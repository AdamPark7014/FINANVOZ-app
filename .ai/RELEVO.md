# RELEVO

- **Último turno:** cursor
- **Fecha:** 2026-10-17
- **Rama:** main

## Hecho en este turno

- **ayuda:** copy UI y FAQ en `textos.ts` (iconos +/-, bloque Ajustes con alias `SECCION_AYUDA` / `TEXTO_AYUDA` / `BTN_AYUDA`); exports en `index.ts`; vitest `textos.test.ts`.

## Hecho (acumulado reciente)

- Copy Ajustes, ingreso, cuentas, movimientos, suscripciones, Hoy tab. Ver `git log`.

## A medias — CUIDADO

- CI Windows: `publicar-ejemplos`, RNF-01 rendimiento.
- WIP ajeno sin commitear — no mezclar salvo pedido explícito.
- `ajustes/textos.ts`: reexportar alias de ayuda y quitar duplicados.
- M0 / teléfono / fiscal: Adam.

## Siguiente paso

1. Adam — M0 / EAS.
2. Oleada Ajustes: `export { SECCION_AYUDA, TEXTO_AYUDA, BTN_AYUDA } from '../ayuda/textos'`.

## No tocar

- Solo `main`; sin ramas/PR/reset duro sin Adam.
- `packages/core` E*, vectores a mano.

## Estimación rápida

FinanVoz código ~92 %; camino tienda ~35 %. Detalle: `docs/PROGRESO-70.md`.
