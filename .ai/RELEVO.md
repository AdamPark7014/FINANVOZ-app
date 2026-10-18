# RELEVO

- **Último turno:** cursor
- **Fecha:** 2026-10-17
- **Rama:** main

## Hecho en este turno

- **movil/ajustes/ingreso:** `SeccionIngreso` y `FormularioIngreso` consumen `ingreso-textos.ts` (labels es-MX); corregido `cuándo` roto en el botón de configurar ingreso.

## Hecho (acumulado reciente)

- `ingreso-textos.ts`, `EditarIngreso`, `ingreso.ts` ya centralizaban copy; ver `git log` en `apps/movil/src/pantallas/ajustes/`.

## A medias — CUIDADO

- WIP local ajeno (no commitear mezclado): `principal.test.tsx`, `PantallaTarjeta.tsx`, respaldo, calculadora, etc.
- CI Windows: `publicar-ejemplos`, RNF-01 rendimiento.

## Siguiente paso

1. Adam — M0 / EAS.
2. Teléfono — flujos compartido e ingreso.

## No tocar

- Solo `main`; sin ramas/PR/reset duro sin Adam.
- `packages/core` E*, vectores a mano.

## Estimación rápida

FinanVoz código ~92 %; camino tienda ~35 %. Detalle: `docs/PROGRESO-70.md`.
