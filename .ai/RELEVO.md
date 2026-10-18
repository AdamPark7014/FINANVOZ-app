# RELEVO

- **Último turno:** cursor
- **Fecha:** 2026-10-17
- **Rama:** main

## Hecho en este turno

- **ui/tokens:** comentarios JSDoc de contraste WCAG (AA y 1.4.11) alineados con `tokens.test.ts`.

## Hecho (acumulado reciente)

Ver `docs/ESTADO.md` y `git log` (tips docs, M16 compartido, ¿Me alcanza?, etc.).

## A medias — CUIDADO

- CI: `publicar-ejemplos.test.ts` y `rendimiento.test.ts` (RNF-01) pueden fallar en Windows.
- M0 / Expo / teléfono / legal / fiscal: sin cambio (Adam).
- `semilla.ts` / `semilla.test.ts`: typecheck preexistentes en movil (no tocados).
- Otro agente: cambios sin commitear en pantallas principal, onboarding, ajustes, respaldo, fixtures (no tocados en este turno).

## Siguiente paso

1. Adam — M0 y EAS (LANZAMIENTO sentadas 1–2).
2. Teléfono — validar flujo compartido con cámara (140–141).
3. Estabilizar CI sin tocar umbral RNF-01 salvo acuerdo.

## No tocar

- Solo `main`; sin ramas/PR/reset duro sin Adam.
- `packages/core` E*, `eas.json`, `app.config`, vectores a mano.
- Archivos sin commitear del otro turno salvo rescate acordado.

## Estimación rápida

FinanVoz código ~92 %; camino tienda ~35 %. Detalle: `docs/PROGRESO-70.md`.
