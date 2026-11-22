# RELEVO

- **Último turno:** cursor
- **Fecha:** 2026-11-22
- **Rama:** main
- **Tarea:** Noche CONTINUAR admin Prospectos (hoja perdido + tests). SIN git write / SIN push / SIN deploy.

## Hecho

- Prospectos: hoja «Marcar perdido» (motivo opcional) + `etiquetaSiguientePaso` en `prospectosFecha.ts`.
- Pruebas: `prospectosFecha.test.ts`, `Prospectos.test.tsx`.
- Verificado: `pnpm exec vitest run src/admin` **30/30**; `pnpm typecheck` web OK.
- Reporte: `C:\dev\apps\PRODUCTOS-apps\.ai\noche-2026-11-21\reportes\FINANVOZ.md`.
- Este turno **no** hizo add/commit/push (pedido: coordinador rescata).

## A medias

- `HojaPerdido.tsx` suelto duplica la hoja inline de `Prospectos.tsx` (coordinador: importar o borrar).
- Sin commit local de los archivos `??` / `M` de este turno.

## Siguiente

1. Coordinador: commit pathspecs admin web + reporte; sin push hasta cierre global.
2. Adam: precios/comisión, dominio venta, OK migración admin + Edge `prospecto` + publicar.
3. Builds móvil TestFlight/AAB con plática (fuera de este turno).

## No tocar

- Solo `main`; sin push/deploy sin orden.
- `packages/core` E*; `PreviaWidget`; secretos; tope puerta `pruebas`.
- No matar Ollama.
