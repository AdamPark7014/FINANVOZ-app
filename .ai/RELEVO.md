# RELEVO

- **Último turno:** cursor
- **Fecha:** 2026-10-17
- **Rama:** main

## Hecho en este turno

- **movil/tarjetas:** copy centralizado en `textos.ts` (pago, MSI, pagos planeados, liquidar); empty `tarjeta-meses-vacio` + movimientos/estados alineados; a11y (`Dato` accesible, título `header`); pruebas vacío y TalkBack en `tarjetas.test.tsx`.

## Hecho (acumulado reciente)

- Oleadas copy/a11y (principal, onboarding, tandas, privacidad, widget). Ver `git log` y `docs/ESTADO.md`.

## A medias — CUIDADO

- CI Windows: `publicar-ejemplos`, RNF-01 rendimiento; varios tests de `tarjetas.test.tsx` fallan por `PantallaCuentas`/Hoy (testIDs/copy ajeno), no por este commit.
- WIP local sin commitear (ingreso, arqueo, estados-cuenta, principal) — no mezclar.
- M0 / teléfono / fiscal: Adam.

## Siguiente paso

1. Adam — M0 / EAS.
2. Estabilizar tests tarjetas/Hoy si fallan en CI.

## No tocar

- Solo `main`; sin ramas/PR/reset duro sin Adam.
- `packages/core` E*, vectores a mano.

## Estimación rápida

FinanVoz código ~92 %; camino tienda ~35 %. Detalle: `docs/PROGRESO-70.md`.
