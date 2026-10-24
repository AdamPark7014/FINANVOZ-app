# RELEVO

- **Último turno:** cursor
- **Fecha:** 2026-10-24
- **Rama:** main

## Hecho en este turno

- Oleada UI del día cerrada en `main` (`0ae2f0b`…`178a015`): onboarding → kit → pantallas → voz/Hoy.
- **Norte de producto (Adam, voz):** app que se siente trivial (hablar y listo) con motores/proxy/libro pesados detrás. Eso ya es la promesa del PRD («Hoy puedes», captura sola, NLU que interpreta y `core` que calcula). No inventar alcance fuera de `01-PRD.md`.

## A medias

- Ola 7 + UI **sin probar en teléfono** (TestFlight 4 / Play 2).
- Proxy con reintento: falta redesplegar en Hetzner.
- M0 bloqueado por externos (dominio, lista de espera, responsable del aviso).

## Siguiente (orden que mueve la visión sin romper el PRD)

1. **Adam en teléfono** — TestFlight/Play: ¿la voz cubre el día real sin tocar formularios?
2. **Cerrar salida v1 (M13 externos)** — M0 publicado, legal, Data safety, proxy producción.
3. **Profundizar voz (si el teléfono pide más)** — más intenciones nivel 0/baratas; menos R2; confirmar por voz en más flujos; zero-tap tras captura.
4. **Lo que la visión pide y el PRD aún no permite** (decidir con Claude Max / packet, no inventar):
   - Web con el mismo libro → hoy no hay app web de libro (solo calculadora M0 + respaldo).
   - «Facturar por voz» / emitir CFDI → **fuera de alcance** (`01 §` exclusiones); M12 solo **importa** facturas y estima deducciones.
   - «Todo el planeta» → producto es **México, personas físicas** (y Negocio M11 si se valida).
   - Contabilidad + SAT automático completo → camino M11/M12, no un ERP.

## No tocar

- Solo `main`; sin ramas/PR/reset duro.
- `LEYENDA_ESTIMACION`, `packages/core` E*, vectores a mano.
- Emitir facturas / declaraciones / open banking con password del banco sin cambio de spec + legal.
- Credenciales fuera del repo.

## Estimación rápida

FinanVoz código ~95 %; UI voz-first renovada; camino tienda ~70 %. El salto a «voz = toda la vida financiera + web + facturar» es producto/legal, no otra pasada de padding.
