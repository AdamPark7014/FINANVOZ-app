# RELEVO

- **Último turno:** cursor
- **Fecha:** 2026-10-17
- **Rama:** main

## Hecho en este turno

- **PantallaCuentas:** vacíos con `etiquetaVacioCuentas*` + `EstadoVacio.etiquetaAccesible`; `cuentas-titulo` y `seccion-*-titulo` header; botones Cobrar/Ver/Contar con etiqueta TalkBack contextual (ya en `e605751` / batch previo).
- **principal.test:** aserción de saldo BBVA usa el nombre real de la cuenta en e4-01 (no asumir «BBVA» corto).

## Hecho (acumulado reciente)

- Deducciones, tabs, onboarding/captura, Chip. Ver `git log`.

## A medias — CUIDADO

- Pantallas negocio (M11) aún no en UI; paquete contador pendiente de hito.
- CI Windows: `publicar-ejemplos`, RNF-01.
- M0 / teléfono / fiscal params: Adam.

## Siguiente paso

1. Adam — M0 / EAS.
2. Centralizar copy O3–O7 restante en `onboarding/textos.ts`.
3. M11 negocio cuando toque el hito.

## No tocar

- Solo `main`; sin ramas/PR/reset duro sin Adam.
- `LEYENDA_ESTIMACION` (`08 §1`) sin cambiar palabra.
- `packages/core` E*, vectores a mano.

## Estimación rápida

FinanVoz código ~92 %; camino tienda ~35 %. Detalle: `docs/PROGRESO-70.md`.
