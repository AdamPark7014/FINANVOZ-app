# RELEVO

- **Último turno:** cursor
- **Fecha:** 2026-10-17
- **Rama:** main

## Hecho en este turno

- **Chip:** TalkBack (`×2`, `etiquetaAccesible`, radio sin `checked` duplicado) + pruebas `Chip.test.tsx`.
- **ajustes:** título con `accessibilityRole="header"` y `testID`; aserción en `ajustes.test.tsx`.

## Hecho (acumulado reciente)

- EstadoVacio/Boton/Campo, facturas compartidas live region, TarjetaRespaldo. Ver `git log`.

## A medias — CUIDADO

- WIP local: `PantallaTanda.tsx` (`PISTA_VOLVER_DETALLE` sin commitear).
- CI Windows: `publicar-ejemplos`, RNF-01.
- M0 / teléfono / fiscal: Adam.

## Siguiente paso

1. Adam — M0 / EAS.
2. Centralizar copy O3–O7 en `textos.ts` (ingreso, cuentas, pagos-fijos, colchon, tarjeta).

## No tocar

- Solo `main`; sin ramas/PR/reset duro sin Adam.
- `packages/core` E*, vectores a mano.

## Estimación rápida

FinanVoz código ~92 %; camino tienda ~35 %. Detalle: `docs/PROGRESO-70.md`.
