# RELEVO

- **Último turno:** cursor
- **Fecha:** 2026-10-18
- **Rama:** main

## Hecho en este turno

- **CampoMonto / teclado numérico:** TalkBack usa `etiquetaCampoMonto` (`… en pesos` + monto en palabras); wiring en `CampoTexto.etiquetaAccesible`. Tests en `formato.test.ts` y `componentes.test.tsx`. Doc en `ui/README.md`.

## Hecho (acumulado reciente)

- PreviaWidget, captura/onboarding headers, suscripciones TalkBack. Ver `git log`.

## A medias — CUIDADO

- WIP paralelo: revisar `git status` antes de editar (onboarding/tarjetas/principal tests).
- CI Windows: `publicar-ejemplos`, RNF-01.
- M0 / teléfono / fiscal: Adam.

## Siguiente paso

1. Adam — M0 / EAS.
2. No mezclar commits a11y con WIP ajeno.

## No tocar

- Solo `main`; sin ramas/PR/reset duro sin Adam.
- `packages/core` E*, vectores a mano.

## Estimación rápida

FinanVoz código ~92 %; camino tienda ~35 %. Detalle: `docs/PROGRESO-70.md`.
