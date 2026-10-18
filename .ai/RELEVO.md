# RELEVO

- **Último turno:** cursor
- **Fecha:** 2026-10-18
- **Rama:** main

## Hecho en este turno

- **Onboarding (móvil):** TalkBack en `PasoOnboarding` — anuncio y foco al entrar a cada paso; encabezado, ayuda, progreso con label/hint; pistas en chips y casillas; tests `componentes.test.tsx` y textos.

## Hecho (acumulado reciente)

- Calculadora lista espera a11y, TalkBack otras pantallas móvil. Ver `git log`.

## A medias — CUIDADO

- WIP sin commitear en disco: `arqueo`, `ayuda`, `compartido`, `estados-cuenta`, `me-alcanza`, `personas`, `tandas` (TalkBack paralelo) — no mezclar con onboarding ya en `fe87f5e`.
- M0 / EAS: Adam.

## Siguiente paso

1. Commitear o salvar el WIP paralelo de pantallas (ver `git status`).
2. Adam — M0 / EAS.
3. TalkBack aviso «No sé» tarjeta en `FormularioTarjetaNueva`.

## No tocar

- Cambios unstaged fuera de onboarding hasta que el otro agente los salve o commitee.
- Solo `main`; sin ramas/PR/reset duro sin Adam.
- `LEYENDA_ESTIMACION` (`08 §1`) literal.
- `packages/core` E*, vectores a mano.
- `PreviaWidget` / `widget.test` salvo pedido explícito.

## Estimación rápida

FinanVoz código ~92 %; camino tienda ~35 %. Detalle: `docs/PROGRESO-70.md`.
