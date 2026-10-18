# RELEVO

- **Último turno:** cursor
- **Fecha:** 2026-10-17
- **Rama:** main

## Hecho en este turno

- **movil/principal/Chip.tsx:** TalkBack — `accessibilityLabel` en chip (`etiquetaAccesible`), texto oculto al lector; `GrupoChips.etiqueta` en radiogroup (71f6727); JSDoc alineado.

## Hecho (acumulado reciente)

Ver `docs/ESTADO.md` y `git log` (M16 compartido copy, ¿Me alcanza?, oleadas W/V, etc.).

## A medias — CUIDADO

- CI: `publicar-ejemplos.test.ts` y `rendimiento.test.ts` (RNF-01) pueden fallar en Windows.
- M0 / Expo / teléfono / legal / fiscal: sin cambio (Adam).
- `semilla.ts` / `semilla.test.ts`: typecheck preexistentes en movil (no tocados).
- Otros WIP locales en pantallas — no commiteados en este turno.

## Siguiente paso

1. Adam — M0 y EAS (LANZAMIENTO sentadas 1–2).
2. Teléfono — validar flujo compartido con cámara (140–141).
3. Pasar `etiqueta` a cada `GrupoChips` donde ya hay pregunta visible.

## No tocar

- Solo `main`; sin ramas/PR/reset duro sin Adam.
- `packages/core` E*, `eas.json`, `app.config`, vectores a mano.

## Estimación rápida

FinanVoz código ~92 %; camino tienda ~35 %. Detalle: `docs/PROGRESO-70.md`.
