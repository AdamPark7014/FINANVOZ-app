# RELEVO

- **Último turno:** cursor
- **Fecha:** 2026-10-17
- **Rama:** main

## Hecho en este turno

- **docs semilla:** `apps/movil/scripts/README.md` — tip PowerShell `pnpm --filter movil semilla <id>`, git/hash skip (`.db` en `.gitignore`), validación por JSON vs `esperado`, typecheck skip del CLI (`tsx` / `scripts/` fuera de `tsconfig`). Enlazado desde `fixtures/README.md` (§ Semilla en PowerShell, ya en main).

## Hecho (acumulado reciente)

Ver `docs/ESTADO.md` y `git log` (respaldo textos, compartido, plan, etc.).

## A medias — CUIDADO

- CI: `publicar-ejemplos.test.ts` y `rendimiento.test.ts` (RNF-01) pueden fallar en Windows.
- WIP local en pantallas movil / UI — no mezclar sin `relevo.ps1 salvar`.
- M0 / Expo / teléfono / legal / fiscal: Adam.
- `src/servicios/semilla.ts` / `semilla.test.ts`: typecheck preexistentes (lógica no tocada).

## Siguiente paso

1. Adam — M0 y EAS.
2. Teléfono — escenarios semilla y respaldo.
3. Estabilizar CI sin tocar umbral RNF-01 salvo acuerdo.

## No tocar

- Solo `main`; sin ramas/PR/reset duro sin Adam.
- `packages/core` E*, `eas.json`, `app.config`, vectores a mano.
- Lógica de `semilla.ts` / arreglo typecheck servicio semilla (fuera de alcance).

## Estimación rápida

FinanVoz código ~92 %; camino tienda ~35 %. Detalle: `docs/PROGRESO-70.md`.
