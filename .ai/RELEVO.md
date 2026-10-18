# RELEVO

- **Último turno:** cursor
- **Fecha:** 2026-10-17
- **Rama:** main

## Hecho en este turno

- **test(movil):** pruebas alineadas a UI con texto oculto al lector — avisos de tanda (`toHaveTextContent` + `saldoInicial` en E11-03); filtro de consulta en Movimientos (`hidden: true`). Resuelto conflicto stash en `tandas.test.tsx`.

## Hecho (acumulado reciente)

- Estados de cuenta: copy/a11y en `LeerEstadoCuenta`, barrel `index.ts` (`b3a74f1`). Consulta/respaldo: `BTN_LISTO`, `boton-cerrar-consulta`. Ver `git log`.

## A medias — CUIDADO

- CI Windows: `publicar-ejemplos`, RNF-01 rendimiento.
- WIP ajeno (tabs, arqueo, PanelRegistrar) — no mezclar.
- M0 / teléfono / fiscal: Adam.

## Siguiente paso

1. Adam — M0 / EAS.
2. Push `main` si hace falta.

## No tocar

- Solo `main`; sin ramas/PR/reset duro sin Adam.
- `packages/core` E*, vectores a mano.
- `PanelRegistrar.tsx` (otro agente).

## Estimación rápida

FinanVoz código ~92 %; camino tienda ~35 %. Detalle: `docs/PROGRESO-70.md`.
