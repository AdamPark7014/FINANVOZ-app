# Progreso del plan megaprompt (FinanVoz · 2026-10-17)

Documento denso tras oleadas **W1–W9** y **V1–V20** en `FINANVOZ-app`. Fábrica **PRODUCTOS-apps** y **RestaurantOS** viven fuera ([`C:\dev\apps\PRODUCTOS-apps\INDICE.md`](../../PRODUCTOS-apps/INDICE.md)).

**HEAD de referencia:** `b852b4a` (`fix(movil): estabiliza RNF-01 Node y publicar-ejemplos sin sh`). Tablero vivo: `docs/ESTADO.md` · Ruta externa: `docs/LANZAMIENTO.md` · Handoff: `.ai/RELEVO.md`.

---

## H9 · Analítica (flake)

| Veredicto | Detalle |
|---|---|
| **Estable** | Sin flake reproducible en analítica/corrección (2026-10-17). Jest móvil `testPathPattern=analitica`: **8/8**. Vitest `analitica.test.ts` + lista blanca: **11/11** en corrida acotada. |

**Paths clave:** `apps/movil/src/pantallas/principal/ConfirmacionRegistro.tsx` (`EnlaceAnaliticaCorreccion`), `apps/movil/src/servicios/correcciones.ts` (`enlaceAnaliticaCorreccion`, `camposCorreccionAnalitica`), tests `analitica-correccion-voz.test.tsx`, `analitica-captura.test.tsx`, `pantallas/analitica.test.tsx`, `src/analitica/analitica.test.ts`, `src/analitica/eventos.ts`, `src/servicios/explicar.test.ts` (evento `modo_explicar`).

**No confundir con:** flake histórico de **RNF-01** (`rendimiento.test.ts`, E4/E8 bajo carga) — mitigado en `b852b4a` pero puede fallar en Windows lento; suites **proxy** PGlite (`compartido/rls`, etc.) por timeout de entorno.

---

## Tabla de avance (%)

| Métrica | % | Qué cuenta |
|---:|---:|---|
| **Código implementado** (M0–M16 scope v1 Android en `main`) | **~93** | Motores, proxy, app, captura, respaldo, M15/M16 adelantados; CI Node/jest/JVM/PGlite. Resto de código: plantillas captura/PDF reales (datos), UI «meses que ya tenía» en tarjeta existente (M4), pendientes 62/123/124/128/129/151 (v2 iPhone), 100 (solo si M11), 109 (versión 1.0.0 al cortar prod), 88/152 (ajustes post-benchmark). |
| **Plan megaprompt ponderado** (FinanVoz-first **60 %** + estándar 15 % + fábrica 15 % + RestaurantOS 10 %) | **~53** | FinanVoz track **~69 %** ×0.6 + estándar **~48 %** ×0.15 + fábrica **~12 %** ×0.15 + RestaurantOS piloto **~8 %** ×0.10 ≈ **53 %**. |
| **Launch-ready** (medible en producción: web M0 + beta/tienda + legal/fiscal + teléfono) | **~36** | M0 sin URL pública (11–12); app sin EAS preview ni Play; Supabase prod sin desplegar; contador/abogado; ~150 pendientes «Adam/teléfono/terceros» en ESTADO. |

### Tracks del megaprompt

| Track | % | Nota |
|---:|---:|---|
| 1 · FinanVoz first | **69** | Código ~93 %; camino a tienda ~36 % |
| 2 · Estándar | **48** | ESTADO/LANZAMIENTO/relevo; analítica estable (H9); CI global: RNF-01/proxy PGlite según máquina |
| 3 · Fábrica | **12** | PRODUCTOS ~48–51 % overall (otro repo); ADR coexistencia; sin `apply.mjs` sobre este monorepo |
| 4 · RestaurantOS | **8** (piloto) | Stub en portfolio; `food/RestaurantOS` maduro aparte |

Objetivo «70 % en 2 días»: **cumplido en código FinanVoz**; **no** en lanzamiento medible ni en plan four-track completo.

---

## Oleadas W / V (paths en repo)

| Oleada | Qué | Paths (muestra) |
|---|---|---|
| **W1–W9** | NLU/proxy, pulido móvil, avisos, captura, analítica lista blanca, build | `services/proxy/supabase/functions/nlu-interpretar/`, `apps/movil/src/avisos/rutas.ts`, `apps/movil/src/captura/tarea.ts`, `apps/movil/src/analitica/`, `apps/movil/src/servicios/correcciones.ts`, `apps/movil/app.config.ts`, `eas.json`, `apps/calculadora/` |
| **V1–V20** | Personas/tandas, suscripciones, widget, explicar, deducciones, E8 SQL, compartido | `apps/movil/src/pantallas/personas/`, `apps/movil/src/pantallas/tandas/`, `apps/movil/src/tareas/diaria.ts`, `apps/movil/src/widget/`, `apps/movil/src/servicios/explicar.ts`, `apps/movil/src/servicios/historial.ts`, `packages/sincronizacion/`, `packages/core/src/simulador/` |

---

## Bloqueo Adam · M0 (pendientes 11 y 12)

**CA-M0-06** (URL pública antes del **6 nov 2026**) no cierra hasta esto. El código de calculadora, E10, lista-espera, aviso NEXARA, workflow Pages y Lighthouse CI están en `main`.

| # | Acción (Adam) | Dónde |
|---|---|---|
| **11** | Crear proyecto **Supabase** y desplegar Edge Function **`lista-espera`** (migraciones + secretos de sal IP) | `services/proxy/README.md` |
| **12** | Comprar **`finanvoz.com`** en Cloudflare; proyecto **Pages** `finanvoz`; en GitHub entorno **`produccion`**: secretos `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`; variables `VITE_LISTA_ESPERA_URL`, `VITE_RESPONSABLE_*`; ejecutar workflow **«Publicar calculadora»** | `docs/LANZAMIENTO.md` sentada 1 (copy-paste en `297e605`) |

Sin 11–12: no hay lista de espera real, no hay validación de demanda M0, y M3/M9/M10/M16 comparten el mismo Supabase pendiente de crear.

---

## Hitos M0–M16 (una línea)

| Hito | Estado | Línea |
|---|---|---|
| **M0** | Parcial | Código listo (E10, formulario, aviso web m8); **bloqueado 11–12** → CA-M0-06 |
| **M1** | Hecho | Cerrado 2026-10-12; oráculo + motores + datos + NLU reglas |
| **M2** | Parcial | Código Node/jest completo; cierra **teléfono** (13, Maestro ≤4 min) |
| **M3** | Parcial | Proxy/app en repo; cierra **Supabase + benchmark `--grabar`** (14) |
| **M4** | Parcial | Código + CA-M4-01 estable; avisos en dispositivo (13); MSI previos post-O4 sin UI |
| **M5** | Parcial | Ingesta/arqueo en CI; **plantillas reales** (3, CA-M5-07) + **adb** (15) |
| **M6** | Parcial | E8 vectores OK; **E8 &lt;150 ms en teléfono** (18) |
| **M7** | Parcial | RC/webhook/privacidad en código; Play, legal, PostHog, probadores (20–29) |
| **M8** | Parcial | Personas/tandas en jest; validación voz real y notificaciones (32, 43) |
| **M9** | Parcial | `.cartera` + UI en jest; Supabase respaldo (52–53), quick-crypto teléfono (44–46, 59–60) |
| **M10** | Parcial | E14, widget, explicar, plantillas en código; llaves 70–72, despliegue, legal 84/26 |
| **M11** | Saltado | Sin demanda (`10 §1`); retomar tras lista/beta |
| **M12** | Parcial | App + motores jest; **`config/fiscal/2026.json` sin validar** (90–93) bloquea cifras reales |
| **M13** | Parcial | Ayuda, RNF en Node, borradores tienda; ficha, capturas, escalonado, Sentry prod (101–114) |
| **M14** | Pendiente | iPhone v2 |
| **M15** | Parcial | PDF sintético + analizadores en CI/JVM; bancos reales (122), teléfono (120–121) |
| **M16** | Parcial | E17 + pantallas en PGlite; dos teléfonos + Supabase `compartido` (140–142) |

---

## Solo código (agentes) vs espera humana

### Aún solo código (prioridad baja hasta desbloqueos)

| Ítem | Hito | Nota |
|---|---|---|
| UI «Agregar meses que ya tenía» en tarjeta existente | M4 | Decisión 2026-10-12; hoy solo en alta O4 |
| `reales.json` + ejemplos cuando Adam/probadores entreguen notificaciones | M5 | Motor listo; pendiente **3** |
| Analizadores PDF reales | M15 | pendiente **122** |
| Pendientes **123**, **128** (MSI/corte PDF), **124** (vigilancia PdfBox) | M15 | |
| **109** versión 1.0.0 al cortar build prod | M13 | Con Adam |
| **88** cupo explicar por turno; **152** modelos NLU tras llaves Adam | M10/M3 | |
| **75** paquetes nuevos en `<queries>` vs plantillas remotas | M10 | Decisión producto |
| **62**, **129**, **151** | M14 | iPhone v2 |
| **100** paquete contador negocio | M11 | Solo si se retoma M11 |

### Espera humana (no desbloquea agentes en vacío)

| Bloque | Pendientes clave | Quién |
|---|---|---|
| **M0 web** | **11**, **12** | Adam |
| **Cuentas** | **10**, Expo `eas init`, preview/prod | Adam |
| **Supabase prod** | **14**, **52–53**, **57** (ejecutar script), **83**, **142**, funciones NLU/respaldo/compartido/plantillas | Adam |
| **Play / tienda** | **20–29**, **101–104**, **112** | Adam + abogado |
| **Legal** | **4**, **26**, **54**, **61**, **84** (visto bueno), **103**, **125**, **143–144** | Abogado + Adam |
| **Fiscal** | **90–93** | Contador |
| **Teléfono Android** | **13–15**, **18**, **32**, **43–46**, **59–60**, **64**, **76–77**, **86**, **96–98**, **107**, **110**, **120–121**, **140–141** | Adam + RC |
| **Muestras reales** | **3** (notificaciones), **122** (PDF), **8** (llave plantillas) | Probadores + Adam |
| **Beta producto** | **67**, **108** | Post-probadores |
| **Megaprompt fuera repo** | Fábrica / RestaurantOS | `PRODUCTOS-apps` |

---

## Últimos commits relevantes (`git log --oneline -15`)

```
b852b4a fix(movil): estabiliza RNF-01 Node y publicar-ejemplos sin sh
ded5bd9 docs: estimacion de avance del plan megaprompt (~70%)
6a12da8 docs(movil): guia Maestro y test del cupo en manejador LLM
f428885 feat(nlu): constante y tests del cupo de interpretaciones por explicar
5be528d test(movil): flujos Maestro onboarding, gasto efectivo y arqueo
297e605 docs: sentada 1 copy-paste y cierra 57/78/87/84 en ESTADO
2cdf03b feat(calculadora): publica aviso integral alineado con VERSION m8
91d8138 test(movil): estabiliza CA-M4-01 evitando 226 aperturas dia a dia
1e73f7b docs(lanzamiento): app.config y eas.json hechos en codigo
fdc490b docs(estado): cierra pendientes 41, 87, 84 codigo, 113 y 57 en documentacion
3b25f12 feat(movil): escenario semilla e14-01 para suscripciones
04614e1 feat(movil): preview del widget Hoy puedes para el lanzador
b411d05 feat(proxy): script y RPC para limpiar anonimos huérfanos
7534cb3 feat(movil): aviso m8 cubre modo explicar y sube VERSION_CONSENTIMIENTO
df2a218 feat(movil): analitica modo_explicar con resultado y vueltas
```

---

## Top 5 siguientes (orden recomendado)

1. **Adam · M0 (11–12):** Supabase + `lista-espera` + `finanvoz.com` + secrets GitHub + primer deploy calculadora (`LANZAMIENTO` sentada 1).
2. **Adam · Cuentas (10):** mismo Supabase para app; `eas init` + build **preview** con `EXPO_PUBLIC_*` (sentada 2).
3. **Adam · Supabase prod:** migraciones + `nlu-interpretar`, `respaldo`, `compartido`, `llm-turno`; benchmark `--grabar` (14, 82, 152).
4. **Adam · Android:** Maestro onboarding + captura `adb` + mediciones RNF (13–15, 18) con guía Maestro (`6a12da8`).
5. **Terceros · legal/fiscal:** contador 90–93 + abogado 26/84/103 (bloquean deducciones reales y texto Play).

---

## Referencias

- Tablero: `docs/ESTADO.md`
- Lanzamiento: `docs/LANZAMIENTO.md`
- Roadmap: `docs/09-ROADMAP.md`
- Portfolio: `C:\dev\apps\PRODUCTOS-apps\_factory\PORTFOLIO_STATUS.md`
