# RELEVO

- **Último turno:** cursor
- **Fecha:** 2026-10-17
- **Rama:** main

## Hecho en este turno

- **PanelRegistrar / cupo:** `esMensajeRegistroAlerta` en `principal/textos.ts`; mensajes de cupo del intérprete en `mensaje-registro` con `accessibilityRole="alert"` (CA-M7-02). **TarjetaExplicacion:** cupo en modo explicar también como alert. Pruebas en `plan.test.tsx` y `explicar.test.tsx`.

## Hecho (acumulado reciente)

- Chip TalkBack, live region suscripciones, oleada N principal. Ver `git log`.

## A medias — CUIDADO

- WIP local sin commitear (turno anterior): ajustes/widget, `EditarTarjeta`, `Chip.test`, etc. — no mezclar.
- CI Windows: `publicar-ejemplos`, RNF-01.
- M0 / teléfono / fiscal: Adam.

## Siguiente paso

1. Adam — M0 / EAS.
2. Commitear o descartar WIP ajeno.

## No tocar

- Solo `main`; sin ramas/PR/reset duro sin Adam.
- `packages/core` E*, vectores a mano.

## Estimación rápida

FinanVoz código ~92 %; camino tienda ~35 %. Detalle: `docs/PROGRESO-70.md`.
