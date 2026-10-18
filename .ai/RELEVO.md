# RELEVO

- **Último turno:** cursor
- **Fecha:** 2026-10-17
- **Rama:** main

## Hecho en este turno

- **¿Me alcanza?:** CTAs (Lo compré, Cómo lo calculé, formulario, error, recordatorio) centralizados en `textos.ts` y enlazados en `PantallaMeAlcanza.tsx`; tests actualizados.

## Hecho (acumulado reciente)

Copy vacío/error en ¿Me alcanza? (turno anterior). Ver `docs/ESTADO.md` y `git log`.

## A medias — CUIDADO

- CI: `publicar-ejemplos.test.ts` y `rendimiento.test.ts` (RNF-01) pueden fallar en Windows.
- M0 / Expo / teléfono / legal / fiscal: sin cambio (Adam).
- `semilla.ts` / `semilla.test.ts`: typecheck preexistentes en movil (no tocados).
- Otro agente: ~18 archivos sin commitear (tabs, onboarding, principal, respaldo, ajustes, fixtures) — no incluidos en este commit.

## Siguiente paso

1. Adam — M0 y EAS (LANZAMIENTO sentadas 1–2).
2. Teléfono — validar flujo compartido con cámara (140–141).
3. Commitear o salvar el WIP del otro turno cuando corresponda.

## No tocar

- Solo `main`; sin ramas/PR/reset duro sin Adam.
- `packages/core` E*, `eas.json`, `app.config`, vectores a mano.
- WIP sin commitear del otro turno salvo acuerdo con Adam.

## Estimación rápida

FinanVoz código ~92 %; camino tienda ~35 %. Detalle: `docs/PROGRESO-70.md`.
