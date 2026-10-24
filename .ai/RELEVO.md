# RELEVO

- **Último turno:** cursor
- **Fecha:** 2026-10-24
- **Rama:** main

## Hecho en este turno

- **Onboarding + R2 (0ae2f0b):** tips en pastilla, barra gruesa, «Esto oí» tipográfico, cabeceras R2/formulario largo.
- **Oleada siguiente:** más aire en `FormularioMovimiento` (gap `xl` / secciones `s`); casillas del onboarding más suaves al tocar; consentimiento con más espacio entre aviso y casilla opcional; «Dímelo» (`DecirloPaso`) con más aire alrededor del micrófono.
- Jest: FormularioMovimiento + onboarding (+ voz/confirmar) + r2 en verde (44).

## A medias

- Ola 7 + renovación UI **sin probar en teléfono** (TestFlight 4 / Play código 2).
- Proxy con reintento: falta redesplegar en Hetzner.

## Siguiente

1. Si Adam pide «continua»: pulir pasos O3–O7 (ingreso/cuentas/tarjeta) o pestaña Hoy / avisos.
2. Build TestFlight 4 / Play 2; Adam prueba en teléfono.
3. Adam — M0, dominio, legal.

## No tocar

- Solo `main`; sin ramas/PR/reset duro.
- `LEYENDA_ESTIMACION`, `packages/core` E*, vectores a mano.
- `PreviaWidget` / `widget.test` salvo pedido explícito.
- Credenciales fuera del repo.

## Estimación rápida

FinanVoz código ~95 %; UI onboarding/R2/formulario alineada al sistema; camino tienda ~70 %.
