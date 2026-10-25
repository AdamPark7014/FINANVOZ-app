# RELEVO

- **Último turno:** cursor
- **Fecha:** 2026-10-25
- **Rama:** main

## Hecho en este turno

- **PLAN-UX §3.3** barra nativa en: cuentas (detalle + nueva), pagos-fijos (lista/nuevo/detalle), personas (lista), ajustes raíz.
- `Encabezado` con `alVolver` opcional; pantallas de cuentas/pagos/personas alineadas.
- Ajustes: sin «Volver» en contenido (Stack nativo); pestaña Tú sin cambio.
- Jest 32 verdes (cuentas + ajustes). `tsc` ok.

## A medias

- Fallback sin historial (cold open). tarjetas/nueva, estado-cuenta, expo-sharing si aún tienen Volver.
- Teléfono, M0, legal, proxy, contador, plantillas; expo-symbols.

## Siguiente

1. Barrer pantallas restantes con «Volver» en contenido + fallback 1.10.
2. Adam en teléfono + LANZAMIENTO sentada 1.

## No tocar

- Solo `main`. Facturar/planeta/open banking password sin spec.

## Estimación rápida

Casi todas las pantallas de stack con header nativo. Launch-ready sigue en externos.
