# docs/diseno

Maquetas que Adam aprueba antes de construir (regla: nada visual grande se construye a ciegas; `docs/PLAN-MEJORA-2026-10.md`, Ola 4 y decisión 2).

| Archivo | Qué es |
|---|---|
| `mockups-asistente.html` | Mockups de alta fidelidad del asistente de voz en marcos de iPhone (390 × 844): Hoy A/B/C, Registrar R1/R2 (más R2 con teclado), estados «escuchando» y «no entendí», conversación en vez de formulario (tarjeta), onboarding por voz (2 pantallas), arqueo por voz, pestañas reducidas y vacíos, y la tabla «Qué elegir» con la recomendación. Un solo archivo, sin dependencias salvo Google Fonts (Inter como sustituto de la fuente del sistema en Windows). |

## Cómo verlo

Abrir el HTML en cualquier navegador. Arriba hay un conmutador Claro · Oscuro · Los dos («Los dos» duplica cada marco con el otro tema al lado). También acepta `?tema=claro|oscuro|ambos` en la URL. A 1536 px de ancho caben tres marcos por fila.

## Reglas que siguen las maquetas

- Colores, tipografía, radios y espaciado son los de `apps/movil/src/ui/tokens.ts`, copiados como variables CSS; si cambian los tokens, cambian aquí.
- Copy final en es-MX (`docs/02-UX.md §14`): tuteo, verbo primero, sin exclamaciones, `$1,500` sin centavos cuando son .00, nada de vocabulario contable.
- Cifras del vector E4-01 (Hoy) y E7-02 (arqueo) de `fixtures/motores/vectores.json`; ninguna cifra la «calcula» el intérprete.
- Objetivos táctiles ≥ 44 pt, contraste AA con los pares ya probados en `tokens.test.ts`, la voz nunca es la única vía.

Cuando Adam elija (A/B/C, R1/R2, pestañas, «Sí» en onboarding), la elección se anota en `docs/PLAN-MEJORA-2026-10.md §3` y las maquetas de aquí pasan a ser la referencia de la Ola 4.
