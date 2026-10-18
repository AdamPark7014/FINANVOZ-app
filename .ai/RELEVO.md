# RELEVO

- **Último turno:** cursor
- **Fecha:** 2026-10-17
- **Rama:** main

## Hecho en este turno

- **Onboarding O3/O4:** copy de ingreso y cuentas centralizado en `onboarding/textos.ts` (pantallas, tips, botones, formulario). Eliminado reexport circular `textos` ↔ `tips`; `tips.ts` reexporta O3–O7 desde `textos`. Tests onboarding en verde.

## Hecho (acumulado reciente)

- O5/O7 en `textos.ts`, tabs TalkBack, personas/widget. Ver `git log`.

## A medias — CUIDADO

- WIP ajeno: deducciones/tarjetas TS móvil — no mezclar.
- CI Windows: `publicar-ejemplos`, RNF-01.
- M0 / teléfono / fiscal: Adam.

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
