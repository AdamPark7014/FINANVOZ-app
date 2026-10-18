# Progreso del plan megaprompt (FinanVoz · 2026-10-17)

Documento de una página tras oleadas **W1–W9** y **V1–V20** en `FINANVOZ-app`. La fábrica **PRODUCTOS-apps** y **RestaurantOS** están fuera de este repo ([`C:\dev\apps\PRODUCTOS-apps\INDICE.md`](../../PRODUCTOS-apps/INDICE.md)).

## Resumen ejecutivo

| Track | % | Qué significa |
|---:|---:|---|
| **1 · FinanVoz first** | **68 %** | Spec M0–M16 (Android v1): motores y app casi completos en CI; falta lo que solo Adam/terceros cierran (M0 web, cuentas, teléfono, legal, fiscal, tienda). |
| **2 · Estándar** | **45 %** | `docs/ESTADO.md`, `docs/LANZAMIENTO.md`, relevo FUSION, checklist por sentadas; CI casi verde (2 tests flaky/fallando hoy). |
| **3 · Fábrica** | **12 %** | Decisión de coexistencia FinanVoz ↔ portfolio; sin `apply.mjs` sobre este monorepo. |
| **4 · RestaurantOS** | **8 %** (piloto) / **maduro aparte** | Piloto `products/restaurant-os/` stub; vertical `food/RestaurantOS` ya materializado en otro repo (no es meta de FinanVoz). |

**Plan completo (ponderado FinanVoz-first 60 %): ~52 %.** Objetivo «70 % en 2 días» se cumple en **lado código FinanVoz (~92 %)**; no en ** lanzamiento medible (~35 %)**.

## 1 · FinanVoz — desglose

| Ámbito | % | Hecho | Falta |
|---|---:|---|---|
| Código agentes (M1–M16 scope v1 Android) | **92** | Pendientes de **código** 16, 30–31, 33–34, 40–42, 47, 57, 63–66, 74, 79, 84*, 87, 99, 113, 148–149, pulido voz/SEO, EAS config en repo | 84 texto legal en Play; teléfono; plantillas reales (3); MSI previos UI (M4); algunos betas (67, 75) |
| M0 calculadora pública | **75** | E10, lista, aviso, CI Lighthouse, workflow Pages, OPTIONS lista-espera, og/SEO, aviso web m8 | **Adam:** 11–12 (Supabase + dominio + secrets + primer deploy) → CA-M0-06 |
| Beta / tienda (M7–M13) | **35** | RevenueCat/webhook en código, privacidad centro, ayuda, tienda borrador, accesibilidad jest | **Adam:** Play, RC, PostHog, probadores, capturas, despliegue escalonado, Sentry real |
| Validación dispositivo | **15** | Semillas, jest-expo, spikes documentados | **Adam:** builds EAS, adb, Maestro, dos teléfonos M16, mediciones RNF |

\*84: copy y `VERSION_CONSENTIMIENTO` en app; falta revisión abogado + Data safety.

## 2 · Estándar

- **Hecho:** megaprompt operativo (solo `main`, oleadas por archivos, relevo, LANZAMIENTO por sentadas, cierre pendientes en ESTADO 2026-10-17).
- **Falta:** commit de relevo al cerrar cada turno; suite `pnpm test` 100 % estable; EXEC-PACKET cuando haya arquitectura dura; no mezclar tracks en un solo commit.

## 3 · Fábrica y 4 · RestaurantOS

- **Hecho (otro repo):** ADR portfolio, `restaurant-os` piloto saas-ai, `food/RestaurantOS` referencia F4.
- **No hecho:** aplicar fábrica a FinanVoz; gate demo RestaurantOS desde FinanVoz; unificar marcas más allá de nombre comercial Finanvoz.

## Lo que solo Adam puede hacer (bloqueos críticos)

1. **M0 (urgente, 6 nov):** Supabase proyecto + `lista-espera` + `finanvoz.com` + GitHub env `produccion` + publicar calculadora (`docs/LANZAMIENTO.md`).
2. **Cuentas (pendiente 10):** Expo/EAS, Google Play, Supabase prod, RevenueCat, PostHog, LLM keys.
3. **Contador (90–93):** validar `config/fiscal/2026.json` → deducciones y M13.
4. **Abogado (4, 26, 54, 61, 103):** aviso integral app+web, respaldo, CFDI, explicar, términos.
5. **Android físico:** checklist teléfono en ESTADO (13+, 28, 44–46, 76–77, 107, 140–141).
6. **Operación Supabase:** desplegar funciones/migraciones; ejecutar `limpiar-anonimos.mjs`; buckets plantillas/respaldo.
7. **Plantillas captura / PDF:** muestras reales anonimizadas (probador + contador donde aplique).

## Referencias

- Tablero hitos: `docs/ESTADO.md`
- Ruta externa: `docs/LANZAMIENTO.md`
- Handoff agentes: `.ai/RELEVO.md`
- Portfolio: `C:\dev\apps\PRODUCTOS-apps\_factory\PORTFOLIO_STATUS.md`
