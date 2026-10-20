# RELEVO

- **Último turno:** claude-code
- **Fecha:** 2026-10-19
- **Rama:** main

## Hecho en este turno

- **M4 · "Agregar meses que ya tenía" en una tarjeta existente (`02 §8`):** servicio `agregarMsiQueYaTenia`
  (`servicios/onboarding.ts`, comparte `registrarPlanesExistentes` con O4). "Sí, ya lo incluye" baja la deuda
  revolvente con una conciliación (caso 22), nunca a saldo a favor; "No"/"No sé" no la bajan y "No sé" deja el aviso.
  UI: botón y formulario en Meses sin intereses del detalle (`MesesYPagos.tsx`). Pruebas en `onboarding.test.ts`
  y `tarjetas.test.tsx`. Decisión en `docs/ESTADO.md`.
- Vitest móvil 792/792, jest tarjetas 30/30, typecheck en verde.

## Hecho (acumulado reciente)

- `cf82d6a` main a verde y APK reparado; TalkBack en todas las pantallas (N579–N603). Ver `git log`.

## A medias — CUIDADO

- `pnpm lint` en la raíz falla por borradores de Ollama sin trackear en `.ai/drafts/` (no es código del repo).
- M0 / EAS: Adam.

## Siguiente paso

1. Adam — M0 (pendientes 11 y 12: Supabase + `finanvoz.com`), antes del 6 nov.
2. Adam — cuentas Expo/Play/RevenueCat/PostHog, contador (`config/fiscal/2026.json`), abogado, pruebas en teléfono.
3. Código que queda: plantillas y analizadores PDF con datos reales de probadores; iPhone (v2).

## No tocar

- Solo `main`; sin ramas/PR/reset duro sin Adam.
- `LEYENDA_ESTIMACION` (`08 §1`) literal.
- `packages/core` E*, vectores a mano.
- `PreviaWidget` / `widget.test` salvo pedido explícito.

## Estimación rápida

FinanVoz código ~94 %; camino tienda ~36 %. Detalle: `docs/PROGRESO-70.md`.
