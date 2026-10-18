# RELEVO

- **Último turno:** cursor
- **Fecha:** 2026-10-17
- **Rama:** main

## Hecho en este turno

- **Personas:** `persona-movimientos-titulo` con rol header; prueba en `personas.test.tsx`.
- **Tandas:** `tandas-titulo` con `accessibilityRole="header"` (paridad con test).
- **Onboarding:** tips O3–O7 viven en `textos.ts`; `tips.ts` reexporta sin ciclo con `textos`.
- **Principal:** aserción de cuentas usa `listarCuentas` con nombre real del escenario.

## Hecho (acumulado reciente)

- Tabs TalkBack, deducciones copy, PreviaWidget, captura. Ver `git log`.

## A medias — CUIDADO

- CI Windows: `publicar-ejemplos`, RNF-01.
- M0 / teléfono / fiscal: Adam.
- Pantallas negocio (M11) aún no en UI.

## Siguiente paso

1. Adam — M0 / EAS.
2. Centralizar tips O2/O6 en `textos` si se quiere un solo módulo.
3. M11 negocio cuando toque el hito.

## No tocar

- Solo `main`; sin ramas/PR/reset duro sin Adam.
- `LEYENDA_ESTIMACION` (`08 §1`) sin cambiar palabra.
- `packages/core` E*, vectores a mano.

## Estimación rápida

FinanVoz código ~92 %; camino tienda ~35 %. Detalle: `docs/PROGRESO-70.md`.
