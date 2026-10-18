# RELEVO

- **Último turno:** cursor
- **Fecha:** 2026-10-17
- **Rama:** main

## Hecho en este turno

<<<<<<< Updated upstream
- **movil/ajustes/ingreso:** `8088eb3` — `SeccionIngreso` y `FormularioIngreso` usan `ingreso-textos.ts`; arreglado botón `Decir cada cuándo me pagan` (UTF-8).
=======
- **movil:** copy de Ajustes en `src/pantallas/ajustes/textos.ts` + barrel `index.ts`; `app/ajustes.tsx` consume esas constantes (973d50c / 33dd907 / 0855720).
>>>>>>> Stashed changes

## Hecho (acumulado reciente)

Ver `docs/ESTADO.md` y `git log` (empty states, ¿Me alcanza?, copy Ajustes, etc.).

## A medias — CUIDADO

<<<<<<< Updated upstream
- CI Windows: `publicar-ejemplos`, RNF-01 rendimiento.
- WIP local: `tandas/textos.ts` sin commitear.
- M0 / teléfono / fiscal: Adam.

## Siguiente paso

1. Adam — M0 / EAS.
2. Teléfono — ingreso y deducciones.
=======
- CI: `publicar-ejemplos.test.ts` y `rendimiento.test.ts` (RNF-01) pueden fallar en Windows.
- M0 / Expo / teléfono / legal / fiscal: sin cambio (Adam).
- `semilla.ts` / `semilla.test.ts`: typecheck preexistentes en movil (no tocados).
- WIP local de otros agentes en pantallas (stash `wip paralelo` / `wip paralelo2`) — no mezclar sin leer.

## Siguiente paso

1. Adam — M0 y EAS (LANZAMIENTO sentadas 1–2).
2. Teléfono — validar flujo compartido con cámara (140–141).
3. Centralizar copy de subsecciones Ajustes (ingreso ya tiene `ingreso-textos.ts`).
>>>>>>> Stashed changes

## No tocar

- Solo `main`; sin ramas/PR/reset duro sin Adam.
- `packages/core` E*, vectores a mano.

## Estimación rápida

FinanVoz código ~92 %; camino tienda ~35 %. Detalle: `docs/PROGRESO-70.md`.
