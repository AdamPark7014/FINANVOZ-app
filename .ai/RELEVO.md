# RELEVO

- **Último turno:** cursor
- **Fecha:** 2026-10-24
- **Rama:** main

## Hecho en este turno

- **Personas** (`77742d0`): detalle, cuenta dividida (reparto en tarjeta), datos de cobro, lista Te deben.
- **Respaldo + bloqueo:** pantalla de respaldo con `gap: xl`; tarjetas nube/archivo y formulario de contraseña con más aire; sección Bloqueo holgada.
- Jest personas/cuentas + respaldo/ajustes en verde.

## A medias

- Ola 7 + renovación UI **sin probar en teléfono** (TestFlight 4 / Play código 2).
- Proxy con reintento: falta redesplegar en Hetzner.

## Siguiente

1. Build TestFlight 4 / Play 2; Adam prueba en teléfono.
2. Si el teléfono pide más: restaurar / movimientos / deducciones.
3. Adam — M0, dominio, legal.

## No tocar

- Solo `main`; sin ramas/PR/reset duro.
- `LEYENDA_ESTIMACION`, `packages/core` E*, vectores a mano.
- `PreviaWidget` / `widget.test` salvo pedido explícito.
- Credenciales fuera del repo.

## Estimación rápida

FinanVoz código ~95 %; UI post-Ola-7 cubierta también en personas y respaldo; camino tienda ~70 %.
