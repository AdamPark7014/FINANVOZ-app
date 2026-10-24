# RELEVO

- **Último turno:** cursor
- **Fecha:** 2026-10-24
- **Rama:** main

## Hecho en este turno

- **Onboarding más agradable:** tip en pastilla suave (`superficieAlterna`), barra de progreso más gruesa (alto 8), chips con más padding y borde suave; bienvenida con bloque de cuerpo en pastilla.
- **Registrar R2:** bloque «Esto oí» tipográfico (etiqueta + cita + «Revisa y registra»), cabecera con más aire; `accessibilityLabel` conserva el copy completo para lectores.
- **Formulario largo:** título centrado y cabecera alineada con R2.
- Jest: `onboarding.test` + `componentes` + `r2` en verde (17).

## A medias

- La Ola 7 + renovación UI siguen **sin probar en teléfono** (TestFlight 4 / Play código 2).
- Proxy con reintento: **falta redesplegar** en Hetzner.
- Densidad de `FormularioMovimiento` y pasos O2–O7 aún pueden pedir más aire.

## Siguiente

1. Pulir densidad de `FormularioMovimiento` / pasos de onboarding restantes si Adam pide «continua».
2. Build TestFlight 4 / Play 2; Adam prueba en teléfono.
3. Adam — M0, dominio, legal.

## No tocar

- Solo `main`; sin ramas/PR/reset duro.
- `LEYENDA_ESTIMACION`, `packages/core` E*, vectores a mano.
- `PreviaWidget` / `widget.test` salvo pedido explícito.
- Credenciales fuera del repo.

## Estimación rápida

FinanVoz código ~95 %; UI onboarding+R2 alineada al sistema post-Ola-7; camino tienda ~70 %.
