# RELEVO

- **Último turno:** cursor
- **Fecha:** 2026-10-24
- **Rama:** main

## Hecho en este turno

- **Renovación UI/UX del sistema de diseño (post Ola 7 de Claude):** tokens más cálidos (fondo menta, radios 8/14/20/28, tipografía más aireada, `sombra.tarjeta` / `sombra.aviso`), barra de pestañas sin borde duro con elevación suave, botones/chips con scale al tocar, tarjetas y burbujas del asistente con sombra y esquinas más amables, avisos redondeados, estados vacíos en pastilla, campos más holgados, cabecera del asistente con más aire y barra del día un poco más gruesa.
- Contraste AA: `tokens.test.ts` 59/59. Jest UI + Aviso + oscuro 37/37; asistente smoke en verde.

## A medias

- La Ola 7 sigue **sin probar en teléfono** (TestFlight 4 / Play código 2). Este pulido visual tampoco se ha visto en dispositivo.
- Proxy con reintento: **falta redesplegar** en Hetzner.

## Siguiente

1. Build TestFlight 4 / Play 2 con Ola 7 + esta renovación visual; Adam prueba en teléfono.
2. Segunda pasada UI: Movimientos/Cuentas/Tú y formularios largos si el teléfono pide más aire.
3. Adam — M0, dominio, legal.

## No tocar

- Solo `main`; sin ramas/PR/reset duro.
- `LEYENDA_ESTIMACION`, `packages/core` E*, vectores a mano.
- `PreviaWidget` / `widget.test` salvo pedido explícito.
- Credenciales fuera del repo.

## Estimación rápida

FinanVoz código ~95 %; UI base renovada post-Ola-7; camino tienda ~70 %.
