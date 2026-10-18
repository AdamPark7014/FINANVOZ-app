# RELEVO

- **Último turno:** cursor
- **Fecha:** 2026-10-17
- **Rama:** main

## Hecho en este turno

- **deducciones:** empty state es-MX — `TEXTO_FACTURAS_VACIO` / `TEXTO_IMPORTAR_VACIO`, `deducciones-sin-facturas` / `importar-vacio`, test en `deducciones.test.tsx`.

## Hecho (acumulado reciente)

Ver `docs/ESTADO.md` y `git log` (empty states tandas/personas/suscripciones, ¿Me alcanza?, captura O6, etc.).

## A medias — CUIDADO

- CI: `publicar-ejemplos.test.ts` y `rendimiento.test.ts` (RNF-01) pueden fallar en Windows.
- M0 / Expo / teléfono / legal / fiscal: sin cambio (Adam).
- `semilla.ts` / `semilla.test.ts`: typecheck preexistentes en movil (no tocados).
- Otro agente: cambios sin commitear en ajustes/ingreso — no mezclar.

## Siguiente paso

1. Adam — M0 y EAS (LANZAMIENTO sentadas 1–2).
2. Teléfono — CA-M12-02 importar facturas.
3. Commits pequeños por oleada de copy en working tree.

## No tocar

- Solo `main`; sin ramas/PR/reset duro sin Adam.
- `packages/core` E*, `eas.json`, `app.config`, vectores a mano.
- Working tree ajeno sin commitear salvo el pedido del turno.

## Estimación rápida

FinanVoz código ~92 %; camino tienda ~35 %. Detalle: `docs/PROGRESO-70.md`.
