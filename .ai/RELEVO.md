# RELEVO

- **Último turno:** cursor
- **Fecha:** 2026-10-17
- **Rama:** main

## Hecho en este turno

- **estados-cuenta:** copy centralizado en `textos.ts` (botones, avisos, vacío `TEXTO_SIN_NUEVOS`, helpers); `LeerEstadoCuenta` con `EstadoVacio`, live regions y etiquetas TalkBack; prueba de aviso a11y + título.

## Hecho (acumulado reciente)

Ver `git log` (deducciones, suscripciones, tabs, Ayuda/Ajustes alias, etc.).

## A medias — CUIDADO

- WIP local en otras pantallas (tarjetas, tandas, respaldo…) — no mezclar sin pedido.
- CI Windows: `publicar-ejemplos`, RNF-01 rendimiento.
- M0 / teléfono / fiscal: Adam.

## Siguiente paso

1. Adam — M0 / EAS.
2. Push de commits locales en main si procede.

## No tocar

- Solo `main`; sin ramas/PR/reset duro sin Adam.
- `packages/core` E*, vectores a mano.
- `apps/movil/src/pantallas/tandas/textos.ts` sin commitear de turnos ajenos salvo pedido.

## Estimación rápida

FinanVoz código ~92 %; camino tienda ~35 %. Detalle: `docs/PROGRESO-70.md`.
