# RELEVO

- **Último turno:** cursor
- **Fecha:** 2026-10-17
- **Rama:** main

## Hecho en este turno

- **movil/tarjetas:** copy en `textos.ts` (detalle, pago, MSI, vacíos); `Dato` accesible + título `header`; empty `tarjeta-meses-vacio`; `BTN_CANCELAR` unificado; barrel `index.ts`; pruebas vacío/a11y en `tarjetas.test.tsx`.

## Hecho (acumulado reciente)

- Oleadas copy movil (Ajustes, plan, captura, suscripciones, ayuda). Ver `git log`.

## A medias — CUIDADO

- WIP ajeno (principal, estados-cuenta, avisos, captura) — no mezclar.
- Varios tests en `tarjetas.test.tsx` (Hoy/Cuentas) fallan por copy/testIDs fuera de tarjetas.
- CI Windows: `publicar-ejemplos`, RNF-01.
- M0 / teléfono / fiscal: Adam.

## Siguiente paso

1. Adam — M0 / EAS.
2. Estabilizar tests tarjetas/Hoy si hace falta en CI.

## No tocar

- Solo `main`; sin ramas/PR/reset duro sin Adam.
- `packages/core` E*, vectores a mano.

## Estimación rápida

FinanVoz código ~92 %; camino tienda ~35 %. Detalle: `docs/PROGRESO-70.md`.
