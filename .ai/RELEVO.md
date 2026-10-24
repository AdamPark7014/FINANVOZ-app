# RELEVO

- **Último turno:** cursor
- **Fecha:** 2026-10-24
- **Rama:** main

## Hecho en este turno

- Tras el cierre de pantallas (`fd0fd8b`): **kit + Hoy/voz** — `Pantalla` por defecto `gap: xl`; `Tarjeta` y campos de texto más holgados; barra de voz y cabecera del asistente con más aire; chips/conversación sin `xxs`; `FlujoCorreo` en bloques con gap.
- Cero `espacio.xxs` en `apps/movil`. Jest UI/asistente/respaldo/principal en verde (116).

## A medias

- Ola 7 + renovación UI **sin probar en teléfono** (TestFlight 4 / Play código 2).
- Proxy con reintento: falta redesplegar en Hetzner.

## Siguiente

1. **Adam:** build TestFlight 4 / Play 2 y probar en teléfono — el pulido visual en código ya no tiene oleadas obvias.
2. Adam — M0 (dominio/lista de espera), legal, proxy en Hetzner.

## No tocar

- Solo `main`; sin ramas/PR/reset duro.
- `LEYENDA_ESTIMACION`, `packages/core` E*, vectores a mano.
- `PreviaWidget` / `widget.test` salvo pedido explícito.
- Credenciales fuera del repo.

## Estimación rápida

FinanVoz código ~95 %; UI post-Ola-7 cerrada en pantallas y kit; camino tienda ~70 %.
