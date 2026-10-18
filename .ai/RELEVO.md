# RELEVO

- **Último turno:** cursor
- **Fecha:** 2026-10-17
- **Rama:** main

## Hecho en este turno

- **movil:** copy de Ajustes en `src/pantallas/ajustes/textos.ts` + barrel `index.ts`; `app/ajustes.tsx` consume esas constantes (973d50c / 33dd907 / 0855720).

## Hecho (acumulado reciente)

Ver `docs/ESTADO.md` y `git log` (M16 compartido copy, ¿Me alcanza?, oleadas W/V, etc.).

## A medias — CUIDADO

- CI: `publicar-ejemplos.test.ts` y `rendimiento.test.ts` (RNF-01) pueden fallar en Windows.
- M0 / Expo / teléfono / legal / fiscal: sin cambio (Adam).
- `semilla.ts` / `semilla.test.ts`: typecheck preexistentes en movil (no tocados).
- WIP local de otros agentes (stashes `wip paralelo*`) — no mezclar sin leer.

## Siguiente paso

1. Adam — M0 y EAS (LANZAMIENTO sentadas 1–2).
2. Teléfono — validar flujo compartido con cámara (140–141).
3. Centralizar copy de subsecciones Ajustes (ingreso ya tiene `ingreso-textos.ts`).

## No tocar

- Solo `main`; sin ramas/PR/reset duro sin Adam.
- `packages/core` E*, `eas.json`, `app.config`, vectores a mano.

## Estimación rápida

FinanVoz código ~92 %; camino tienda ~35 %. Detalle: `docs/PROGRESO-70.md`.
