# RELEVO

- **Último turno:** cursor
- **Fecha:** 2026-10-17
- **Rama:** main

## Hecho en este turno

- **movil:** `app/ajustes.tsx` consume el copy de `src/pantallas/ajustes/textos.ts` vía `index.ts` (textos ya en main desde 33dd907).

## Hecho (acumulado reciente)

Ver `docs/ESTADO.md` y `git log` (M16 compartido copy, ¿Me alcanza?, oleadas W/V, etc.).

## A medias — CUIDADO

- CI: `publicar-ejemplos.test.ts` y `rendimiento.test.ts` (RNF-01) pueden fallar en Windows.
- M0 / Expo / teléfono / legal / fiscal: sin cambio (Adam).
- `semilla.ts` / `semilla.test.ts`: typecheck preexistentes en movil (no tocados).
- Otros WIP locales en pantallas (ingreso, deducciones, etc.) — no commiteados en este turno.

## Siguiente paso

1. Adam — M0 y EAS (LANZAMIENTO sentadas 1–2).
2. Teléfono — validar flujo compartido con cámara (140–141).
3. Estabilizar CI sin tocar umbral RNF-01 salvo acuerdo.

## No tocar

- Solo `main`; sin ramas/PR/reset duro sin Adam.
- `packages/core` E*, `eas.json`, `app.config`, vectores a mano.

## Estimación rápida

FinanVoz código ~92 %; camino tienda ~35 %. Detalle: `docs/PROGRESO-70.md`.
