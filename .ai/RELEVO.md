# RELEVO

- **Último turno:** cursor
- **Fecha:** 2026-10-18
- **Rama:** main

## Hecho en este turno

- **ProbabilidadHoy / riesgo:** copy centralizado en `textos.ts` (`TEXTO_AVISO_RIESGO_HOY`); aviso con `tono="faltante"` y `importantForAccessibility="yes"` para TalkBack al aparecer bajo P < 50 %.

## Hecho (acumulado reciente)

- Marca 50 % en barra, `FRASE_MARCA_PROBABILIDAD`, PreviaWidget, Chip hints. Ver `git log`.

## A medias — CUIDADO

- WIP paralelo (onboarding, captura, suscripciones, movimientos, etc.) — no mezclar en commits ajenos.
- M0 / EAS: Adam.

## Siguiente paso

1. Adam — M0 / EAS.
2. TalkBack aviso retiro tarjeta en formulario movimiento o `CampoMonto` deshabilitado.

## No tocar

- Solo `main`; sin ramas/PR/reset duro sin Adam.
- `LEYENDA_ESTIMACION` (`08 §1`) literal.
- `packages/core` E*, vectores a mano.

## Estimación rápida

FinanVoz código ~92 %; camino tienda ~35 %. Detalle: `docs/PROGRESO-70.md`.
