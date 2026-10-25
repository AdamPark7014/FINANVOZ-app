# RELEVO

- **Último turno:** cursor
- **Fecha:** 2026-10-25
- **Rama:** main

## Hecho en este turno

- **PLAN-UX §3.3** barra nativa en: persona, tarjetas, me-alcanza, arqueo.
- `alVolver` opcional en persona/tarjeta; `mostrarCerrar={false}` en me-alcanza/arqueo (alCerrar sigue para Listo/confirm).
- Jest 87 verdes (personas, tarjetas, botones, me-alcanza, arqueo). `tsc` ok.

## A medias

- Barra nativa restante: cuentas, pagos-fijos, ajustes raíz (Volver), etc. Fallback sin historial.
- Teléfono, M0, legal, proxy, contador, plantillas; expo-symbols.

## Siguiente

1. Seguir migrando pantallas con Volver (cuentas, pagos-fijos, ajustes).
2. Adam en teléfono + LANZAMIENTO sentada 1.

## No tocar

- Solo `main`. Facturar/planeta/open banking password sin spec.

## Estimación rápida

~18 pantallas con header nativo. Launch-ready sigue en externos.
