# RELEVO

- **Último turno:** cursor
- **Fecha:** 2026-10-17
- **Rama:** main

## Hecho en este turno

- **Pestañas (`pestanas-textos`):** botones con rol `tab` y etiqueta «Pestaña …»; contenedores de ruta con `ETIQUETA_ACCESIBILIDAD_CONTENIDO_PESTANA` (sin prefijo duplicado en TalkBack).
- **`_layout` / pruebas:** mocks de rutas sin repetir títulos de pestaña; `pestanas-textos.test.tsx` alinea `barraPestanas`, testID y props de contenedor.

## Hecho (acumulado reciente)

- Widget/captura/respaldo pistas TalkBack, onboarding copy, Chip, EstadoVacio/Boton/Campo. Ver `git log`.

## A medias — CUIDADO

- WIP local en disco (onboarding, captura, cuentas, widget) — revisar `git status` antes de reescribir.
- CI Windows: `publicar-ejemplos`, RNF-01.
- M0 / teléfono / fiscal: Adam.

## Siguiente paso

1. Adam — M0 / EAS.
2. Commitear o descartar WIP ajeno a pestañas si sigue sucio.
3. Centralizar copy O3–O7 restante en `textos.ts` por pantalla.

## No tocar

- Solo `main`; sin ramas/PR/reset duro sin Adam.
- `packages/core` E*, vectores a mano.

## Estimación rápida

FinanVoz código ~92 %; camino tienda ~35 %. Detalle: `docs/PROGRESO-70.md`.
