# RELEVO

- **Último turno:** cursor
- **Fecha:** 2026-10-17
- **Rama:** main

## Hecho en este turno

- **¿Me alcanza?:** `PISTA_CALCULAR` en botón Calcular (TalkBack `02 §19`); prueba en `me-alcanza.test.tsx`.
- **Captura:** copy de `cuenta_nueva` centralizado en `captura/textos.ts` (`PreguntasCaptura`).
- **Respaldo nube:** `PISTA_RESPALDAR_AHORA` en «Respaldar ahora» (ya cubierta en `respaldo-nube.test.tsx`).
- **Widget:** prueba previa usa constante `PISTA_PREVIA` de `widget-textos.ts`.

## Hecho (acumulado reciente)

- Chip/GrupoChips TalkBack, ajustes header, EstadoVacio/Boton/Campo, suscripciones live region. Ver `git log`.

## A medias — CUIDADO

- WIP mencionado antes (`PantallaTanda`, `EstadoVacio`, etc.) — revisar disco antes de reescribir.
- CI Windows: `publicar-ejemplos`, RNF-01.
- M0 / teléfono / fiscal: Adam.

## Siguiente paso

1. Adam — M0 / EAS.
2. Centralizar copy O3–O7 restante en `textos.ts` por pantalla.
3. Más pistas TalkBack en CTAs secundarios (personas cobrar, etc.) si hace falta otro pase M13.

## No tocar

- Solo `main`; sin ramas/PR/reset duro sin Adam.
- `packages/core` E*, vectores a mano.

## Estimación rápida

FinanVoz código ~92 %; camino tienda ~35 %. Detalle: `docs/PROGRESO-70.md`.
