# Plan de mejora de Finanvoz (octubre 2026)

Pedido de Adam (22-10-2026), tras instalar la 1.0.0 (3) en su iPhone por TestFlight: la app se siente «mega simple»,
«hay botones que no funcionan», «debe ser más intuitiva» y «el testing de dinero tiene que poder ser con voz igual».
Pidió un plan que contemple todas las variables y que se ejecute con varios agentes. Este documento es ese plan y su
tablero: cada ola dice qué se hace, quién (qué agente) y con qué archivos, para que dos agentes nunca toquen el mismo
archivo a la vez sobre `main`.

Fuentes: cinco auditorías del 22-10 (botones muertos, recorrido real en el emulador, intuitividad, voz en el dinero,
iOS y pruebas automáticas). Las citas de código salen de ellas.

## 1. Diagnóstico

**En iPhone falta la mitad del producto.** La captura automática y el widget son solo de Android; en iOS no hay
compras (`src/suscripciones/expo.ts`), así que todo lo de Plus queda con candado; y la build de TestFlight va sin nube,
así que solo entiende las frases del intérprete local. Lo que queda es una cifra, un botón de hablar y formularios.

**Muchos «botones que no funcionan» son callejones sin salida o promesas rotas.** «Ver probabilidad · Plus» y «¿Me
alcanza?» llevan a «Plus todavía no está en iPhone»; preguntar «¿cuánto llevo?» contesta que es Plus; sin nube la app
dice «lo interpreto cuando tengas internet» aunque haya internet; el texto dice «agrégalo después en Cuentas» pero ahí
no se puede agregar cuentas ni pagos fijos; no hay lista de personas.

**En iPhone el teclado tapa los botones.** Ninguna pantalla se ajusta al teclado y el teclado numérico de iOS no tiene
tecla para cerrarse: «Continuar», «Ver mi día» y «Registrar» quedan escondidos.

**Se ve como boceto.** Sin íconos, animaciones ni hápticos; todo es la misma tarjeta blanca; la cifra de Hoy cambia
sin explicar por qué; corregir solo deja cambiar la cuenta; Registrar es un formulario largo; Cuentas es un cajón de
sastre y Ajustes solo se abre desde ahí.

**VoiceOver casi no anuncia nada**: la app usa `accessibilityLiveRegion` e `importantForAccessibility`, que solo
existen en Android.

**La voz no llega al dinero.** El onboarding y los campos de monto solo se escriben. El intérprete local ya entiende
la mayoría de esas frases, con huecos concretos: «8 mil 500», «treinta y un mil», «con 50 centavos», varias cuentas
en una frase, tarjetas con límite y deuda.

## 2. Olas de trabajo

Cada ola lista sus paquetes. Un paquete = un agente = un conjunto de archivos que nadie más toca mientras dure.
El coordinador (Claude principal) commitea cada paquete al terminar, con rutas explícitas, tras correr sus pruebas;
`docs/ESTADO.md` y `.ai/RELEVO.md` solo los toca el coordinador.

### Ola 1 · Voz en el dinero y teclado (en curso desde el 22-10)

| Paquete | Qué | Archivos |
|---|---|---|
| V-A Intérprete | Montos dictados («8 mil 500», «treinta y un mil», «con 50 centavos»), `interpretarMonto`, lectores por paso del onboarding (ingreso, efectivo, cuentas, tarjeta, pagos fijos, colchón, tanda), golden set +9 casos y golden de pasos, configurar desde Hoy (colchón, ingreso, saldo, compromisos) | `packages/nlu/**`, `fixtures/nlu/**`, `docs/06-NLU.md`, `apps/movil/src/servicios/registrar.ts` |
| V-B Micrófono y teclado | Teclado de iPhone (ajuste, «Listo»), `ProveedorDictado`, `useMicrofono`, `BotonMicrofono`, micrófono en cada `CampoMonto`, `anunciar()` para VoiceOver, `PanelRegistrar` con el hook compartido | `apps/movil/src/voz/**`, `apps/movil/src/ui/**`, `apps/movil/app/_layout.tsx`, `PanelRegistrar.tsx`, `servicios/voz-campos.ts` |

### Ola 2 · Botones muertos y flujos rotos (tras las auditorías de botones, recorrido e iOS)

Se reparte por zonas de pantallas para que no choquen; la lista exacta sale de las auditorías y se anota aquí.

| Paquete | Qué | Zona de archivos |
|---|---|---|
| B-1 Hoy y Movimientos | Copy honesto sin nube, aviso sobre la barra de iPhone, try/catch en acciones, «Corregir» un movimiento y fecha en el formulario, «Tu día pasa de $X a $Y», «Borrar» en vez de «Anular», tarjetas de acción como chips, Ajustes desde Hoy, VoiceOver | `pantallas/principal/*` salvo `PanelRegistrar` y `PantallaCuentas`, `app/(tabs)/{hoy,movimientos,registrar}.tsx` |
| B-2a Plus sin tienda y nube | Modo prueba `EXPO_PUBLIC_PLUS_SIN_TIENDA` (Plus liberado en TestFlight y prueba interna mientras no hay tienda), candados sin callejón, Deducciones con puerta solo en la estimación, variables de Supabase listas en los flujos | `servicios/plan.ts`, `suscripciones/**`, `pantallas/{plan,deducciones,me-alcanza}/**`, `app.config.ts`, flujos de tienda y APK |
| B-2b Cuentas, Ajustes y privacidad | Agregar cuenta, corregir saldo, agregar/quitar pagos fijos y lista de personas desde Cuentas; confirmar «Borrar todo»; Face ID sin código; respaldo por archivo cuenta; textos de Android fuera en iPhone; «Volver» seguro | `PantallaCuentas.tsx`, `app/ajustes*`, `pantallas/{ajustes,privacidad,ayuda,respaldo}/**`, `seguridad/**`, rutas nuevas `app/{cuentas,pagos-fijos,personas}/**` |
| B-3 Resto | Meses sin tarjeta, errores visibles, «Registrar pago», confirmaciones o Deshacer, compartido sin nube y con cámara negada, tandas tocables, arqueo con «Cambiar», captura y estados de cuenta en iPhone | `pantallas/{tarjetas,tandas,personas,compartido,arqueo,suscripciones,estados-cuenta,captura,avisos}/**` y sus rutas |

### Ola 3 · Onboarding por voz y en iPhone

O3–O7 con «Dímelo» y tarjeta «Entendí…» (usa V-A y V-B); en iPhone sin el paso de captura (ya especificado en
`02 §25`), «Paso n de 6»; pantalla de revelado «Tu día de hoy» al terminar.

### Ola 4 · Intuitividad (requiere aprobación visual de Adam)

Adam aprueba lo visual antes de construirlo. Se le presentan maquetas de:

- **Hoy**: A «más claro» (misma identidad, lo que viene, accesos rápidos), B «en conversación» (voz al centro) o C
  «tablero de quincena» (gráfica de ritmo; cambia `02 §16`).
- **Registrar**: R1 «hoja de voz» o R2 «monto primero» (teclado propio, recientes).
- Íconos (SF Symbols en iOS), jerarquía de superficies, hápticos, animación de la cifra («Tu día pasa de $214 a $194»),
  confirmación editable (monto, categoría, fecha), arquitectura (engrane en Hoy, accesos a Planear, Ajustes agrupado).

### Ola 5 · Pruebas automáticas en iPhone sin Mac

Flujo `ios-maestro.yml` en GitHub: compila para el simulador, instala, corre flujos Maestro que completan el
onboarding, tocan cada botón principal y toman captura de cada pantalla, y fallan si un botón no lleva a ningún lado.
Con esto los fallos de iPhone se ven antes de que Adam los encuentre.

### Ola 6 · Nube con Claude (cuando Adam pase la llave)

La llave nunca entra a la app: vive en los secretos del proxy de Supabase. Pasos: crear el proyecto de Supabase
(pendiente desde M0), `supabase link`, Anonymous sign-ins, `supabase secrets set NLU_PROVEEDORES=anthropic
ANTHROPIC_API_KEY=… NLU_TOPE_GLOBAL_DIARIO=… NLU_SAL_USUARIO=…`, `supabase functions deploy nlu-interpretar`,
`pnpm eval:nlu --nivel nube --proveedor anthropic --grabar`, variables `EXPO_PUBLIC_SUPABASE_URL` y
`EXPO_PUBLIC_SUPABASE_ANON_KEY` en los flujos de tienda, y nuevas builds. Después, lectores por paso en la nube
(`nlu-paso`) para lo que el nivel 0 deja en `null`.

### Ola 7 · Asistente financiero por voz (pedido del 22-10, tarde)

Adam, con la build en su iPhone: «sigue nada intuitiva, UI horrible, simple; el usuario tiene que hacer muchas cosas;
no se lleva casi todo con voz como un asistente financiero de IA». Esto cambia el centro de la app: la pantalla
principal deja de ser un tablero con un botón de voz y pasa a ser una conversación con el asistente (cifra del día
arriba, micrófono grande abajo, turnos cortos en medio: «Registré…», «Entendí… ¿lo registro?», «Mañana se corta tu
tarjeta», arqueo por voz, onboarding por voz). Los formularios largos quedan como «Cambiar algo».

- D-1 (`docs/diseno/mockups-asistente.html`): maquetas Hoy A/B/C, Registrar R1/R2, onboarding y arqueo por voz,
  escuchando y «No entendí», claro y oscuro. Adam elige; sin su elección no se construye lo visual grande (decisión 2).
- Al elegir: nueva pantalla principal sobre `useMicrofono`/`interpretarPaso` de la Ola 1, pestañas Asistente ·
  Movimientos · Cuentas · Tú, y cada flujo largo convertido a 2–4 preguntas con tarjeta «Entendí».

### Carril T · Ficha de ambas tiendas (en paralelo, T-1)

Ícono 512/1024 verificados, gráfico 1024×500, páginas públicas de aviso y soporte en GitHub Pages del repo (URL
provisional mientras no exista `finanvoz.com`), flujos `ios-capturas.yml` (iPhone 16 Pro Max 6.9") y
`android-capturas.yml` (Pixel 7) con enmarcado `scripts/tienda/enmarcar.mjs`, textos y capturas a App Store Connect
por API (`scripts/tienda/asc-ficha.py`), Play en `docs/tienda/play/` para subir por navegador. El lote de capturas es
provisional hasta que la Ola 7 cambie la pantalla principal.

### Cierre de cada ola

Typecheck, lint, vitest, jest, eval del intérprete; APK x86_64 al emulador; build nueva en TestFlight y en la prueba
interna de Play; nota a Adam con qué cambió y qué probar.

## 3. Decisiones de Adam

| # | Decisión | Propuesta por omisión mientras no conteste |
|---|---|---|
| 1 | Plus en iPhone: no hay compras en iOS | Encender las funciones Plus gratis en iOS durante la prueba (TestFlight), y decidir el modelo de cobro antes de la tienda pública |
| 2 | Maquetas de Hoy (A, B o C) y Registrar (R1 o R2) | **Decidido 22-10:** Hoy A «Conversación» con el micrófono grande de C cuando no hay turnos, Registrar R1 «Entendí» (R2 es lo que abre «Cambiar»), 4 pestañas Asistente · Movimientos · Cuentas · Tú, barra reservado·colchón·libre. Diseño técnico: `docs/diseno/OLA-7-ASISTENTE.md` |
| 3 | Pagos cada dos meses (luz, agua) | La regla queda sin llenar y se elige a mano; agregar regla `bimestral` en `05 §E3.1` si la aprueba |
| 4 | En el onboarding por voz, «Sí» llena el formulario o guarda directo | **Decidido 22-10:** «Sí» guarda directo en ingreso y colchón (la tarjeta «Entendí» es la revisión); cuentas y pagos fijos solo si están completos |
| 5 | Unificar «Borrar» y «Anular» | «Borrar», como ya lo dice la voz |
| 6 | Llave de Claude y proyecto de Supabase | Ola 6 |

## 5. Integración con el hilo de la nube (`docs/PLAN-UX-VOZ.md`, PR #24–#26 del 22-10)

Un hilo de proyecto de Claude en la nube, lanzado por Adam, hizo el mismo plan (tres auditorías, Olas 1–4) y fusionó
tres PR entre las 14:02 y las 14:37 (hora de Puebla) mientras aquí corrían V-A, V-B, B-1, B-2a, B-2b y B-3: 57
archivos, con `voz/`, `ui/componentes`, `packages/nlu`, onboarding y textos por plataforma. `origin/main` es la base
(Adam lo fusionó); lo de aquí se integra encima con un merge, no se pisa nada, y donde los dos hicieron lo mismo queda
**una sola** implementación:

| Tema | Hilo de la nube | Aquí | Queda |
|---|---|---|---|
| Teclado iPhone y «Listo» | `Pantalla`, `CampoTexto` (1.1, 1.2) | V-B: lo mismo + scroll que sigue al campo | Una sola versión en `Pantalla`/`CampoTexto`, con las pruebas de ambos |
| Micrófono en `CampoMonto` | `ContextoDictadoCampos` inyectado desde `ProveedorDictadoCampos` (`ui/` no importa `voz/`) + `BotonDictarCampo` | V-B: `ProveedorDictado` (un micrófono a la vez, ignora eventos del anterior), `useMicrofono`, `BotonMicrofono`, `dictable`/`admiteCero`, audio iOS, `anunciar` | La forma inyectada de la nube (`ui/` sin nativos) con el motor de aquí: `BotonDictar` = `BotonMicrofono` sobre `useMicrofono`; `admiteCero` y «Abrir Ajustes» se conservan; `BotonDictarCampo`/`Microfono`/`ProveedorDictadoCampos` desaparecen |
| Intérprete de montos | `reglas/campos.ts` `interpretarMonto` | V-A: `reglas/monto-dictado.ts` con `admiteCero` y `aproximado` | El de aquí; `campos.ts` deja de exportar `interpretarMonto` |
| Pasos dictados | `campos.ts` `interpretarIngresoDicho`, `interpretarPagoFijoDicho`; `onboarding/DecirloPaso.tsx` en O3 y O5 | V-A: `pasos/interpretarPaso` (ingreso, cuentas, tarjeta, pagos fijos, colchón, tanda; golden de 100 casos) | `DecirloPaso` sobre `interpretarPaso`; `campos.ts` se elimina cuando nada lo importe; golden y eval al 100 % |
| Plus sin tienda | 1.4: ocultar entradas si `compras === null` | B-2a: modo prueba + puertas honestas; `_layout` pasa `abrirPlan` solo con tienda | Ambos: son compatibles |
| Hoy/Movimientos, textos iPhone, avisos | 1.3, 1.6, 1.10–1.15 | B-1, B-2b, B-3 | Conflicto por conflicto: gana lo más completo, sin dejar dos textos para lo mismo |
| O6 saltado en iPhone, «Volver» en frío, bloqueo sin código, respaldo sin nube | 1.7, 1.9, 1.10, 1.11 | No hecho aquí | Lo de la nube tal cual |

Verificación del merge: typecheck, lint, vitest completo, jest completo, `eval:nlu --nivel reglas` y `--pasos` al 100 %,
y Maestro de iPhone en el siguiente push. Después del merge, Adam decide qué hilo sigue con FinanVoz: dos a la vez
sobre los mismos archivos es trabajo doble.

## 4. Bitácora

- 22-10: auditorías lanzadas; Ola 1 en curso (V-A, V-B).
- 22-10: llegan las auditorías de intuitividad, voz y botones muertos (ninguna ruta inexistente ni handler vacío: los
  fallos vienen del teclado de iPhone, de Plus sin tienda, de la build sin nube y de flujos sin entrada). Ola 2 en
  curso (B-1, B-2a, B-2b, B-3) en paralelo con la Ola 1. Decisión 1 aplicada por omisión como modo prueba reversible.
- Pendiente para el coordinador tras la Ola 1: en `PanelRegistrar`, los formularios largos (tarjeta, tanda, cuenta
  dividida, compra a meses) deben abrirse en Registrar o en una hoja, no dentro del panel de 35 % de alto; en
  `app.json`, plugin `expo-background-task`; en `app/_layout.tsx`, `abrirPlan` nulo cuando no hay tienda ni modo prueba.
- 22-10 (tarde): Adam pide ficha completa de ambas tiendas y una app llevada casi toda por voz (Ola 7 y carril T);
  Ágora pasa a su propia sesión con el mismo pedido (fallos, funciones, UX para 18 años, ficha). Flujos Maestro de
  iPhone (`apps/movil/.maestro/ios`, 8 flujos + 6 subflujos) y `ios-maestro.yml` en git; `apps/movil/.gitignore`
  dejaba fuera `.maestro/ios/` por el patrón `ios/`.
- 22-10 (tarde): B-2a entregado y commiteado (decisión 1 aplicada: modo prueba reversible por variable de build).
  Quedan para el coordinador: `app/_layout.tsx` debe pasar `abrirPlan` solo si `compras !== null || plusDePrueba`;
  `PanelRegistrar` y `explicar.ts` dicen «300 frases» por plan `plus` aunque el proxy siga en 30 (mirar `plusDePrueba`
  o que el proxy reconozca builds de prueba, Ola 6).
- 22-10 (tarde): commiteados V-A (c6770f9), V-B (ddffbf7), B-1 (607313b), B-2a (8a63ed0). Al ir a subir, `origin/main`
  trae PR #24–#26 del hilo de la nube (§5): se integran con merge cuando B-2b y B-3 terminen.
- 22-10 (tarde): Adam detiene el hilo de la nube en FinanVoz; esta sesión integra sus PR y sigue sola con la app.
  La rama `claude/project-thread-lief9t` (2 commits sin PR: jest, rutas de pestañas, onboarding, calculadora) se
  evalúa en el merge y se borra después.
- 22-10 (tarde): Adam eligió Hoy A + R1 + 4 pestañas + «Sí» directo en ingreso/colchón + barra. Ola 7 arranca al
  cerrar el merge de M-1; diseño técnico y dueños en `docs/diseno/OLA-7-ASISTENTE.md`.
