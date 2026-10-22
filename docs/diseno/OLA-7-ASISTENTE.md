# Ola 7 · Asistente financiero por voz — diseño técnico

Decisión de Adam (22-10-2026) sobre `mockups-asistente.html`: **Hoy A «Conversación»** con el micrófono grande de C
cuando no hay turnos, **Registrar R1 «Entendí»** (R2 es lo que abre «Cambiar»), **4 pestañas** Asistente · Movimientos ·
Cuentas · Tú, **«Sí» guarda directo** en ingreso y colchón, **barra** reservado·colchón·libre. Plan general:
`docs/PLAN-MEJORA-2026-10.md` (§2 Ola 7, §3 decisiones 2 y 4). Rutas relativas a `apps/movil/` salvo `docs/` y `packages/`.

## 1. Principios

1. **Ningún cálculo nuevo.** Las cifras siguen saliendo de `packages/core` y `src/servicios`; el asistente solo
   orquesta turnos. El intérprete (`@cartera/nlu`) interpreta, no calcula (regla 4).
2. **La voz es la vía principal; el teclado está a un toque; todo lo dicho se puede tocar.** Nada depende de oír bien.
3. **Registrar directo cuando se entiende completo; preguntar cuando hay duda.** `registrarTexto` ya lo decide:
   `resultado: 'registrado'` (y `registrado_msi`, `registrado_division`, `corregido`, `anulado`, `pasar_a_meses`) →
   turno «Registré… — Deshacer»; `confirmar`, `confirmar_msi`, `confirmar_division`, `confirmar_compartido`,
   `confirmar_ajuste` → tarjeta «Entendí… ¿lo registro?». Nunca se guarda solo con duda (regla 12).
4. **Textos** es-MX, tuteo, sin exclamaciones, sin consejos (`08 §1`). Cada turno cabe en dos líneas.
5. **Accesible:** objetivos ≥ 44 pt, cada turno nuevo del asistente se anuncia (`ui/anunciar`), el micrófono tiene
   etiqueta y estado hablados, y lo que se dicta nunca va a logs (regla 9).
6. **Oscuro y claro** con los tokens de `ui/tokens.ts`; nada de blanco puro en oscuro.

## 2. Estructura

- **Pestañas** (`app/(tabs)/_layout.tsx`): `hoy` con etiqueta «Asistente» (ícono burbuja con micrófono),
  `movimientos`, `cuentas`, `tu` (nuevo `app/(tabs)/tu.tsx`, monta `PantallaAjustes`; la ruta `/ajustes` sigue
  existiendo para enlaces internos). La pestaña `registrar` desaparece; `app/registrar.tsx` pasa a ser una ruta
  modal (`presentation: 'modal'`) con `FormularioMovimiento` prellenado: es R2.
- **Pantalla** `src/pantallas/asistente/`:
  - `PantallaAsistente.tsx` (testID `pantalla-hoy`, se conserva para Maestro).
  - `CabeceraDia.tsx`: «Hoy puedes gastar $214» (`VistaHoy.hoyPuedesPesos`), `textoDias`/`mensaje`, fecha
    (testID `hoy-fecha`) y `BarraDia.tsx` (tres segmentos reservado·colchón·libre de `VistaHoy`, tocable → hoja
    `Desglose` existente, testIDs `boton-desglose`/`desglose`). Compacta: ≤ 112 pt.
  - `Conversacion.tsx`: lista de turnos (FlatList, siempre al final; el teclado la empuja; `keyboardShouldPersistTaps`).
  - `turnos/`: `TurnoRegistro`, `TurnoEntendi` (envuelve `ui/TarjetaEntendi`), `TurnoPregunta`, `TurnoAviso`,
    `TurnoNoEntendi`, `TurnoTexto`, `TurnoPersona`.
  - `BarraVoz.tsx`: `BotonMicrofono` de 72 pt (mantener o tocar, `useMicrofono`, testID `boton-hablar`), botón de
    teclado (`boton-escribir`) que abre `CampoRegistrar` en línea (`campo-registrar`, `boton-enviar-registro`,
    `boton-formulario` abre R2) y chips de intención (`chip-intencion-<clave>`).
  - `EstadoVacio.tsx`: sin turnos del día: micrófono enorme centrado (`estado-vacio-mic`), «Prueba decir “tacos 80 en
    efectivo”» y «Lo último que entendí: …» si existe.
  - `textos.ts` con prueba de palabras prohibidas (como `observaciones-textos`).
- **Lógica sin UI** `src/asistente/`: `tipos.ts`, `conversacion.ts` (derivar y reducir turnos), `registro.ts`
  (`ResultadoTexto` → turnos), `reparacion.ts`, `confirmacion-voz.ts`, `chips.ts`, `flujos/`.
- **Compartido en `ui/`** (sin importar `voz/` ni nativos): `ui/componentes/TarjetaEntendi.tsx` + `ui/entendi.ts`
  (tipos). Lo usan el asistente, el onboarding y el arqueo.

## 3. Contratos

```ts
// src/ui/entendi.ts
export interface FilaEntendi {
  clave: string;                 // 'monto' | 'que' | 'cuenta' | 'categoria' | 'cuando' | …
  etiqueta: string;              // «Cuenta»
  valor: string;                 // «BBVA débito»
  opciones?: readonly { valor: string; etiqueta: string }[];   // si hay, la fila abre chips
  alCambiar?: (valor: string) => void;
}
export interface PropuestaEntendi {
  titulo: string;                // «Entendí» · «Entendí · ¿la agrego?» · «Entendí · ¿lo guardo?»
  monto?: Centavos;              // cifra grande, opcional
  filas: readonly FilaEntendi[];
  efecto?: string;               // «La luz ya estaba apartada: tu día sigue en $214.»
  confirmar: { etiqueta: string; accion: () => Promise<void> };   // «Sí, regístralo»
  cambiar?: { etiqueta: string; accion: () => void };             // abre R2 o el formulario largo
  pista?: string;                // «También puedes decir “sí” o “no, fue con la Nu”.»
}
// testIDs de TarjetaEntendi: entendi, entendi-monto, entendi-fila-<clave>, entendi-confirmar, entendi-cambiar

// src/asistente/tipos.ts
export type ChipRespuesta = { valor: string; etiqueta: string };
export type Respuesta =
  | { tipo: 'chip'; valor: string }
  | { tipo: 'monto'; centavos: Centavos; aproximado: boolean }
  | { tipo: 'texto'; texto: string; porVoz: boolean };
export type Turno =
  | { id: string; de: 'persona'; texto: string; porVoz: boolean }
  | { id: string; de: 'asistente'; clase: 'registro'; texto: string; detalle?: string; cambioDia?: string;
      deshacer?: () => Promise<void>; abrir?: () => void }                       // testID aviso (el más reciente)
  | { id: string; de: 'asistente'; clase: 'entendi'; propuesta: PropuestaEntendi }
  | { id: string; de: 'asistente'; clase: 'pregunta'; texto: string; ayuda?: string; chips: readonly ChipRespuesta[];
      campo?: 'monto' | 'texto' | 'fecha'; admiteCero?: boolean; responder: (r: Respuesta) => void }
  | { id: string; de: 'asistente'; clase: 'aviso'; texto: string; detalle?: string;
      acciones: readonly { etiqueta: string; accion: () => void | Promise<void> }[];
      origen: 'tarjeta_accion' | 'observacion' | 'arqueo' | 'probabilidad' | 'por_revisar' | 'riesgo' }
  | { id: string; de: 'asistente'; clase: 'no_entendi'; oido: string; opciones: readonly ChipRespuesta[];
      elegir: (valor: string) => void; corregir: () => void }
  | { id: string; de: 'asistente'; clase: 'texto'; texto: string; verMovimientos?: () => void };
```

`src/asistente/conversacion.ts`:

- `derivarTurnosDelDia(ctx, vista: VistaHoy): Turno[]`: los movimientos de hoy (uno «Registré…» por transacción,
  con «Deshacer» solo mientras viva el token de 5 s), las tarjetas de acción (`TarjetasAccion`), las observaciones
  («Lo que veo», máximo 2), el arqueo sugerido, «Por revisar» y el aviso de riesgo (`ProbabilidadHoy` cuando aplique,
  Plus). Determinista: recibe `hoy` y no llama al reloj.
- `useConversacion()`: turnos derivados + turnos de sesión (persona, entendí, pregunta, no_entendi, texto) con
  `agregar`, `resolver(id)` (quita una pregunta o un Entendí ya contestado) y `limpiarSesion`. **Los turnos de
  sesión no se persisten**: al relanzar solo quedan los derivados del libro (decisión para ESTADO).

`src/asistente/registro.ts` (A-2): `turnosDesdeResultado(ctx, r: ResultadoTexto, o: { porVoz: boolean; abrirR2; …
}): Turno[]` cubre **todas** las variantes de `ResultadoTexto` (`servicios/registrar.ts` línea ~239): registrado →
`registro` con `cambioDia` (`lineaCambioDia` de `principal/textos.ts`); confirmar* → `entendi` cuyo `confirmar` llama
`confirmarPropuesta` / `confirmarCompraMsi` / `confirmarCuentaDividida` / `agregarGastoCompartido` /
`confirmarAjuste`; por_interpretar → `texto` honesto (el de B-1) + chips «Es un gasto», «Es un ingreso», «Escribirlo»;
consulta/explicar → `texto` con «Ver movimientos»; me_alcanza → abre la pantalla; arqueo → flujo de arqueo por voz;
sin_pareja → `aviso`; `null`/desconocido → `no_entendi` con `sugerirReparacion`.

## 4. Flujo de un registro

1. La persona habla (mantener o tocar) o escribe → turno `persona` (con ícono de micrófono si fue por voz).
2. `registrarTexto` (nivel 0; nube cuando exista) → `turnosDesdeResultado`.
3. Si el resultado es `entendi` y el registro vino por voz, el micrófono vuelve a escuchar **un** turno de hasta 6 s
   (`confirmacion-voz.ts` sobre `packages/nlu/src/pasos/confirmacion.ts`): «sí», «dale», «correcto» → confirmar;
   «no» → `cambiar`; «no, fue con la Nu» / «eran 40» → cambia la fila y vuelve a mostrar. Si no oye nada, la tarjeta
   se queda esperando el toque. Interruptor en Ajustes › Voz «Confirmar por voz» (encendido por omisión).
4. «Cambiar» abre R2 (`/registrar` modal) prellenado; al guardar, vuelve al asistente y aparece el turno `registro`.
5. «Deshacer» revierte con asientos espejo (libro inmutable) y el turno dice «Deshice el registro».

## 5. Chips de intención (`src/asistente/chips.ts`)

| Chip | Qué hace |
|---|---|
| «Gasté…» | Abre el dictado con el prefijo «gasté » (si está el teclado, lo escribe y deja el cursor al final) |
| «Me pagaron…» | Igual, con «me pagaron » |
| «¿Me alcanza para…?» | Igual, con «me alcanza para » (Plus; si no hay Plus ni tienda, el chip no aparece) |
| «Contar efectivo» | Inicia el arqueo por voz (§7) |
| «Pagar tarjeta» | Pregunta «¿Cuál tarjeta?» (chips) → «¿Cuánto?» (monto, sugerido el pago para no generar intereses) → registro `pago_tarjeta` por `registrarTexto` o el servicio de tarjetas |

Máximo 5 chips, los dos últimos solo si hay efectivo / tarjetas.

## 6. Flujos conversacionales (A-3) — `src/asistente/flujos/`

```ts
export interface PasoFlujo<E> {
  id: string;
  pregunta: (e: E) => string;
  ayuda?: (e: E) => string;
  campo?: 'monto' | 'texto' | 'fecha'; admiteCero?: boolean;
  chips?: (e: E) => readonly ChipRespuesta[];
  aplicar: (e: E, r: Respuesta) => E | { error: string };
  omitirSi?: (e: E) => boolean;            // ya se dijo en la frase inicial
}
export interface FlujoConversacional<E> {
  id: 'tarjeta' | 'msi' | 'tanda' | 'cuenta_dividida';
  inicial: (ctx, origen: ResultadoTexto | LecturaPaso | null) => E;
  pasos: readonly PasoFlujo<E>[];
  entendi: (ctx, e: E) => PropuestaEntendi;     // «Entendí · ¿la agrego?»
  guardar: (ctx, e: E) => Promise<void>;
  formularioLargo: (e: E) => Href;              // «Cambiar algo»
}
```

- **Tarjeta:** desde `interpretarPaso('tarjeta', frase)` («tengo una Nu que corta el 28 y pago el 18») o el chip
  «Agregar tarjeta» de Cuentas: solo pregunta lo que falte (¿cuánto debes hoy? [monto, `admiteCero`], ¿la pagas
  completa? [chips], corte y pago si faltan) → Entendí → `agregarTarjeta`. «Cambiar algo» abre `FormularioTarjetaNueva`
  prellenado.
- **Compra a meses:** desde `confirmar_msi` → Entendí (meses, mensualidad, tarjeta como filas con opciones) →
  `confirmarCompraMsi`.
- **Tanda:** `interpretarPaso('tanda')` → faltantes (cuántos, cuánto, cada cuándo, turno, primera fecha con chips) →
  Entendí → servicio de tandas.
- **Cuenta dividida:** desde `confirmar_division` → Entendí (personas y partes como filas) → `confirmarCuentaDividida`.

Los formularios largos de `PanelRegistrar` (`TarjetaConfirmarMsi`, `TarjetaConfirmarTanda`, división) dejan de vivir
en el panel: A-1 los retira cuando A-3 entregue cada flujo; mientras, el flujo abre la ruta larga.

## 7. Onboarding y arqueo por voz (A-4)

- Cada paso O3, O4, O5 y O7 tiene «Dímelo» (`DecirloPaso` ya unificado sobre `interpretarPaso` tras el merge de M-1) y
  termina en `TarjetaEntendi`. **«Sí» guarda directo en O3 (ingreso) y O7 (colchón)** y pasa al siguiente paso sin
  formulario; en O4 y O5, «Sí» guarda si la lectura está completa y, si no, llena el formulario con lo leído y lleva
  el foco al primer hueco. «Paso n de 6» en iPhone (O6 saltado, ya en `main`).
- **Arqueo por voz:** turno `pregunta` «¿Cuánto efectivo traes? Deberías traer $640» (`campo: 'monto'`,
  `admiteCero`) → Entendí «Traes $300: faltan $340» con filas para repartir la diferencia (las opciones del arqueo
  actual, E7) → `confirmarArqueo`. Entra por «traigo 300», por el chip «Contar efectivo», por `TarjetaArqueo` (que pasa
  a ser un turno `aviso` con «Contar») y desde Cuentas › «Contar mi efectivo» (sigue abriendo `PantallaArqueo`).

## 8. Dueños por archivo (nada se toca fuera de la fila propia)

| Agente | Archivos |
|---|---|
| **A-1 Asistente (UI y conversación)** | `src/pantallas/asistente/**`, `src/asistente/{tipos,conversacion,chips}.ts`, `src/ui/entendi.ts`, `src/ui/componentes/TarjetaEntendi.tsx` (+ `ui/index.ts` para exportarla), `app/(tabs)/{_layout,hoy,tu}.tsx`, `app/(tabs)/{pestanas-textos,hoy-textos}.ts`, `app/registrar.tsx` (modal R2) y baja de `app/(tabs)/registrar.tsx`, `src/pantallas/principal/{PantallaHoy,PanelRegistrar,PantallaRegistrar}.tsx` (se vacían o se adaptan: sus piezas pasan a turnos), `apps/movil/.maestro/ios/**` (ids), `docs/02-UX.md §4` |
| **A-2 Entendí, reparación y confirmación por voz** | `src/asistente/{registro,reparacion,confirmacion-voz}.ts` (+ pruebas), `packages/nlu/src/pasos/{confirmacion,reparacion}.ts` + golden en `fixtures/nlu/golden-pasos.jsonl` (eval `--pasos` al 100 %), API de prellenado de `src/pantallas/principal/FormularioMovimiento.tsx`, `src/servicios/registrar.ts` solo si falta tubería para `confirmar_ajuste`, `src/pantallas/ajustes/SeccionVoz.tsx` (interruptor «Confirmar por voz») |
| **A-3 Flujos conversacionales** | `src/asistente/flujos/**` (+ pruebas), `src/pantallas/asistente/flujos/**` si hace falta UI propia, `src/servicios/{tarjetas,tandas,msi,cuenta-dividida}.ts` solo para exponer lo que el flujo necesite |
| **A-4 Onboarding y arqueo por voz** | `src/pantallas/onboarding/**`, `app/onboarding/**`, `src/pantallas/arqueo/**`, `src/servicios/{onboarding,arqueo}.ts`, `docs/02-UX.md §3 y §7` |
| **Coordinador** | `docs/ESTADO.md`, `docs/PLAN-MEJORA-2026-10.md`, `docs/02-UX.md §2 y §5`, `.ai/RELEVO.md`, builds |

Orden de arranque: A-1 publica primero `src/asistente/tipos.ts`, `src/ui/entendi.ts` y `TarjetaEntendi` (en su
primera media hora) y avisa; A-2, A-3 y A-4 arrancan a la vez con la lógica pura (que no depende de la UI) y se
conectan a esos contratos cuando existan. Los commits los hace el coordinador por paquete.

## 9. Criterios de aceptación (CA-O7)

| # | Criterio |
|---|---|
| 1 | Recién instalada, la pestaña Asistente muestra la cabecera y el estado vacío con el micrófono enorme; «coca 25 en efectivo» por texto produce el turno «Registré Coca $25 · Antojos · Efectivo. Tu día pasa de $X a $Y. Deshacer»; «Deshacer» revierte con asientos espejo y el turno lo dice |
| 2 | «pagué la luz 450 con la BBVA» con motivo de confirmación produce «Entendí» con 4 filas; «Sí, regístralo» registra; «Cambiar» abre R2 prellenado y al guardar vuelve al asistente con el turno de registro |
| 3 | Una frase sin sentido produce `no_entendi` con ≥ 3 opciones y «Corregir lo que oí»; cada opción lleva a R2 o registra |
| 4 | «¿cuánto llevo en antojos?» produce un turno de texto con la respuesta y «Ver movimientos» filtrado |
| 5 | «traigo 300» abre el arqueo por voz: pregunta, Entendí (sobra/falta), confirmar; Cuentas lo refleja |
| 6 | «tengo una Nu que corta el 28 y pago el 18» hace ≤ 2 preguntas, Entendí «¿la agrego?», y la tarjeta queda creada; «Cambiar algo» abre el formulario prellenado |
| 7 | O3 por voz «gano 13 mil cada quincena» → Entendí → «Sí» guarda y pasa a O4 sin formulario; O7 igual; O4/O5 incompletos llenan el formulario |
| 8 | Pestañas Asistente · Movimientos · Cuentas · Tú; `/ajustes` sigue abriendo Ajustes; no hay pestaña Registrar; `/registrar` abre el modal |
| 9 | Con VoiceOver cada turno nuevo del asistente se anuncia; el micrófono tiene etiqueta y estado; objetivos ≥ 44 pt |
| 10 | Maestro iOS 02, 05, 06 y 08 pasan con los ids conservados (`pantalla-hoy`, `hoy-fecha`, `boton-hablar`, `boton-escribir`, `campo-registrar`, `boton-enviar-registro`, `boton-formulario`, `aviso`, `boton-desglose`, `desglose`, `boton-me-alcanza`, `candado-probabilidad`, `pestana-*`); jest de `asistente` ≥ 40 pruebas; typecheck, lint, vitest, jest y eval verdes |
| 11 | Oscuro: fondo raíz y tarjetas con tokens, sin blanco puro |
| 12 | Sin nube (la build actual de TestFlight) todo lo anterior funciona con el nivel 0; lo que no entiende va a `no_entendi`, nunca «cuando tengas internet» si hay internet |

## 10. Qué se conserva tal cual

Movimientos (B-1), Cuentas y sus altas (B-2b), tarjetas/tandas/compartido (B-3), Plus de prueba (B-2a), micrófono
en campos y teclado (V-B + nube), intérprete (V-A + nube). La pantalla Hoy anterior deja de existir como pantalla;
sus piezas (`Observaciones`, `TarjetasAccion`, `ProbabilidadHoy`, `Desglose`) viven como turnos o como hoja.
