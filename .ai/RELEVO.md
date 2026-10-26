# RELEVO

- **Último turno:** claude-code
- **Fecha:** 2026-10-25
- **Rama:** main

## Hecho en este turno

- **Revisión del trabajo de Cursor del 24 y 25-10** (32 commits, `0742b8c`…`286f14f`) y correcciones con el visto
  bueno de Adam:
  - **CI en verde otra vez**: llevaba 30 pushes en rojo en `pnpm lint` (Prettier en 13 archivos y dos `!` de ESLint
    en `servicios/movimientos.ts` y `principal.test.tsx`), así que en GitHub no corrían typecheck, pruebas, evals ni
    el escaneo de secretos. jest fallaba en 2: `numberOfLines` en `FilaAjuste` y `PantallaFormularioLargo`
    (CA-M7-05) y la prueba de humo de la marca.
  - **Barra nativa arreglada** (`src/ui/navegacion.tsx`, `BarraNativa` en 26 rutas): sin título grande encimado,
    sin «(tabs)» en el botón de atrás, sin título repetido, colores del tema claro/oscuro, `Pantalla` sin el borde de
    arriba bajo la barra, y salida `barra-salida` cuando la pantalla se abre sin historial. Pruebas de «atrás»
    restauradas (Ajustes, Ingreso, Privacidad) y flujos de Maestro con `subflujos/atras.yaml` (`BackButton`).
  - **Ajustes**: `FilaAjuste` sin truncar y con etiqueta hablada completa; Colchón y Datos para cobrar como filas;
    tono «faltante» del respaldo pendiente; aviso legal completo y leído por VoiceOver; Ingreso se oye con su resumen.
  - **Textos**: «Finanvoz» de vuelta en la bienvenida, con texto propio para iPhone (sin prometer los avisos del
    banco); «Cuando dejes de hablar, termino solo.» como en el mockup aprobado.
  - Decisiones en `docs/ESTADO.md` (25-10) y `docs/PLAN-UX-VOZ.md` §3.3 y §3.6.
  - **Teclado en Android**: con borde a borde `adjustResize` ya no encoge la ventana y el campo del asistente quedaba
    bajo el teclado (capturas de Android). `PantallaAsistente` y `Pantalla` usan `KeyboardAvoidingView` también en
    Android. `compartido.test.tsx` espera hasta 10 s la sincronización (fallaba solo con la suite completa).
  - **Auditoría** en `docs/diseno/AUDITORIA-PRO-2026-10.md` + `mockups-auditoria-2026-10.html`: 6 propuestas sin
    construir, esperan el visto bueno de Adam.
  - **Flecha de atrás en Android**: `headerTitle` como función montaba en Android una vista izquierda que escondía la
    flecha; ahora es cadena vacía (`5518eae`).
  - **Maestro de iPhone** (corrida 40281636346 de `e494379`): pasan 02, 04, 05, 07, 08 y 09; fallaban 01 (la tarjeta
    de Debes quedaba a medias en pantalla) y 03 (ya no existe «Guardar horario»), corregidos después; 06 sigue
    marcado como fallo conocido.
  - **Maestro**: `tocar.yaml` centra el elemento (el pie fijo tapaba «Agregar tarjeta» en O4), «¿Me alcanza?» es
    opcional en 02 (la build del simulador no trae compras), 05 manda la frase con «Enviar». Las capturas de tienda
    de Android usan el onboarding corto (el largo quedó atrás de la Ola 7) y toman Ajustes › Ingreso con la barra.
- `0f5a01c` («WIP: rescate») era trabajo de Cursor a medio hacer (`FilaAjuste`), no de Claude: lo de Claude del 23-10
  (nivel 0 sin nube, chips de Movimientos) ya estaba en `790e3fd` y `bef69db` y sigue intacto.

## Estado de tiendas

- **TestFlight**: `ios-testflight.yml` usa el número de corrida como build; la última subida antes de este turno fue
  1.0.0 (10) del 23-10. Grupo interno «Equipo Finanvoz (interno)» con Adam invitado. La API con la llave de Gestor de
  apps no asigna testers: se agregan desde la consola.
- **Play**: prueba interna publicada el 22-10 (versión 1, 1.0.0) con la lista «Equipo Finanvoz». `android-play.yml`
  solo compila y firma el AAB (artefacto `finanvoz-aab`): **no hay cuenta de servicio de Play**, así que subirlo a la
  prueba interna es a mano en la consola (o crear la cuenta de servicio). Los testers ven «com.finanvoz.app
  (unreviewed)» hasta la primera revisión.
- **App Store Connect**: app creada el 22-10 (es-MX, SKU `FINANVOZ-IOS`); falta ficha, privacidad y revisión (§5–§7 de
  `docs/tienda/IOS-APP-STORE.md`). Ficha de Play en `docs/tienda/play/`.
- Secretos de firma de iOS y Android cargados en GitHub el 22-10 (nombres en `docs/tienda/`; los valores viven fuera
  del repo). Flujos: `ios-testflight.yml`, `android-play.yml`.

## Backend y puerta de IA

- Backend propio en el Hetzner: `https://finanvoz-api.zynoratek.com` (Supabase mínimo; compose en
  `/opt/finanvoz-backend`, plantilla en `services/proxy/deploy/`). La IA va por la puerta única
  (`ANTHROPIC_BASE_URL=http://puerta-ia:8080`, token del proyecto en la carpeta local de secretos, nunca en el repo),
  Haiku 5.5 en modo herramienta.
- **Las funciones del proxy con el reintento de 4 s no están redesplegadas** (`scripts/desplegar-funciones.sh`).
- Respaldo en la nube apagado hasta tener SMTP; sin respaldos de la base (decisión de Adam).

## Norte de producto (Adam, voz)

App que se siente trivial (hablar y listo) con motores, proxy y libro pesados detrás. Nada fuera de `01-PRD.md` sin
spec: web con el libro, facturar por voz, «todo el planeta» o SAT automático son decisiones de producto y legal.

## A medias — CUIDADO

- **Ola 7 y la UI de Cursor sin probar en teléfono**: asistente, voz y onboarding por voz solo se han visto en jest y
  en el simulador de CI.
- **Maestro de iPhone ya fallaba antes de Cursor** en flujos que no tocan la barra (`onb-tarjeta`,
  `boton-me-alcanza`, `aviso`): revisar esos flujos aparte.
- M0, dominio `finanvoz.com` y aviso revisado por abogado: Adam (bloquean ficha pública y prueba externa).
- Respaldar las llaves de Android fuera de la PC.

## Siguiente

1. Ver la CI y las capturas de Maestro (claro y oscuro) de este turno; si están bien, TestFlight y Play.
2. Adam prueba en sus teléfonos la Ola 7 y la barra nueva.
3. Ola 3.5 (`expo-symbols`) y 3.8 (onboarding más corto): con mockup y visto bueno de Adam antes de construir.

## No tocar

- Solo `main`; sin ramas, PR ni reset duro sin Adam.
- `LEYENDA_ESTIMACION` (`08 §1`) literal; `packages/core` E*; vectores a mano.
- `PreviaWidget` / `widget.test` salvo pedido explícito.
- Emitir facturas, declaraciones u open banking con la clave del banco sin cambio de spec y legal.
- Credenciales fuera del repo (solo los scripts de Adam las leen); este archivo es público: sin correos, llaves ni
  enlaces privados.

## Estimación rápida

FinanVoz código ~95 %; camino a tiendas ~70 % (prueba interna en Play y TestFlight; faltan fichas públicas, dominio y
legal).
