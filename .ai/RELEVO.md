# RELEVO

- **Último turno:** cursor
- **Fecha:** 2026-10-17
- **Rama:** main

## Hecho en este turno

- **movil Hoy:** título/subtítulo del héroe en `principal/textos.ts` (`TITULO_*`, `SUBTITULO_SIN_INGRESO`, contexto TalkBack en libre negativo); `PantallaHoy.tsx` enlazado; subtítulo sin ingreso «hasta el próximo pago» (en `main` vía c1f91cb).

## Hecho (acumulado reciente)

¿Me alcanza? CTAs centralizados; tips O7; copy confirmación registro. Ver `docs/ESTADO.md` y `git log`.

## A medias — CUIDADO

- CI: `publicar-ejemplos.test.ts` y `rendimiento.test.ts` (RNF-01) pueden fallar en Windows.
- M0 / Expo / teléfono / legal / fiscal: sin cambio (Adam).
- `semilla.ts` / `semilla.test.ts`: typecheck preexistentes en movil (no tocados).
- Otro agente: ~15 archivos sin commitear en movil (principal, personas, respaldo, onboarding, ajustes) — no mezclar.

## Siguiente paso

1. Adam — M0 y EAS (LANZAMIENTO sentadas 1–2).
2. Teléfono — validar flujo compartido con cámara (140–141).
3. Commits pequeños por oleada de copy en working tree.

## No tocar

- Solo `main`; sin ramas/PR/reset duro sin Adam.
- `packages/core` E*, `eas.json`, `app.config`, vectores a mano.
- Working tree ajeno sin commitear salvo archivo pedido en el turno.

## Estimación rápida

FinanVoz código ~92 %; camino tienda ~35 %. Detalle: `docs/PROGRESO-70.md`.
