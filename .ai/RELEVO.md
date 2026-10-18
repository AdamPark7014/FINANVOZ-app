# RELEVO

- **Último turno:** cursor
- **Fecha:** 2026-10-17
- **Rama:** main

## Hecho en este turno

- **Fiscal (`02 §24`, M12):** copy pulido en `deducciones/textos.ts`, `MENSAJE_SIN_PARAMETROS`, FAQ en `ayuda/textos.ts`, `BTN_DEDUCCIONES_CUENTAS` en Cuentas; pruebas anclan título/descripción Plus y CTA desde Cuentas.
- **Negocio (M11):** sin pantallas en app; nada que pulir en UI.

## Hecho (acumulado reciente)

- TalkBack headers (arqueo, deducciones, plan, persona); tabs/hoy/suscripciones; onboarding/widget. Ver `git log`.

## A medias — CUIDADO

- WIP en disco (personas, onboarding, widget) — no mezclar sin leer diff.
- CI Windows: `publicar-ejemplos`, RNF-01.
- M0 / teléfono / fiscal params: Adam.

## Siguiente paso

1. Adam — M0 / EAS.
2. M11 negocio + paquete contador cuando toque el hito.
3. Centralizar copy O3–O7 restante en `onboarding/textos.ts`.

## No tocar

- Solo `main`; sin ramas/PR/reset duro sin Adam.
- `LEYENDA_ESTIMACION` (`08 §1`) sin cambiar palabra.
- `packages/core` E*, vectores a mano.

## Estimación rápida

FinanVoz código ~92 %; camino tienda ~35 %. Detalle: `docs/PROGRESO-70.md`.
