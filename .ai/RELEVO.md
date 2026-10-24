# RELEVO

- **Último turno:** cursor
- **Fecha:** 2026-10-24
- **Rama:** main

## Hecho en este turno

- **Cierre del pulido UI restante:** cero `gap: espacio.xxs` en `apps/movil`; `contenidoStyle={{ gap: espacio.xl }}` en pantallas que faltaban (deducciones, suscripciones, compartidos, cuentas/detalle/nueva/pagos, arqueo, Movimientos/Cuentas, R2/formulario largo, privacidad, reconsentimiento, plan, ayuda, términos, aviso, tarjeta nueva, tandas/tarjeta vacías).
- Kit UI: `Interruptor` y `TarjetaEntendi` con un poco más de aire.
- Jest amplio (deducciones/suscripciones/compartido/cuentas/privacidad/ayuda/plan/arqueo/UI) en verde.

## A medias

- Ola 7 + renovación UI **sin probar en teléfono** (TestFlight 4 / Play código 2).
- Proxy con reintento: falta redesplegar en Hetzner.

## Siguiente

1. Build TestFlight 4 / Play 2; Adam prueba en teléfono — el pulido visual de pantallas ya está cerrado en código.
2. Adam — M0, dominio, legal.

## No tocar

- Solo `main`; sin ramas/PR/reset duro.
- `LEYENDA_ESTIMACION`, `packages/core` E*, vectores a mano.
- `PreviaWidget` / `widget.test` salvo pedido explícito.
- Credenciales fuera del repo.

## Estimación rápida

FinanVoz código ~95 %; UI post-Ola-7 cubierta en prácticamente todas las pantallas; camino tienda ~70 %.
